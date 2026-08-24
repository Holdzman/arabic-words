import type { SaveWordsRequestBody, Word } from "@/lib/types";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { getSessionUserId } from "@/lib/server/session";
import { findUserById, updateWords } from "@/lib/server/users";

const MAX_WORDS = 5000;

function isValidWords(input: unknown): input is Word[] {
  if (!Array.isArray(input) || input.length > MAX_WORDS) return false;
  return input.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as Word).id === "string" &&
      typeof (item as Word).text === "string" &&
      typeof (item as Word).translation === "string" &&
      typeof (item as Word).isLearned === "boolean" &&
      typeof (item as Word).dateAdded === "string"
  );
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return authErrorResponse(401, "not_authenticated");
  }

  const user = await findUserById(userId);
  if (!user) {
    return authErrorResponse(401, "not_authenticated");
  }

  return Response.json({ words: user.words });
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return authErrorResponse(401, "not_authenticated");
  }

  let body: SaveWordsRequestBody;
  try {
    body = await request.json();
  } catch {
    return authErrorResponse(400, "bad_request", "invalid JSON body");
  }

  if (!isValidWords(body.words)) {
    return authErrorResponse(400, "bad_request", "invalid words payload");
  }

  await updateWords(userId, body.words);
  return Response.json({ words: body.words });
}
