import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

/**
 * Validate request data against a Zod schema.
 * Returns typed parsed data on success, or a 400 NextResponse on failure.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Validation failed",
            details: err.issues.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Return a safe error response that never leaks internal details in production.
 */
export function safeError(err: unknown, context: string): NextResponse {
  console.error(`${context}:`, err);
  const message =
    process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
