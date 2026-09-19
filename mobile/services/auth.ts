import { request } from "./api";
import { clearAccessToken, readAccessToken, saveAccessToken } from "./tokenStorage";

export type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  business_id: string;
};

type TokenResponse = { access_token: string; token_type: "bearer" };

export async function getToken(): Promise<string | null> {
  return readAccessToken();
}

export async function login(email: string, password: string): Promise<User> {
  const token = await request<TokenResponse>("/auth/login", {
    method: "POST",
    authenticated: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password })
  });
  await saveAccessToken(token.access_token);
  try {
    return await getCurrentUser();
  } catch (error) {
    await clearAccessToken();
    throw error;
  }
}

export function getCurrentUser(): Promise<User> {
  return request<User>("/auth/me");
}

export function logout(): Promise<void> {
  return clearAccessToken();
}
