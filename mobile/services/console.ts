import { request } from "./api";

/* Owner/admin mobile console: mirrors the dashboard's data for the
   small screen. Every helper reuses the authenticated request wrapper. */

export type AnalyticsSummary = {
  active_jobs_today: number;
  documents_pending_review: number;
  open_compliance_alerts: number;
  ai_auto_approval_rate: number;
  avg_documentation_accuracy: number;
};

export function getConsoleSummary(): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>("/analytics/summary");
}

export type Technician = {
  id: string;
  name: string;
  trade: string;
  status: string;
  compliance_pct: number;
  active_jobs: number;
  docs_this_week: number;
  user_id: string | null;
  uploads_count: number;
};

export function getTechnicians(): Promise<Technician[]> {
  return request<Technician[]>("/technicians");
}

export type TechnicianDetail = {
  technician: Technician;
  assigned_templates: { id: string; name: string; trade: string; assigned_at: string | null }[];
  captures: {
    id: string;
    job_id: string | null;
    template_id: string | null;
    kind: "voice" | "photo";
    file_url: string;
    processed: boolean;
    transcript: string | null;
    created_at: string;
  }[];
  documents: {
    id: string;
    job_id: string;
    name: string;
    overall_confidence: number;
    status: string;
    file_url: string | null;
    created_at: string;
  }[];
};

export function getTechnicianDetail(technicianId: string): Promise<TechnicianDetail> {
  return request<TechnicianDetail>(`/technicians/${encodeURIComponent(technicianId)}/detail`);
}

export type ConsoleDocument = {
  id: string;
  job_id: string;
  name: string;
  overall_confidence: number;
  status: string;
  file_url: string | null;
  created_at: string;
};

export function getDocuments(): Promise<ConsoleDocument[]> {
  return request<ConsoleDocument[]>("/documents");
}
