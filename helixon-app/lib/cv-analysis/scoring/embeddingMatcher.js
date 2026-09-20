// Real semantic skill matching, as a fallback after semanticMatcher.js's
// static taxonomy/whole-word checks miss. semanticMatcher.js is fast, free
// and deterministic for anything already in models/skillTaxonomy.json, but
// it has no way to relate two skills it's never been told are related (e.g.
// a candidate skill phrased differently from anything in the taxonomy).
// This fills that gap with real embedding similarity, called only for the
// skills the cheap path couldn't resolve.
//
// Uses Gemini's embedding model via @google/genai - already a dependency
// and already configured (GEMINI_API_KEY; see app/api/assistant/route.js),
// so this adds no new subprocessor/vendor. Embeddings are cached in Redis
// (already used for rate limiting - lib/redis.js) keyed by normalised skill
// text: skill vocabulary is highly repetitive across candidates and jobs
// ("React", "Python", "AWS" recur constantly), so after initial warmup most
// lookups are cache hits, not API calls. Redis being unconfigured or down
// just means no caching (fail open), not a broken pipeline.
import { GoogleGenAI } from "@google/genai";
import { getRedis } from "@/lib/redis.js";
import { normaliseSkill } from "../utils/skillNormaliser.js";

const MODEL = "text-embedding-004";
const CACHE_PREFIX = "cv-embed:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 90; // skill-name embeddings don't drift - 90 days is safe
export const SEMANTIC_MATCH_THRESHOLD = 0.84;

let client = null;
function ai() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client = new GoogleGenAI({ apiKey });
  return client;
}

async function getCached(key) {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const raw = await redis.get(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCached(key, vector) {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(CACHE_PREFIX + key, JSON.stringify(vector), { EX: CACHE_TTL_SECONDS });
  } catch {
    // Best-effort - a cache miss just costs one extra embedding call next time.
  }
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Embeds a batch of skill-name strings, checking the Redis cache first and
// calling the API only for what's missing. Returns a Map<normalisedSkill,
// vector>. Never throws: if Gemini isn't configured or the call fails, it
// returns whatever was already cached (possibly empty) - callers treat a
// missing vector as "no semantic match available" for that skill, not as a
// pipeline failure.
export async function embedSkills(skills) {
  const model = ai();
  const result = new Map();

  const keys = [...new Set(skills.map(normaliseSkill).filter(Boolean))];
  if (keys.length === 0) return result;

  const uncached = [];
  for (const key of keys) {
    const cached = await getCached(key);
    if (cached) {
      result.set(key, cached);
    } else {
      uncached.push(key);
    }
  }

  if (uncached.length === 0 || !model) return result;

  try {
    const response = await model.models.embedContent({
      model: MODEL,
      contents: uncached,
    });

    const embeddings = response?.embeddings || [];
    uncached.forEach((key, i) => {
      const vector = embeddings[i]?.values;
      if (Array.isArray(vector) && vector.length) {
        result.set(key, vector);
        setCached(key, vector); // fire-and-forget
      }
    });
  } catch (err) {
    console.error("[embeddingMatcher] embedContent failed:", err.message);
  }

  return result;
}

// Given a required skill and a candidate's skill list, plus a pre-fetched
// embeddings map (from embedSkills, covering both sides), returns the best
// match at or above SEMANTIC_MATCH_THRESHOLD, or null. Pure/synchronous -
// all the async work already happened in embedSkills.
export function findSemanticMatch(requiredSkill, candidateSkills, embeddings) {
  const requiredVector = embeddings.get(normaliseSkill(requiredSkill));
  if (!requiredVector) return null;

  let best = null;
  let bestScore = 0;

  for (const candidateSkill of candidateSkills) {
    const vector = embeddings.get(normaliseSkill(candidateSkill));
    if (!vector) continue;

    const score = cosineSimilarity(requiredVector, vector);
    if (score > bestScore) {
      bestScore = score;
      best = candidateSkill;
    }
  }

  if (best && bestScore >= SEMANTIC_MATCH_THRESHOLD) {
    return { matched: best, score: Math.round(bestScore * 100) / 100 };
  }
  return null;
}
