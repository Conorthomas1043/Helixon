// Runs automatically after `next build` (npm's `postbuild` convention).
//
// Client-side reverse-engineering resistance, on top of Next's normal
// production minification. Deliberately NOT wired in as a webpack plugin/
// loader: Turbopack (Next's default bundler as of Next 16, and what this
// app builds with) doesn't support webpack plugins at all, and the webpack
// fallback that would support one was tried and abandoned - see git history
// on this file's introduction for the details, but in short: the plugin
// form obfuscated vendor code too (Next merges node_modules into the same
// chunk files as app code, so a "**/node_modules/**" exclude never matched
// anything, and control-flow flattening across React/Mapbox GL/Recharts
// took the build to 3.4 minutes), and the loader form - which correctly
// scoped to just this app's own source - silently obfuscated a different,
// non-deterministic ~15-25% of app chunks on every run with no error
// surfaced anywhere, which is worse than nothing: a build that looks
// protected but mostly isn't.
//
// This script sidesteps both problems by operating on the already-compiled
// output directly, after webpack has finished: deterministic, and any
// per-file failure is a script crash (visible, fails the build) rather than
// a loader that quietly passes through the original source.
//
// Scope: only .next/static/chunks/app/**/*.js - the per-route chunks
// webpack emits for the App Router, which is where this app's own page/
// component code actually lands (verified by grepping known page-only
// source strings against the build output - they show up in their own
// route chunk, not a shared one). Deliberately excludes
// .next/static/chunks/*.js (the shared/vendor chunks - React, Mapbox GL,
// Recharts, Stripe.js, Clerk, PostHog, Sentry - already public upstream,
// and control-flow flattening a library like Mapbox GL would risk breaking
// it for no security benefit) and all of .next/server/** (server code is
// never sent to a browser in the first place, so obfuscating it protects
// nothing and risks breaking Next's own server module resolution).
//
// This directory split only exists in webpack's output - Turbopack (Next's
// default bundler since Next 16) emits every chunk flat with no app/
// grouping, so there'd be no way to tell app code from vendor code by path
// alone. That's why package.json's `build` script forces `--webpack`: not
// for plugin support (this script needs none) but for this exact directory
// layout. The real cost is build time (webpack is slower than Turbopack);
// `next dev` is unaffected either way since this script only ever runs
// after a production build.
//
// Source maps: Sentry's build plugin uploads maps for every chunk except
// these (next.config.mjs ignores .next/static/chunks/app), and leaves the
// client maps on disk. This script obfuscates each app chunk, writes a map
// that runs from the obfuscated code back to the original source
// (scripts/lib/obfuscate-chunk.mjs), uploads those maps with sentry-cli when
// SENTRY_AUTH_TOKEN is set, and then deletes every client map so none is
// served publicly.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { obfuscateChunk } from "./lib/obfuscate-chunk.mjs";

const STATIC_DIR = path.join(process.cwd(), ".next", "static");
const APP_CHUNKS_DIR = path.join(STATIC_DIR, "chunks", "app");

function walk(dir, keep) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, keep));
    else if (keep(entry)) out.push(full);
  }
  return out;
}

function uploadMaps() {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    console.log("[obfuscate-build] SENTRY_AUTH_TOKEN not set; source maps not uploaded.");
    return;
  }
  const cli = path.join(process.cwd(), "node_modules", ".bin", "sentry-cli");
  const run = (args) => spawnSync(cli, args, { stdio: "inherit", env: process.env }).status === 0;
  // `inject` gives any chunk without a debug ID one (in the code and its
  // map); chunks that already carry one keep it. `upload` then matches each
  // map to its chunk by that ID.
  const ok =
    run(["sourcemaps", "inject", APP_CHUNKS_DIR]) &&
    run(["sourcemaps", "upload", "--org", "helixon", "--project", "helixon", APP_CHUNKS_DIR]);
  // Like the build plugin: a failed upload costs readable stack traces, not
  // the deploy.
  if (!ok) console.error("[obfuscate-build] Source map upload failed; stack traces from app chunks won't be readable for this build.");
}

function main() {
  let files;
  try {
    files = walk(APP_CHUNKS_DIR, (name) => name.endsWith(".js"));
  } catch (err) {
    console.error(`[obfuscate-build] Could not read ${APP_CHUNKS_DIR}:`, err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`[obfuscate-build] No .js files found under ${APP_CHUNKS_DIR} - build output looks wrong, refusing to continue.`);
    process.exit(1);
  }

  let failures = 0;
  let mapped = 0;
  for (const file of files) {
    try {
      const mapFile = `${file}.map`;
      const inputMap = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : null;
      const { code, map } = obfuscateChunk(readFileSync(file, "utf8"), { fileName: path.basename(file), inputMap });
      writeFileSync(file, code, "utf8");
      if (map) {
        writeFileSync(mapFile, JSON.stringify(map), "utf8");
        mapped += 1;
      }
    } catch (err) {
      failures += 1;
      console.error(`[obfuscate-build] FAILED on ${path.relative(process.cwd(), file)}:`, err.message);
    }
  }

  console.log(`[obfuscate-build] Obfuscated ${files.length - failures}/${files.length} app chunk(s), ${mapped} with source maps.`);

  if (failures > 0) {
    console.error(`[obfuscate-build] ${failures} file(s) failed to obfuscate - failing the build rather than shipping partial protection.`);
    process.exit(1);
  }

  if (mapped > 0) uploadMaps();

  // Always, uploaded or not: a public map would undo the obfuscation.
  const maps = walk(STATIC_DIR, (name) => name.endsWith(".map"));
  for (const map of maps) rmSync(map);
  if (maps.length) console.log(`[obfuscate-build] Deleted ${maps.length} client source map(s).`);
}

main();
