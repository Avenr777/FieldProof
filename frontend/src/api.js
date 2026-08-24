/**
 * api.js — FieldProof API service layer
 *
 * All communication with the FastAPI backend (http://localhost:8000) goes
 * through this file. Components import named functions (login, getJobs, etc.)
 * and never call fetch() directly.
 *
 * TOKEN STORAGE: The JWT is kept in a module-level variable (_token).
 * This is intentionally in-memory only — it is NOT stored in localStorage
 * or sessionStorage. This means the token is cleared on a page refresh,
 * requiring the user to log in again. This trade-off was chosen for security
 * (no token persistence on disk / browser storage) and compatibility with
 * Claude artifact sandboxes where localStorage access may be restricted.
 * See README.md § "Authentication & token storage" for details.
 */

const BASE_URL = "http://localhost:8000";

// ─── In-memory token store ────────────────────────────────────────────────────
let _token = null;

export function setToken(token) {
  _token = token;
}

export function clearToken() {
  _token = null;
}

export function getToken() {
  return _token;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * apiFetch wraps the native fetch() with:
 *   - Base URL prepending
 *   - Authorization header injection (when token is set)
 *   - JSON Content-Type for non-FormData bodies
 *   - Unified error handling (throws on non-2xx)
 */
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  // Inject auth header if we have a token
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  // Auto-set JSON content-type unless sending FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch (_) { /* ignore parse errors */ }
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  // 204 No Content — return null
  if (res.status === 204) return null;

  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Login with email + password.
 * Returns { access_token, token_type }.
 * Call setToken(result.access_token) after this to authenticate further calls.
 */
export async function login(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Create a new business account.
 * Returns { access_token, token_type }.
 */
export async function signup({ business_name, full_name, email, password, primary_trade = "General" }) {
  return apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ business_name, full_name, email, password, primary_trade }),
  });
}

/**
 * Fetch the currently authenticated user's profile.
 * Returns UserOut: { id, full_name, email, role, business_id }.
 */
export async function getMe() {
  return apiFetch("/auth/me");
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

/**
 * List jobs for the current business.
 * @param {string} [statusFilter] - Optional status to filter by (e.g. "In Progress")
 */
export async function getJobs(statusFilter = null) {
  const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  return apiFetch(`/jobs${qs}`);
}

/**
 * Create a new job.
 * @param {{ customer, site_address, job_type, technician_id, notes, scheduled_at }} payload
 */
export async function createJob(payload) {
  return apiFetch("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update a job's status, technician, or notes.
 * @param {string} jobId
 * @param {{ status, technician_id, notes }} payload
 */
export async function updateJob(jobId, payload) {
  return apiFetch(`/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ─── Technicians ──────────────────────────────────────────────────────────────

/**
 * List all technicians in the current business.
 * Returns TechnicianOut[]: { id, name, trade, status, compliance_pct, active_jobs, docs_this_week }
 */
export async function getTechnicians() {
  return apiFetch("/technicians");
}

/**
 * Invite (create) a new technician.
 * @param {{ name, trade }} payload
 */
export async function createTechnician(payload) {
  return apiFetch("/technicians", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * List all document templates for the current business.
 * Returns TemplateOut[]: { id, name, trade, field_map, times_used, updated_at }
 */
export async function getTemplates() {
  return apiFetch("/templates");
}

/**
 * Get a single template by ID (includes its full field_map).
 * @param {string} templateId
 */
export async function getTemplate(templateId) {
  return apiFetch(`/templates/${templateId}`);
}

// ─── Documents ───────────────────────────────────────────────────────────────

/**
 * List all generated documents for the current business.
 * Returns DocumentOut[]: { id, job_id, name, extracted_fields, overall_confidence, status, created_at }
 */
export async function getDocuments() {
  return apiFetch("/documents");
}

/**
 * Approve or request changes on a document.
 * @param {string} docId
 * @param {"approve"|"request_changes"} action
 * @param {string} [comment]
 */
export async function reviewDocument(docId, action, comment = null) {
  return apiFetch(`/documents/${docId}/review`, {
    method: "POST",
    body: JSON.stringify({ action, comment }),
  });
}

// ─── Compliance ───────────────────────────────────────────────────────────────

/**
 * List compliance rules (required fields per trade).
 * Returns ComplianceRuleOut[]: { id, trade, required_fields }
 */
export async function getComplianceRules() {
  return apiFetch("/compliance/rules");
}

/**
 * List recent compliance events (alert log).
 * Returns ComplianceEventOut[]: { id, job_id, message, severity, resolved, created_at }
 */
export async function getComplianceEvents() {
  return apiFetch("/compliance/events");
}

/**
 * Get the overall compliance rate for the business.
 * Returns { rate: number }
 */
export async function getComplianceRate() {
  return apiFetch("/compliance/rate");
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Fetch the analytics summary used by OverviewView and AnalyticsView.
 * Returns AnalyticsSummary: {
 *   active_jobs_today, documents_pending_review, open_compliance_alerts,
 *   ai_auto_approval_rate, avg_documentation_accuracy,
 *   weekly_docs, documentation_time_trend, accuracy_trend, compliance_trend
 * }
 */
export async function getAnalyticsSummary() {
  return apiFetch("/analytics/summary");
}

// ─── Capture ─────────────────────────────────────────────────────────────────

/**
 * Upload a voice note or photo capture tied to a job.
 * @param {string} jobId
 * @param {"voice"|"photo"} kind
 * @param {File} file
 */
export async function uploadCapture(jobId, kind, file) {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("kind", kind);
  form.append("file", file);
  return apiFetch("/capture", { method: "POST", body: form });
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

/**
 * Open a WebSocket connection to /ws for live dashboard updates.
 * Returns the WebSocket instance so the caller can close it on unmount.
 *
 * Events pushed by the server:
 *   { event: "job_created",      job_id: string }
 *   { event: "job_updated",      job_id: string, status: string }
 *   { event: "document_reviewed", document_id: string }
 *
 * @param {(data: object) => void} onMessage - called with parsed JSON on each message
 * @param {() => void} [onClose] - called when the socket closes
 */
export function connectWebSocket(onMessage, onClose) {
  const wsUrl = BASE_URL.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      onMessage(data);
    } catch (_) { /* ignore malformed frames */ }
  };

  ws.onerror = (e) => {
    console.warn("[FieldProof WS] connection error", e);
  };

  if (onClose) {
    ws.onclose = onClose;
  }

  return ws;
}
