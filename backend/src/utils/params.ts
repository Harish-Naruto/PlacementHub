import type { Request } from "express";
import { ApiError } from "./apiError.ts";

/** Reads a single path parameter (Express 5 types route params as `string | string[]`). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  const single = Array.isArray(value) ? value[0] : value;
  if (!single) throw new ApiError(`Missing route parameter: ${name}`, 400);
  return single;
}

/** Joins zod issues into one readable message. */
export function issuesMessage(error: { issues: { message: string }[] }): string {
  return error.issues.map((i) => i.message).join(", ");
}

/** Validates input with a zod schema or throws a 400 with every message. Express 5 forwards the throw to the error handler. */
export function validate<S extends import("zod").ZodType>(schema: S, data: unknown): import("zod").infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(issuesMessage(parsed.error), 400);
  return parsed.data;
}
