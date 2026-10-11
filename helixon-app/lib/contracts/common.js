// Building blocks for the response contracts in this folder.
//
// A contract is a zod schema for the JSON a route answers with. The server
// code that builds the response and the browser code that reads it
// (lib/api-client) both take their type from it, and the route tests parse
// real responses with it, so a key renamed on one side fails a check instead
// of turning into `undefined` on a page.

import { z } from "zod";

export const nullableString = z.string().nullable();
export const nullableNumber = z.number().nullable();
// Timestamps arrive as ISO strings.
export const timestamp = z.string();

// What every route answers with when it refuses a request.
export const ApiErrorBodySchema = z.looseObject({ error: z.string() });

/** @typedef {z.infer<typeof ApiErrorBodySchema>} ApiErrorBody */
