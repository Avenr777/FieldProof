import { request } from "./api";

export type TemplateFieldMapping = {
  field: string;
  source: string;
  confidence: number;
};

export type Template = {
  id: string;
  name: string;
  trade: string;
  field_map: TemplateFieldMapping[];
  times_used: number;
  technician_id: string | null;
  assigned_at: string | null;
  updated_at: string;
};

/** Templates the operator assigned to the signed-in technician (first page). */
export function getMyTemplates(): Promise<Template[]> {
  return request<Template[]>("/templates/my");
}

export type CaptureSession = {
  job_id: string;
  template_id: string | null;
  template_name: string | null;
  technician_id: string | null;
};

/** Opens a capture session against an assigned template (auto-creates the grouping job). */
export function startCaptureSession(templateId: string): Promise<CaptureSession> {
  return request<CaptureSession>("/capture/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId }),
  });
}
