import { API_URL, readScannedUrl } from "../constants/config";
import { readAccessToken } from "./tokenStorage";

type ApiOptions = RequestInit & { authenticated?: boolean };

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // A non-JSON error response still has a useful HTTP status below.
  }
  return `Request failed (${response.status})`;
}

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [800, 2000];

/**
 * Wraps a fetch call with retry-on-failure and exponential-ish backoff.
 * Retries only on network errors and 5xx responses — never on 4xx (those
 * are real client errors that retrying won't fix).
 */
export async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { authenticated = true, headers, ...init } = options;
  const token = authenticated ? await readAccessToken() : null;

  // Use a scanned API URL if one was persisted (overrides the compile-time default).
  const baseUrl = (await readScannedUrl()) || API_URL;

  const body = { ...init, headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } };

  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${baseUrl}${path}`, body);
      if (!response.ok) {
        const err = new ApiError(response.status, await errorMessage(response));
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = err;
          await sleep(RETRY_DELAYS_MS[attempt] ?? 2000);
          continue;
        }
        throw err;
      }
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    } catch (e) {
      if (e instanceof ApiError) throw e; // non-retryable (4xx, or 5xx with no retries left)
      if (attempt < MAX_RETRIES) {
        lastError = new ApiError(0, "Network error — retrying…");
        await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
        continue;
      }
      throw new ApiError(0, `Connection failed after ${MAX_RETRIES + 1} attempts. Check the server URL and Wi-Fi.`);
    }
  }
  // Unreachable, but TypeScript wants a return.
  throw lastError ?? new ApiError(0, "Unknown error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
