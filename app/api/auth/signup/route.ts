import { randomUUID } from "node:crypto";
import type { SignupRequestBody, Word } from "@/lib/types";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { hashPassword } from "@/lib/server/password";
import { createUser, findUserByUsername } from "@/lib/server/users";
import { setSessionCookie } from "@/lib/server/session";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const MAX_IMPORT_WORDS = 5000;

function sanitizeImportWords(input: unknown): Word[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > MAX_IMPORT_WORDS) return null;

  const sanitized: Word[] = [];
  for (const item of input) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as Word).text !== "string" ||
      typeof (item as Word).translation !== "string"
    ) {
      return null;
    }
    const language = (item as Word).language;
    sanitized.push({
      id: typeof (item as Word).id === "string" ? (item as Word).id : randomUUID(),
      text: (item as Word).text,
      translation: (item as Word).translation,
      isLearned: Boolean((item as Word).isLearned),
      dateAdded:
        typeof (item as Word).dateAdded === "string" ? (item as Word).dateAdded : new Date().toISOString(),
      language: language === "it" || language === "en" ? language : "ar",
    });
  }
  return sanitized;
}

export async function POST(request: Request) {
  let body: SignupRequestBody;
  try {
    body = await request.json();
  } catch {
    return authErrorResponse(400, "bad_request", "invalid JSON body");
  }

  const expectedCode = process.env.SIGNUP_CODE;
  if (!expectedCode || body.signupCode !== expectedCode) {
    return authErrorResponse(403, "invalid_signup_code");
  }

  const username = body.username?.trim();
  if (!username || !USERNAME_RE.test(username)) {
    return authErrorResponse(400, "invalid_username");
  }

  const password = body.password ?? "";
  if (password.length < 8) {
    return authErrorResponse(400, "weak_password");
  }

  const words = sanitizeImportWords(body.importWords);
  if (words === null) {
    return authErrorResponse(400, "bad_request", "invalid importWords");
  }

  const existing = await findUserByUsername(username);
  if (existing) {
    return authErrorResponse(409, "username_taken");
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser(username, passwordHash, words);
  await setSessionCookie(user.id);

  return Response.json({ username: user.username }, { status: 201 });
}
