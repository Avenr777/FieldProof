import { Platform } from "react-native";
import { API_URL, readScannedUrl } from "../constants/config";
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

/**
 * On native, compress a photo before upload so the transfer is smaller and
 * faster on slow job-site connections. Voice notes are left untouched — they
 * are already AAC/HE-AAC and small enough.
 */
async function prepareFileForUpload(file: LocalCaptureFile): Promise<LocalCaptureFile> {
  if (Platform.OS === "web") {
    // Web: the XHR path already fetches the blob; compression is optional and
    // can be done here with canvas if needed. For now pass through.
    return file;
  }

  if (file.mimeType.startsWith("image/")) {
    // Use expo-image-manipulator to downscale to a max long edge of 1920px
    // and re-encode at 82% quality. This typically cuts a 5–12 MB photo to
    // 300–700 KB with no visible quality loss for labels/serials.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
      const IM = require("expo-image-manipulator");
      const result = await IM.saveAsync(file.uri, {
        compress: 0.82,
        format: IM.SaveFormat.JPEG,
        maxWidth: 1920,
        maxHeight: 1920,
      });
      return { uri: result.uri, name: file.name.replace(/\.[^.]+$/, ".jpg"), mimeType: "image/jpeg" };
    } catch {
      // If manipulation fails for any reason, upload the original.
      return file;
    }
  }

  return file;
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

  const baseUrl = (await readScannedUrl()) || API_URL;
  const prepared = await prepareFileForUpload(file);

  const form = new FormData();
  form.append("job_id", session.job_id);
  form.append("kind", kind);
  if (session.template_id) form.append("template_id", session.template_id);

  if (Platform.OS === "web") {
    const res = await fetch(prepared.uri);
    const blob = await res.blob();
    form.append("file", blob, prepared.name);
  } else {
    form.append("file", { uri: prepared.uri, name: prepared.name, type: prepared.mimeType } as never);
  }

  return new Promise<CaptureCreated>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/capture`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.timeout = 90000; // 90s for large photos on slow connections
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
