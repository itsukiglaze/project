/**
 * `console.error("...", err)` alone can render as just the string message
 * in Vercel's collapsed log view, hiding exactly the detail needed to
 * diagnose a production-only failure (e.g. a DB connection error, which is
 * a plain Error/AggregateError, not a typed app error). Pull out every
 * field that matters into one flat, always-expanded log line: message,
 * stack, and — duck-typed, since importing Prisma's error classes here
 * isn't worth the coupling — any `code`/`errorCode`/`meta`/`clientVersion`
 * Prisma error classes attach (PrismaClientKnownRequestError,
 * PrismaClientInitializationError, etc.).
 */
export function describeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { value: err };
  }
  const record = err as unknown as Record<string, unknown>;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(typeof record.code !== "undefined" ? { code: record.code } : {}),
    ...(typeof record.errorCode !== "undefined" ? { errorCode: record.errorCode } : {}),
    ...(typeof record.meta !== "undefined" ? { meta: record.meta } : {}),
    ...(typeof record.clientVersion !== "undefined" ? { clientVersion: record.clientVersion } : {}),
    ...(err.cause ? { cause: describeError(err.cause) } : {}),
  };
}

/** `console.error(label, describeError(err))`, stringified so nothing is silently collapsed. */
export function logUnexpectedError(label: string, err: unknown): void {
  console.error(label, JSON.stringify(describeError(err)));
}
