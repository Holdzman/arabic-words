import type { AuthErrorCode, AuthErrorResponse } from "@/lib/types";

export function authErrorResponse(status: number, code: AuthErrorCode, message?: string) {
  const body: AuthErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
}
