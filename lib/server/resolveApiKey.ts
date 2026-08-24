import { getSessionUserId } from "./session";
import { findUserById } from "./users";
import { decryptSecret } from "./crypto";

export async function resolveSessionApiKey(): Promise<{ userId: string; apiKey: string | null } | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await findUserById(userId);
  if (!user) return null;

  return {
    userId,
    apiKey: user.api_key_enc ? decryptSecret(user.api_key_enc) : null,
  };
}
