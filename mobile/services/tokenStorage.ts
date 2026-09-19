import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "fieldproof.access_token";

/** Native platforms use encrypted SecureStore. Browsers have no equivalent,
 * so web development uses session-local browser storage instead. */
export async function readAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.sessionStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveAccessToken(token: string): Promise<void> {
  if (Platform.OS === "web") { globalThis.sessionStorage?.setItem(TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === "web") { globalThis.sessionStorage?.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
