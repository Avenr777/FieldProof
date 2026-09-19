import { Platform } from "react-native";

function getDefaultApiUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return "http://127.0.0.1:8000";
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
