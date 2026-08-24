import { getSessionUserId } from "@/lib/server/session";
import { findUserById } from "@/lib/server/users";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ authenticated: false });
  }

  const user = await findUserById(userId);
  if (!user) {
    return Response.json({ authenticated: false });
  }

  return Response.json({ authenticated: true, username: user.username });
}
