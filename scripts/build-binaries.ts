import * as fs from "node:fs"
import * as path from "node:path"
import { $ } from "bun"
import { createHash } from "node:crypto"

interface Target {
  readonly osArch: string
  readonly bunTarget: string
  readonly isWindows?: boolean
}

const TARGETS: readonly Target[] = [
  { osArch: "darwin_arm64", bunTarget: "bun-darwin-arm64" },
  { osArch: "darwin_x64", bunTarget: "bun-darwin-x64" },
  { osArch: "linux_arm64", bunTarget: "bun-linux-arm64" },
  { osArch: "linux_x64", bunTarget: "bun-linux-x64" },
  { osArch: "windows_x64", bunTarget: "bun-windows-x64", isWindows: true },
]

async function main(): Promise<void> {
  const rootDir = process.cwd()
  const distBinDir = path.join(rootDir, "dist", "bin")
  const releaseDir = path.join(rootDir, "release-assets")

  // Read version from package.json or GITHUB_REF_NAME
  const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"))
  const rawRef = process.env.GITHUB_REF_NAME ?? ""
  const version = rawRef.startsWith("v") ? rawRef.slice(1) : (pkgJson.version ?? "0.1.0")

  console.log(`Building release binaries for Dirban v${version}...`)

  // Prepare clean output directories
  fs.rmSync(distBinDir, { recursive: true, force: true })
  fs.rmSync(releaseDir, { recursive: true, force: true })
  fs.mkdirSync(distBinDir, { recursive: true })
  fs.mkdirSync(releaseDir, { recursive: true })

  // 1. Compile each standalone binary using Bun
  for (const target of TARGETS) {
    const filename = target.isWindows ? "dirban.exe" : "dirban"
    const outBin = path.join(distBinDir, `${target.osArch}-${filename}`)

    console.log(`  -> Compiling ${target.bunTarget}...`)
    await $`bun build ./main.ts --compile --target=${target.bunTarget} --outfile ${outBin}`.quiet()

    // 2. Archive binary + docs
    if (target.isWindows) {
      const zipName = `dirban_${version}_${target.osArch}.zip`
      const zipPath = path.join(releaseDir, zipName)
      console.log(`  -> Packaging ${zipName}...`)

      // Temporarily stage clean filename
      const stagedExe = path.join(rootDir, "dirban.exe")
      fs.copyFileSync(outBin, stagedExe)
      await $`zip -q ${zipPath} dirban.exe README.md LICENSE`.cwd(rootDir)
      fs.rmSync(stagedExe, { force: true })
    } else {
      const tarName = `dirban_${version}_${target.osArch}.tar.gz`
      const tarPath = path.join(releaseDir, tarName)
      console.log(`  -> Packaging ${tarName}...`)

      // Temporarily stage clean binary with execute permissions
      const stagedBin = path.join(rootDir, "dirban")
      fs.copyFileSync(outBin, stagedBin)
      fs.chmodSync(stagedBin, 0o755)
      await $`tar -czf ${tarPath} dirban README.md LICENSE`.cwd(rootDir)
      fs.rmSync(stagedBin, { force: true })
    }
  }

  // 3. Generate SHA-256 checksums file
  console.log(`Generating SHA-256 checksums...`)
  const checksums: string[] = []
  const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith(".tar.gz") || f.endsWith(".zip"))

  for (const file of files) {
    const filePath = path.join(releaseDir, file)
    const fileBuffer = fs.readFileSync(filePath)
    const hash = createHash("sha256").update(fileBuffer).digest("hex")
    checksums.push(`${hash}  ${file}`)
  }

  const checksumsPath = path.join(releaseDir, "checksums.txt")
  fs.writeFileSync(checksumsPath, checksums.join("\n") + "\n", "utf8")

  console.log(`\nSuccessfully created ${files.length} release assets in release-assets/:`)
  for (const line of checksums) {
    console.log(`  ${line}`)
  }
}

main().catch((err) => {
  console.error("Build binaries failed:", err)
  process.exit(1)
})
