import { getJson, postJson, putJson, deleteJson, ApiError } from "./api";
import { authErrorMessage } from "./authErrorMessages";
import type {
  SessionResponse,
  SignupRequestBody,
  SignupResponse,
  LoginRequestBody,
  LoginResponse,
  ApiKeyStatusResponse,
  SaveApiKeyRequestBody,
  AuthErrorResponse,
  Word,
} from "./types";

export class AuthError extends Error {
  constructor(public code: AuthErrorResponse["error"]["code"], message: string) {
    super(message);
    this.name = "AuthError";
  }
}

let cachedHasApiKey = false;

export function hasApiKeyCached(): boolean {
  return cachedHasApiKey;
}

function raiseAuthError(err: unknown): never {
  const data = err instanceof ApiError ? (err.data as AuthErrorResponse) : null;
  const code = data?.error?.code ?? "unknown";
  throw new AuthError(code, authErrorMessage(code, data?.error?.message));
}

export const getSession = () => getJson<SessionResponse>("/api/auth/session");

export async function signup(
  username: string,
  password: string,
  signupCode: string,
  importWords?: Word[]
): Promise<SignupResponse> {
  try {
    return await postJson<SignupResponse>("/api/auth/signup", {
      username,
      password,
      signupCode,
      importWords,
    } satisfies SignupRequestBody);
  } catch (err) {
    raiseAuthError(err);
  }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    return await postJson<LoginResponse>("/api/auth/login", { username, password } satisfies LoginRequestBody);
  } catch (err) {
    raiseAuthError(err);
  }
}

export async function logout(): Promise<void> {
  await postJson("/api/auth/logout", {});
  cachedHasApiKey = false;
}

export async function getApiKeyStatus(): Promise<ApiKeyStatusResponse> {
  const res = await getJson<ApiKeyStatusResponse>("/api/account/api-key");
  cachedHasApiKey = res.hasApiKey;
  return res;
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const res = await putJson<ApiKeyStatusResponse>("/api/account/api-key", { apiKey } satisfies SaveApiKeyRequestBody);
  cachedHasApiKey = res.hasApiKey;
}

export async function deleteApiKey(): Promise<void> {
  const res = await deleteJson<ApiKeyStatusResponse>("/api/account/api-key");
  cachedHasApiKey = res.hasApiKey;
}
