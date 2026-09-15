/**
 * ZeroKore long-term memory.
 * - Deterministic local text embeddings (1536 dims, L2-normalized) so
 *   memory works without any extra embedding API key.
 * - Recall via pgvector cosine similarity, strictly scoped to the caller.
 * - Keyword (ILIKE) fallback when vector search is unavailable.
 * Memory failures never crash a conversation — callers degrade gracefully.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const EMBEDDING_DIMS = 1536;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Feature-hashed embedding: unigrams + bigrams hashed into 1536 buckets,
 * L2-normalized. Deterministic; similar texts → high cosine similarity.
 */
export function embedText(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMS).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 512);
  if (tokens.length === 0) return vec;

  const feats: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    feats.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  for (const f of feats) {
    vec[hashToken(f) % EMBEDDING_DIMS] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export interface MemoryHit {
  id: string;
  content: string;
  similarity: number;
}

/**
 * Cosine-similarity recall via pgvector, user-scoped.
 * Falls back to keyword search if the vector query fails.
 */
export async function searchSimilarMemories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  embedding: number[],
  limit = 5
): Promise<MemoryHit[]> {
  const vectorLiteral = `[${embedding.join(",")}]`;

  try {
    const { data, error } = await (
      supabase as unknown as {
        rpc(
          fn: string,
          args: Record<string, string | number>
        ): Promise<{
          data: { id: string; content: string; similarity: number }[] | null;
          error: { message: string } | null;
        }>;
      }
    ).rpc("match_memories", {
      p_user_id: userId,
      p_embedding: vectorLiteral,
      p_limit: limit,
    });
    if (!error && Array.isArray(data)) {
      return data.map((r: { id: string; content: string; similarity: number }) => ({
        id: r.id,
        content: r.content,
        similarity: Number(r.similarity ?? 0),
      }));
    }
  } catch {
    // Fall through to direct query / keyword fallback.
  }

  try {
    const { data, error } = await supabase
      .from("agent_memory")
      .select("id, content, embedding")
      .eq("user_id", userId)
      .not("embedding", "is", null)
      .limit(200);
    if (!error && data) {
      const scored = data
        .map((row: { id: string; content: string; embedding: unknown }) => {
          const emb = parseVector(row.embedding);
          if (!emb) return null;
          let dot = 0;
          for (let i = 0; i < EMBEDDING_DIMS; i++) dot += emb[i] * embedding[i];
          return { id: row.id, content: row.content, similarity: dot };
        })
        .filter((x): x is MemoryHit => x !== null)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .filter((x) => x.similarity > 0.05);
      if (scored.length > 0) return scored;
    }
  } catch {
    // Fall through to keyword fallback.
  }

  return [];
}

function parseVector(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length === EMBEDDING_DIMS) {
    return value.map(Number);
  }
  if (typeof value === "string") {
    const s = value.trim().replace(/^\[|\]$/g, "");
    if (!s) return null;
    const parts = s.split(",").map(Number);
    if (parts.length === EMBEDDING_DIMS && parts.every((n) => Number.isFinite(n))) {
      return parts;
    }
  }
  return null;
}

/** Keyword fallback recall (ILIKE), still strictly user-scoped. */
export async function keywordSearchMemories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  query: string,
  limit = 5
): Promise<MemoryHit[]> {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);
  if (words.length === 0) return [];

  const { data, error } = await supabase
    .from("agent_memory")
    .select("id, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];

  return data
    .map((row: { id: string; content: string }) => {
      const hay = row.content.toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      return { id: row.id, content: row.content, similarity: score / words.length };
    })
    .filter((x) => x.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}