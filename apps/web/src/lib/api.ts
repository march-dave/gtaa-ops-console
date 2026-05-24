import type { ApiError } from "@gtaa/contracts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: ApiError | null;

  constructor(status: number, body: ApiError | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function getMockUserKey(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem("gtaa.mockUser");
  return v && v !== "none" ? v : null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  const mockKey = getMockUserKey();
  if (mockKey) headers.set("X-Mock-User", mockKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers, credentials: "include" });

  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(
      res.status,
      body,
      body?.message ?? `HTTP ${res.status}`
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
