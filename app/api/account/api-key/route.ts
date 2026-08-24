import type { SaveApiKeyRequestBody } from "@/lib/types";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { getSessionUserId } from "@/lib/server/session";
import { findUserById, updateApiKeyEnc } from "@/lib/server/users";
import { encryptSecret } from "@/lib/server/crypto";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return authErrorResponse(401, "not_authenticated");
  }

  const user = await findUserById(userId);
  if (!user) {
    return authErrorResponse(401, "not_authenticated");
  }

  return Response.json({ hasApiKey: !!user.api_key_enc });
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return authErrorResponse(401, "not_authenticated");
  }

  let body: SaveApiKeyRequestBody;
  try {
    body = await request.json();
  } catch {
    return authErrorResponse(400, "bad_request", "invalid JSON body");
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return authErrorResponse(400, "bad_request", "apiKey is required");
  }

  await updateApiKeyEnc(userId, encryptSecret(apiKey));
  return Response.json({ hasApiKey: true });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return authErrorResponse(401, "not_authenticated");
  }

  await updateApiKeyEnc(userId, null);
  return Response.json({ hasApiKey: false });
}
