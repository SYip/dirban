import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { err, ok, type Result } from "neverthrow"

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/
const PACKAGE_JSON_PATHS = ["package.json", "packages/vscode-extension/package.json"] as const
const LOCKFILE_PATH = "bun.lock" as const

type BumpType = "patch" | "minor" | "major"

interface BumpOptions {
  readonly target: string
  readonly dryRun: boolean
  readonly noGit: boolean
}

const parseBumpArgs = (argv: readonly string[]): Result<BumpOptions, string> => {
  let target: string | undefined
  let dryRun = false
  let noGit = false

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--no-git") {
      noGit = true
    } else if (!arg.startsWith("-")) {
      target = arg
    } else {
      return err(`Unknown flag: ${arg}`)
    }
  }

  if (target == null || target.trim() === "") {
    return err("Usage: bun run bump <patch|minor|major|X.Y.Z> [--dry-run] [--no-git]")
  }

  return ok({ target: target.trim(), dryRun, noGit })
}

const calculateNextVersion = (current: string, target: string): Result<string, string> => {
  const match = SEMVER_REGEX.exec(current)
  if (match == null) {
    return err(`Invalid current version in package.json: "${current}"`)
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  const bumpMap: Record<BumpType, string> = {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  }

  if (target === "major" || target === "minor" || target === "patch") {
    return ok(bumpMap[target])
  }

  if (!SEMVER_REGEX.test(target)) {
    return err(`Invalid semver target: "${target}". Expected patch, minor, major, or X.Y.Z.`)
  }

  return ok(target)
}

const updatePackageVersion = (filePath: string, nextVersion: string): Result<void, string> => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8")
    const pkg = JSON.parse(raw) as Record<string, unknown>
    pkg.version = nextVersion
    fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8")
    return ok(undefined)
  } catch (e) {
    return err(`Failed to update ${filePath}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const runShell = (command: string): Result<void, string> => {
  try {
    execSync(command, { stdio: "inherit" })
    return ok(undefined)
  } catch (e) {
    return err(`Command failed (${command}): ${e instanceof Error ? e.message : String(e)}`)
  }
}

const main = (): number => {
  const argsRes = parseBumpArgs(process.argv.slice(2))
  if (argsRes.isErr()) {
    console.error(argsRes.error)
    return 1
  }

  const { target, dryRun, noGit } = argsRes.value
  const rootPkgPath = path.resolve(process.cwd(), PACKAGE_JSON_PATHS[0])
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8")) as { version?: string }

  if (typeof rootPkg.version !== "string") {
    console.error("Missing string 'version' in root package.json")
    return 1
  }

  const nextVersionRes = calculateNextVersion(rootPkg.version, target)
  if (nextVersionRes.isErr()) {
    console.error(nextVersionRes.error)
    return 1
  }

  const nextVersion = nextVersionRes.value
  console.log(`Version: ${rootPkg.version} -> ${nextVersion}`)

  if (dryRun) {
    console.log("[dry-run] Would update:")
    for (const relPath of PACKAGE_JSON_PATHS) {
      console.log(`  - ${relPath}`)
    }
    console.log("[dry-run] Would run: bun install")
    if (!noGit) {
      console.log(`[dry-run] Would commit "release: v${nextVersion}" and tag "v${nextVersion}"`)
    }
    return 0
  }

  for (const relPath of PACKAGE_JSON_PATHS) {
    const updateRes = updatePackageVersion(path.resolve(process.cwd(), relPath), nextVersion)
    if (updateRes.isErr()) {
      console.error(updateRes.error)
      return 1
    }
    console.log(`✔ Updated ${relPath} to ${nextVersion}`)
  }

  const installRes = runShell("bun install")
  if (installRes.isErr()) {
    console.error(installRes.error)
    return 1
  }
  console.log("✔ Synchronized bun.lock")

  if (!noGit) {
    const filesToStage = [...PACKAGE_JSON_PATHS, LOCKFILE_PATH].join(" ")
    const stageRes = runShell(`git add ${filesToStage}`)
    if (stageRes.isErr()) {
      console.error(stageRes.error)
      return 1
    }

    const commitRes = runShell(`git commit -m "release: v${nextVersion}"`)
    if (commitRes.isErr()) {
      console.error(commitRes.error)
      return 1
    }

    const tagRes = runShell(`git tag -a "v${nextVersion}" -m "Release v${nextVersion}"`)
    if (tagRes.isErr()) {
      console.error(tagRes.error)
      return 1
    }

    console.log(`\n✔ Created commit and tag v${nextVersion}`)
    console.log("Next step: push the tag to trigger .github/workflows/publish.yml:")
    console.log("  git push origin main --tags")
  }

  return 0
}

process.exit(main())
