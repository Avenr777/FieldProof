import { request } from "./api";

export type Job = {
  id: string;
  customer: string;
  site_address: string | null;
  job_type: string;
  technician_id: string | null;
  status: string;
  notes: string | null;
  scheduled_at: string | null;
  created_at: string;
};

export function getJobs(): Promise<Job[]> {
  return request<Job[]>("/jobs");
}

export function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(jobId)}`);
}
