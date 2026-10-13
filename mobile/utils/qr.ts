/**
 * FieldProof QR payloads.
 *
 * Two QR formats are supported:
 *
 *  1. Server config QR — encodes the API base URL so a technician can scan
 *     once and never worry about 127.0.0.1 vs the LAN IP again.
 *        Plaintext:  fp://api/<url-encoded-url>
 *        Example:    fp://api/http%3A%2F%2F192.168.1.42%3A8000
 *
 *  2. Login QR — encodes an operator-issued one-time login token so a
 *     technician can sign in by scanning instead of typing email + password.
 *        Plaintext:  fp://login/<base64url:user_id:timestamp:nonce>
 *        The backend validates the token via GET /auth/qr-login.
 */

export type QrPayload =
  | { kind: "api-url"; url: string }
  | { kind: "login"; token: string }
  | { kind: "unknown"; raw: string };

const API_PREFIX = "fp://api/";
const LOGIN_PREFIX = "fp://login/";

/** Parse a QR code string into a typed FieldProof payload, or unknown. */
export function parseQrPayload(raw: string): QrPayload {
  const trimmed = raw.trim();

  if (trimmed.startsWith(API_PREFIX)) {
    const encoded = trimmed.slice(API_PREFIX.length);
    try {
      const url = decodeURIComponent(encoded);
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return { kind: "api-url", url };
      }
    } catch {
      /* fall through to unknown */
    }
  }

  if (trimmed.startsWith(LOGIN_PREFIX)) {
    const token = trimmed.slice(LOGIN_PREFIX.length);
    if (token.length > 0) {
      return { kind: "login", token };
    }
  }

  return { kind: "unknown", raw: trimmed };
}

/**
 * Build a server-config QR payload string for display/printing by the operator.
 * Pass the plain API URL (e.g. "https://fieldproof.example.com" or
 * "http://192.168.1.42:8000").
 */
export function buildApiUrlQrText(url: string): string {
  return API_PREFIX + encodeURIComponent(url.replace(/\/+$/, ""));
}
