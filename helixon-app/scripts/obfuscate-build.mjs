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
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const APP_CHUNKS_DIR = path.join(process.cwd(), ".next", "static", "chunks", "app");

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  shuffleStringArray: true,
  // Deliberately off: selfDefending/debugProtection work by freezing the
  // tab or corrupting output whenever devtools are open, which hits real
  // users (support debugging their own extensions, screen readers,
  // accessibility tooling) as hard as it hits anyone trying to reverse the
  // bundle, for a protection that's trivially stripped by feeding the file
  // back through a generic AST beautifier.
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  renameGlobals: false,
};

function walkJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkJsFiles(full));
    } else if (entry.endsWith(".js") && !entry.endsWith(".js.map")) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  let files;
  try {
    files = walkJsFiles(APP_CHUNKS_DIR);
  } catch (err) {
    console.error(`[obfuscate-build] Could not read ${APP_CHUNKS_DIR}:`, err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`[obfuscate-build] No .js files found under ${APP_CHUNKS_DIR} - build output looks wrong, refusing to continue.`);
    process.exit(1);
  }

  let failures = 0;
  for (const file of files) {
    try {
      const source = readFileSync(file, "utf8");
      const obfuscated = JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS).getObfuscatedCode();
      writeFileSync(file, obfuscated, "utf8");
    } catch (err) {
      failures += 1;
      console.error(`[obfuscate-build] FAILED on ${path.relative(process.cwd(), file)}:`, err.message);
    }
  }

  console.log(`[obfuscate-build] Obfuscated ${files.length - failures}/${files.length} app chunk(s).`);

  if (failures > 0) {
    console.error(`[obfuscate-build] ${failures} file(s) failed to obfuscate - failing the build rather than shipping partial protection.`);
    process.exit(1);
  }
}

main();
