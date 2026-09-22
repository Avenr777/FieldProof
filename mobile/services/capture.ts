import { Platform } from "react-native";
import { API_URL } from "../constants/config";
import { getToken } from "./auth";
import { ApiError } from "./api";
import type { CaptureSession } from "./templates";

export type LocalCaptureFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export type CaptureCreated = {
  id: string;
  job_id: string;
  kind: "voice" | "photo";
  status: "queued";
  technician_id: string | null;
  template_id: string | null;
};

function parseResponse(text: string): CaptureCreated | null {
  try { return JSON.parse(text) as CaptureCreated; } catch { return null; }
}

/** Uploads exactly one file, because the backend POST /capture contract accepts one UploadFile. */
export async function uploadCapture(
  session: CaptureSession,
  kind: "voice" | "photo",
  file: LocalCaptureFile,
  onProgress?: (fraction: number) => void
): Promise<CaptureCreated> {
  const token = await getToken();
  if (!token) throw new ApiError(401, "Your session has expired. Please sign in again.");

  const form = new FormData();
  form.append("job_id", session.job_id);
  form.append("kind", kind);
  if (session.template_id) form.append("template_id", session.template_id);

  if (Platform.OS === "web") {
    const res = await fetch(file.uri);
    const blob = await res.blob();
    form.append("file", blob, file.name);
  } else {
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as never);
  }

  return new Promise<CaptureCreated>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/capture`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.timeout = 60000; // give up instead of hanging at 100% forever
    let settled = false;
    const fail = (error: ApiError) => {
      if (!settled) { settled = true; reject(error); }
    };
    const succeed = (value: CaptureCreated) => {
      if (!settled) { settled = true; resolve(value); }
    };
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(0.99, event.loaded / event.total));
    };
    xhr.ontimeout = () => fail(new ApiError(0, "Upload timed out. Check your connection and try again."));
    xhr.onerror = () => fail(new ApiError(0, "Network error. Check the API URL and Wi-Fi connection."));
    xhr.onabort = () => fail(new ApiError(0, "Upload cancelled."));
    xhr.onload = () => {
      const parsed = parseResponse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && parsed) {
        onProgress?.(1);
        succeed(parsed);
      } else {
        fail(new ApiError(xhr.status, parsed ? "Upload failed" : xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.send(form);
  });
}
