// An in-memory stand-in for the Supabase client, for testing API routes
// against real filtering. select/insert/update/delete act on `tables`, and
// eq/neq/in/is/gt/gte/lt/lte filter rows. Filters it doesn't know are
// ignored, which only ever widens a result, so a test checking that one
// agency can't see another's rows can't pass by accident.
//
//   const db = fakeDb({ candidates: [{ id: "c1", agency_id: "A" }] });
//   vi.mock("@/lib/supabase", () => ({ supabase: db }));

let nextId = 1;

export function fakeDb(seed = {}) {
  const tables = Object.fromEntries(Object.entries(seed).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));
  const log = [];

  function query(table) {
    tables[table] ??= [];
    const filters = [];
    let op = "select";
    let payload = null;
    let single = null; // "single" | "maybe"
    let limit = null;
    let wantRows = false;

    const matches = (row) => filters.every((f) => f(row));
    const q = {
      select() {
        wantRows = true;
        return q;
      },
      insert(values) {
        op = "insert";
        payload = Array.isArray(values) ? values : [values];
        return q;
      },
      upsert(values) {
        op = "insert";
        payload = Array.isArray(values) ? values : [values];
        return q;
      },
      update(values) {
        op = "update";
        payload = values;
        return q;
      },
      delete() {
        op = "delete";
        return q;
      },
      eq: (col, val) => (filters.push((r) => r[col] === val), q),
      neq: (col, val) => (filters.push((r) => r[col] !== val), q),
      in: (col, vals) => (filters.push((r) => vals.includes(r[col])), q),
      is: (col, val) => (filters.push((r) => (val === null ? r[col] == null : r[col] === val)), q),
      gt: (col, val) => (filters.push((r) => r[col] > val), q),
      gte: (col, val) => (filters.push((r) => r[col] >= val), q),
      lt: (col, val) => (filters.push((r) => r[col] < val), q),
      lte: (col, val) => (filters.push((r) => r[col] <= val), q),
      limit: (n) => ((limit = n), q),
      maybeSingle: () => ((single = "maybe"), q),
      single: () => ((single = "single"), q),
      then(resolve, reject) {
        return Promise.resolve().then(run).then(resolve, reject);
      },
    };
    for (const m of ["order", "range", "or", "not", "filter", "ilike", "like", "contains", "match", "textSearch", "returns", "abortSignal"]) q[m] = () => q;

    function run() {
      const rows = tables[table];
      let result = [];
      if (op === "select") {
        result = rows.filter(matches);
      } else if (op === "insert") {
        result = payload.map((r) => ({ id: r.id ?? `${table}-${nextId++}`, created_at: new Date().toISOString(), ...r }));
        rows.push(...result);
      } else if (op === "update") {
        result = rows.filter(matches);
        for (const r of result) Object.assign(r, payload);
      } else if (op === "delete") {
        result = rows.filter(matches);
        tables[table] = rows.filter((r) => !result.includes(r));
      }
      log.push({ table, op, payload, count: result.length });
      if (limit != null) result = result.slice(0, limit);
      const data = (op === "select" || wantRows) ? result.map((r) => ({ ...r })) : null;
      if (single === "single") {
        return data?.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: "PGRST116", message: "Not one row" } };
      }
      if (single === "maybe") return { data: data?.[0] ?? null, error: null };
      return { data, error: null, count: result.length };
    }
    return q;
  }

  return {
    from: query,
    rpc: async () => ({ data: null, error: null }),
    tables,
    log,
    writes: () => log.filter((e) => e.op !== "select"),
  };
}
