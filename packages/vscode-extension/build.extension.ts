import { resolve } from "node:path"
import * as esbuild from "esbuild"

const isWatch = process.argv.includes("--watch")

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [resolve(__dirname, "src/extension.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  outfile: resolve(__dirname, "dist/extension.js"),
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
}

async function run(): Promise<void> {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log("[esbuild] Watching extension host for changes...")
  } else {
    await esbuild.build(buildOptions)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
