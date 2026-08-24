import type { LoginRequestBody } from "@/lib/types";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { verifyPassword } from "@/lib/server/password";
import { findUserByUsername } from "@/lib/server/users";
import { setSessionCookie } from "@/lib/server/session";

export async function POST(request: Request) {
  let body: LoginRequestBody;
  try {
    body = await request.json();
  } catch {
    return authErrorResponse(400, "bad_request", "invalid JSON body");
  }

  const username = body.username?.trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return authErrorResponse(401, "invalid_credentials");
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return authErrorResponse(401, "invalid_credentials");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return authErrorResponse(401, "invalid_credentials");
  }

  await setSessionCookie(user.id);
  return Response.json({ username: user.username });
}
