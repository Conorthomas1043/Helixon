// Reading more rows than one request returns. A plain select stops at the
// database's row limit (1,000 by default on Supabase) without saying so, and
// one .in() with hundreds of ids makes the request URL too long to send.

/**
 * Every row a query matches, a page at a time. `page(from, to)` builds a
 * fresh query - with a stable order (end on a unique column such as id) -
 * and applies .range(from, to).
 * @param {(from: number, to: number) => PromiseLike<{ data: any[] | null, error: any }>} page
 * @param {{ pageSize?: number, cap?: number }} [options]
 * @returns {Promise<{ data: any[] | null, error: any, truncated: boolean }>}
 */
export async function fetchAll(page, { pageSize = 1000, cap = 100000 } = {}) {
  const rows = [];
  for (let from = 0; from < cap; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: null, error, truncated: false };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null, truncated: false };
  }
  return { data: rows, error: null, truncated: true };
}

/**
 * `query(chunk)` over `ids` a chunk at a time, results concatenated.
 * @param {any[]} ids
 * @param {(chunk: any[]) => PromiseLike<{ data: any[] | null, error: any }>} query
 * @param {{ size?: number }} [options]
 * @returns {Promise<{ data: any[] | null, error: any }>}
 */
export async function inChunks(ids, query, { size = 200 } = {}) {
  const unique = [...new Set(ids)];
  const rows = [];
  for (let i = 0; i < unique.length; i += size) {
    const { data, error } = await query(unique.slice(i, i + size));
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}
