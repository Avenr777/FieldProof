import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * The mobile app reads its API base URL from three sources, in order:
 *  1. EXPO_PUBLIC_API_URL env var ( set via eas.json / .env / npx expo run )
 *  2. A QR-scanned value persisted to SecureStore under the key below
 *  3. A sensible platform-specific default
 *
 * On a physical phone on the same Wi-Fi as the dev machine, the default
 * 127.0.0.1 / 10.0.2.2 will NOT work — the phone needs the machine's LAN
 * address (e.g. 192.168.1.42:8000). Use the Server Config screen (QR scan
 * or manual entry) to set it once; the value survives app restarts.
 */
export const SCANED_CONFIG_KEY = "fieldproof.scaned_api_url";

function getDefaultApiUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return "http://127.0.0.1:8000";
}

/** Read a QR-scanned API URL previously persisted to SecureStore. */
export async function readScannedUrl(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return (globalThis as { sessionStorage?: { getItem: (k: string) => string | null } }).sessionStorage?.getItem(SCANED_CONFIG_KEY) ?? null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(SCANED_CONFIG_KEY);
  } catch {
    return null;
  }
}

/** Persist a QR-scanned API URL so the app remembers it across restarts. */
export async function writeScannedUrl(url: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      (globalThis as { sessionStorage?: { setItem: (k: string, v: string) => void } }).sessionStorage?.setItem(SCANED_CONFIG_KEY, url);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(SCANED_CONFIG_KEY, url);
  } catch {
    /* ignore */
  }
}

/** Clear a previously scanned URL. */
export async function clearScannedUrl(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      (globalThis as { sessionStorage?: { removeItem: (k: string) => void } }).sessionStorage?.removeItem(SCANED_CONFIG_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(SCANED_CONFIG_KEY);
  } catch {
    /* ignore */
  }
}

let configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

// On web, 10.0.2.2 is an Android-emulator-only address and cannot be reached by a browser.
// Automatically resolve to the browser host/127.0.0.1 so copying .env.example doesn't break web mode.
if (Platform.OS === "web" && configuredUrl && configuredUrl.includes("10.0.2.2")) {
  const host = typeof window !== "undefined" && window.location?.hostname ? window.location.hostname : "127.0.0.1";
  configuredUrl = configuredUrl.replace("10.0.2.2", host);
}

if (!configuredUrl) {
  console.warn("EXPO_PUBLIC_API_URL is not configured. Falling back to default URL for " + Platform.OS);
}

/** Base URL for the FastAPI server; no trailing slash. */
export const API_URL = (configuredUrl || getDefaultApiUrl()).replace(/\/$/, "");

