export class AuthRequiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "AuthRequiredError";
  }
}

export class ApiError extends Error {
  constructor(public data: unknown) {
    super("API error");
    this.name = "ApiError";
  }
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401 && (data as { error?: { code?: string } })?.error?.code === "not_authenticated") {
    window.dispatchEvent(new Event("arabicwords:auth-expired"));
    throw new AuthRequiredError();
  }

  if (!response.ok) {
    throw new ApiError(data);
  }

  return data as T;
}

export const getJson = <T>(url: string) => sendJson<T>(url, "GET");
export const postJson = <T>(url: string, body: unknown) => sendJson<T>(url, "POST", body);
export const putJson = <T>(url: string, body: unknown) => sendJson<T>(url, "PUT", body);
export const deleteJson = <T>(url: string) => sendJson<T>(url, "DELETE");
