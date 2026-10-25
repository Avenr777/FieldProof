import { request } from "./api";

export type TemplateFieldMapping = {
  field: string;
  source: string;
  confidence: number;
};

export type RequiredProofType = "photo" | "voice" | "form_fill" | "text_note";

export type Template = {
  id: string;
  name: string;
  trade: string;
  field_map: TemplateFieldMapping[];
  times_used: number;
  technician_id?: string | null;
  assigned_at?: string | null;
  assigned_technician_ids?: string[];
  updated_at: string;
  assignment_type?: "one_time" | "repeating";
  frequency?: "daily" | "weekly" | "monthly" | "custom" | null;
  frequency_details?: Record<string, any> | null;
  due_date?: string | null;
  notes?: string | null;
  required_proof_types?: RequiredProofType[] | null;
  min_photos?: number | null;
  require_voice?: boolean | null;
  technician_instructions?: string | null;
};

export type CaptureSession = {
  job_id: string;
  template_id: string | null;
  template_name: string | null;
  technician_id: string | null;
  required_proof_types: RequiredProofType[];
  min_photos: number;
  require_voice: boolean;
  technician_instructions: string | null;
  notes: string | null;
};

export function getMyTemplates(): Promise<Template[]> {
  return request<Template[]>("/templates/my");
}

export async function getAssignedTemplates(): Promise<Template[]> {
  return request<Template[]>("/templates/assigned");
}

export function startCaptureSession(templateId: string): Promise<CaptureSession> {
  return request<CaptureSession>("/capture/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId }),
  });
}

export interface TemplateField {
  field_id: string;
  label?: string;
  field_type?: string;
  kind?: string;
  locator?: any;
}

export interface TemplateExtraction {
  fields: TemplateField[];
  statistics?: any;
}

export async function getTemplateFields(templateId: string): Promise<TemplateExtraction> {
  return request<TemplateExtraction>(`/templates/${templateId}/fields`);
}

export async function fillTemplate(templateId: string, jobId: string, values: Record<string, any>) {
  return request<any>(`/templates/${templateId}/fill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, values }),
  });
}
