// Obfuscates one compiled chunk and, when the chunk has a source map, builds
// a map from the obfuscated code straight back to the original source.
//
// Sentry's build plugin uploads source maps during `next build`, before the
// postbuild obfuscation runs. A map uploaded then describes code that no
// longer ships, so stack traces from these chunks couldn't be read. The map
// made here chains the obfuscator's map (obfuscated -> compiled) onto the
// build's map (compiled -> original), so it matches what browsers run.
//
// Sentry finds a map by the chunk's debug ID. The ID lives in a runtime
// snippet (obfuscated, but it still sets the same ID when it runs) and in a
// trailing `//# debugId=` comment, which obfuscation strips; it's put back
// on the code and copied into the map.

import JavaScriptObfuscator from "javascript-obfuscator";
import remapping from "@jridgewell/remapping";

export const OBFUSCATOR_OPTIONS = {
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

const DEBUG_ID_COMMENT = /\/\/# debugId=([0-9a-fA-F-]{36})/;
const SOURCE_MAPPING_URL = /\n?\/\/# sourceMappingURL=\S*\s*$/;

/**
 * @param {string} code compiled chunk
 * @param {{ fileName: string, inputMap?: any }} options
 * @returns {{ code: string, map: any | null, debugId: string | null }}
 */
export function obfuscateChunk(code, { fileName, inputMap = null }) {
  const debugId = code.match(DEBUG_ID_COMMENT)?.[1] || inputMap?.debugId || inputMap?.debug_id || null;
  const withMap = inputMap
    ? { sourceMap: true, sourceMapMode: "separate", inputFileName: fileName, sourceMapFileName: `${fileName}.map` }
    : {};
  const result = JavaScriptObfuscator.obfuscate(code, { ...OBFUSCATOR_OPTIONS, ...withMap });

  // The maps are deleted after upload, so no URL comment points at one.
  let out = result.getObfuscatedCode().replace(SOURCE_MAPPING_URL, "");
  if (debugId) out += `\n//# debugId=${debugId}\n`;

  let map = null;
  if (inputMap) {
    const obfuscatorMap = JSON.parse(result.getSourceMap());
    // Newest transform first: obfuscated -> compiled, then compiled -> original.
    map = JSON.parse(JSON.stringify(remapping([obfuscatorMap, inputMap], () => null)));
    map.file = fileName;
    if (debugId) {
      map.debugId = debugId;
      map.debug_id = debugId;
    }
  }
  return { code: out, map, debugId };
}
