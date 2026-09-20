// Real semantic skill matching, as a fallback after semanticMatcher.js's
// static taxonomy/whole-word checks miss. semanticMatcher.js is fast, free
// and deterministic for anything already in models/skillTaxonomy.json, but
// it has no way to relate two skills it's never been told are related (e.g.
// a candidate skill phrased differently from anything in the taxonomy).
// This fills that gap with real embedding similarity, called only for the
// skills the cheap path couldn't resolve.
//
// Uses Voyage AI, not Gemini: Gemini is reserved for the public chat
// assistant (app/api/assistant) - a separate vendor for a separate,
// unrelated surface. Anthropic/Claude has no embeddings endpoint of its own,
// so for the CV analysis pipeline (which otherwise runs entirely on Claude)
// Voyage is the closest fit - it's Anthropic's own recommended embeddings
// partner (https://docs.claude.com/en/docs/build-with-claude/embeddings),
// not an unrelated third lab. Requires VOYAGE_API_KEY - a new vendor/
// subprocessor, so the privacy policy/DPA subprocessor lists need updating
// alongside this (see app/privacy, app/dpa).
//
// Embeddings are cached in Redis (already used for rate limiting -
// lib/redis.js) keyed by normalised skill text: skill vocabulary is highly
// repetitive across candidates and jobs ("React", "Python", "AWS" recur
// constantly), so after initial warmup most lookups are cache hits, not API
// calls. Redis being unconfigured or down just means no caching (fail
// open), not a broken pipeline - same if VOYAGE_API_KEY isn't set at all.
import { getRedis } from "@/lib/redis.js";
import { normaliseSkill } from "../utils/skillNormaliser.js";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5-lite"; // short skill-name strings, not long documents - the lite model is plenty and cheaper
const CACHE_PREFIX = "cv-embed:voyage:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 90; // skill-name embeddings don't drift - 90 days is safe
export const SEMANTIC_MATCH_THRESHOLD = 0.84;

async function embedBatch(inputs) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: inputs, model: MODEL }),
  });

  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed: ${response.status}`);
  }

  const data = await response.json();
  // Voyage returns items in the same order as the input array, each with
  // an explicit `index` - sort by that rather than trusting array order.
  const byIndex = new Map((data?.data || []).map((item) => [item.index, item.embedding]));
  return inputs.map((_, i) => byIndex.get(i) || null);
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
// vector>. Never throws: if Voyage isn't configured or the call fails, it
// returns whatever was already cached (possibly empty) - callers treat a
// missing vector as "no semantic match available" for that skill, not as a
// pipeline failure.
export async function embedSkills(skills) {
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

  if (uncached.length === 0) return result;

  try {
    const vectors = await embedBatch(uncached);
    if (!vectors) return result; // no VOYAGE_API_KEY configured

    uncached.forEach((key, i) => {
      const vector = vectors[i];
      if (Array.isArray(vector) && vector.length) {
        result.set(key, vector);
        setCached(key, vector); // fire-and-forget
      }
    });
  } catch (err) {
    console.error("[embeddingMatcher] Voyage embeddings request failed:", err.message);
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
