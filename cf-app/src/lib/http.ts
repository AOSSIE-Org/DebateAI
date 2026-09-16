/** Small helpers mirroring the Go handlers' `c.JSON(status, gin.H{...})`. */

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export const ok = (body: unknown) => json(body, 200);
export const created = (body: unknown) => json(body, 201);
export const badRequest = (error: string, extra?: object) =>
  json({ error, ...extra }, 400);
export const unauthorized = (error = "Unauthorized") => json({ error }, 401);
export const forbidden = (error = "forbidden") => json({ error }, 403);
export const notFound = (error = "Not found") => json({ error }, 404);
export const conflict = (error: string) => json({ error }, 409);
export const serverError = (error = "Internal server error", extra?: object) =>
  json({ error, ...extra }, 500);

/** Parse a JSON body, returning `null` on malformed input (like ShouldBindJSON). */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
