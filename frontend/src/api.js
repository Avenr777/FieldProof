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
export const API_BASE_URL = BASE_URL;

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
 *
 * field_map here is a SUMMARY view — [{ field, source, confidence }] — meant
 * for the template gallery card. For the full extracted field list (with
 * field_id, field_type, and locator, needed to actually fill the template),
 * use getTemplateFields() below.
 */
export async function getTemplates() {
  return apiFetch("/templates");
}

/**
 * Get a single template by ID (includes its summary field_map).
 * @param {string} templateId
 */
export async function getTemplate(templateId) {
  return apiFetch(`/templates/${templateId}`);
}

/**
 * Upload an existing company form (.docx) as a new template. The backend
 * runs docx_extractor over it (blank/checkbox detection, label inference,
 * table field mapping) and returns the created TemplateOut, including a
 * summary field_map. This is what powers the "Upload a PDF or Word form"
 * card in TemplatesView.
 *
 * @param {{ name: string, trade: string, file: File }} params
 */
export async function uploadTemplate({ name, trade, file }) {
  const form = new FormData();
  form.append("name", name);
  form.append("trade", trade);
  form.append("file", file);
  return apiFetch("/templates/upload", { method: "POST", body: form });
}

/**
 * Fetch the FULL extracted field list for a template — every blank,
 * checkbox, and empty table cell docx_extractor found, each with a
 * field_id, inferred label, field_type ("text" | "date" | "checkbox" |
 * "multiline_text" | "number" | ...), and its locator in the document.
 *
 * This is what the admin review screen renders as an editable form: one
 * input per field_id, pre-filled with nothing, type-appropriate (date
 * picker for "date", checkbox for "checkbox", textarea for
 * "multiline_text", plain input otherwise).
 *
 * Throws (404) if the template wasn't a .docx upload — non-docx templates
 * only have the summary field_map from getTemplates(), with no write-back
 * path yet.
 *
 * @param {string} templateId
 * @returns {Promise<{ document: object, elements: object[], fields: object[], images: object[], statistics: object }>}
 */
export async function getTemplateFields(templateId) {
  return apiFetch(`/templates/${templateId}/fields`);
}

/**
 * Update an extracted field's label or field_type on a template.
 * @param {string} templateId
 * @param {string} fieldId
 * @param {{ label?: string, field_type?: string }} payload
 * @returns {Promise<{ field: object, extraction: object }>}
 */
export async function updateTemplateField(templateId, fieldId, payload) {
  return apiFetch(`/templates/${templateId}/fields/${fieldId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Fill a template with admin-supplied values and generate a completed
 * .docx document for the given job. `values` keys are field_id strings
 * from getTemplateFields() (e.g. "p1-b0", "t0-r1-c1-p0"); most values are
 * strings, checkbox-type fields take a boolean.
 *
 * Returns a DocumentOut — the same shape as items in getDocuments() — so
 * the newly generated document shows up in DocumentsView same as an
 * AI-drafted one, status "Pending Review".
 *
 * @param {string} templateId
 * @param {string} jobId
 * @param {Record<string, string|boolean>} values
 */
export async function fillTemplate(templateId, jobId, values) {
  return apiFetch(`/templates/${templateId}/fill`, {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, values }),
  });
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
 * Returns { total_jobs, flagged_jobs, compliance_rate }
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
  const fileName = file.name || (kind === "voice" ? "recording.webm" : "photo.jpg");
  form.append("file", file, fileName);
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
 *   { event: "document_reviewed", document_id: string, status: string }
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
