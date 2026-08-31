/** Central API client — session cookies + CSRF; never localStorage tokens. */

export type ApiError = {
  error: {
    code: string;
    message: string | Record<string, unknown>;
    status: number;
    details?: unknown;
  };
};

/** In-memory cache; always prefer the live `csrftoken` cookie after login rotates it. */
let csrfToken: string | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

async function ensureCsrf(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cookie = readCsrfCookie();
    if (cookie) {
      csrfToken = cookie;
      return cookie;
    }
    if (csrfToken) return csrfToken;
  }

  const res = await fetch("/api/v1/auth/csrf/", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to obtain CSRF cookie");
  const data = (await res.json()) as { csrfToken?: string };
  const cookie = readCsrfCookie();
  csrfToken = cookie || data.csrfToken || null;
  if (!csrfToken) throw new Error("CSRF token missing after /csrf/ request");
  return csrfToken;
}

function isCsrfFailure(status: number, message: string): boolean {
  if (status !== 403) return false;
  const lower = message.toLowerCase();
  return lower.includes("csrf");
}

function formatErrorMessage(data: unknown, res: Response, path: string): string {
  const err = (data as ApiError)?.error;
  const rawMessage =
    err?.message ||
    (data as { detail?: string }).detail ||
    res.statusText;
  const hint =
    err && typeof err === "object" && "hint" in err
      ? String((err as { hint?: string }).hint || "")
      : "";
  let base = typeof rawMessage === "string" ? rawMessage : JSON.stringify(rawMessage);
  if (res.status === 404 && path.includes("/evaluation/")) {
    base =
      "Evaluation API not found. Restart the Django backend: python backend/manage.py runserver 127.0.0.1:8000";
  }
  return hint ? `${base} — ${hint}` : base;
}

async function requestOnce(path: string, options: RequestInit, forceCsrf: boolean): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const token = await ensureCsrf(forceCsrf);
    headers.set("X-CSRFToken", token);
  }
  return fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res = await requestOnce(path, options, false);
  if (res.status === 204) return undefined as T;

  let data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = formatErrorMessage(data, res, path);
    const method = (options.method || "GET").toUpperCase();
    // Login rotates Django's CSRF token; retry once with a fresh cookie/header.
    if (method !== "GET" && method !== "HEAD" && isCsrfFailure(res.status, message)) {
      clearCsrfToken();
      res = await requestOnce(path, options, true);
      if (res.status === 204) return undefined as T;
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatErrorMessage(data, res, path));
      }
      return data as T;
    }
    throw new Error(message);
  }
  return data as T;
}

export const authApi = {
  csrf: () => ensureCsrf(),
  login: async (email: string, password: string) => {
    // Ensure a cookie exists before the login POST.
    await ensureCsrf(true);
    const result = await api<{ user: User }>("/api/v1/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    // Django rotates CSRF on login — drop cache and refresh cookie.
    clearCsrfToken();
    await ensureCsrf(true);
    return result;
  },
  logout: async () => {
    const result = await api<{ detail: string }>("/api/v1/auth/logout/", { method: "POST" });
    clearCsrfToken();
    return result;
  },
  me: () => api<{ user: User; disclaimer: string }>("/api/v1/auth/me/"),
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  facility: string | null;
  facility_name?: string | null;
  is_active: boolean;
};

export type ReferralCase = {
  id: string;
  synthetic_case_id: string;
  status: string;
  urgency: string;
  referral_reason: string;
  gestational_age_weeks: string | number | null;
  gravida: number | null;
  para: number | null;
  patient_display_label: string;
  fully_verified: boolean;
  creating_facility: string;
  creating_facility_name?: string;
  clinician_confirmed_needs: string[];
  findings?: Finding[];
  observations?: Observation[];
  treatments?: Treatment[];
  updated_at: string;
};

export type Finding = {
  id: string;
  category: string;
  severity: string;
  message: string;
  evidence_citations: Array<Record<string, string>>;
  absence_stated: boolean;
  resolution_state: string;
  resolution_note?: string;
  deterministic: boolean;
};

export type Observation = {
  id: string;
  observation_type: string;
  value: string;
  unit: string;
  observed_at: string | null;
  source_reference: string;
};

export type Treatment = {
  id: string;
  treatment_name: string;
  dose: string;
  route: string;
  administered_at: string | null;
  administered_by: string;
  source_reference: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const referralsApi = {
  list: (params?: { search?: string; status?: string; ordering?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.ordering) q.set("ordering", params.ordering);
    const suffix = q.toString() ? `?${q}` : "";
    return api<Paginated<ReferralCase>>(`/api/v1/referrals/${suffix}`);
  },
  dashboardSummary: () =>
    api<{
      total: number;
      needs_attention: number;
      emergency: number;
      fully_verified: number;
      disclaimer: string;
    }>("/api/v1/referrals/dashboard-summary/"),
  get: (id: string) => api<ReferralCase>(`/api/v1/referrals/${id}/`),
  patch: (id: string, body: Partial<Pick<ReferralCase, "referral_reason" | "patient_display_label" | "gestational_age_weeks" | "gravida" | "para" | "clinician_confirmed_needs">>) =>
    api<ReferralCase>(`/api/v1/referrals/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  create: (body: Partial<ReferralCase> & { documentation_status?: Record<string, string> }) =>
    api<ReferralCase>("/api/v1/referrals/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  analyse: (id: string, body?: { referral_reason?: string }) =>
    api<{ referral: ReferralCase; findings_created: number }>(
      `/api/v1/referrals/${id}/analyse/`,
      {
        method: "POST",
        body: JSON.stringify(body || {}),
      },
    ),
  findings: (id: string) => api<Finding[]>(`/api/v1/referrals/${id}/findings/`),
  resolveFinding: (
    id: string,
    findingId: string,
    body: { resolution_state: "RESOLVED" | "ACCEPTED_RISK"; resolution_note: string },
  ) =>
    api<Finding>(`/api/v1/referrals/${id}/findings/${findingId}/resolve/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  readiness: (id: string) =>
    api<Record<string, unknown>>(`/api/v1/referrals/${id}/readiness/`),
  match: (id: string) =>
    api<unknown[]>(`/api/v1/referrals/${id}/match-facilities/`, { method: "POST" }),
  exportIncomplete: (id: string, reason: string) =>
    api<Record<string, unknown>>(`/api/v1/referrals/${id}/export-incomplete/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  approve: (id: string) =>
    api<unknown>(`/api/v1/referrals/${id}/approve/`, { method: "POST", body: "{}" }),
  matches: (id: string) => api<FacilityMatch[]>(`/api/v1/referrals/${id}/matches/`),
  accept: (
    id: string,
    body: { facility: string; decision: "ACCEPTED" | "REJECTED"; reference?: string; instructions?: string },
  ) =>
    api<unknown>(`/api/v1/referrals/${id}/accept/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  timeline: (id: string) => api<unknown[]>(`/api/v1/referrals/${id}/timeline/`),
  handoff: (id: string) => api<Record<string, unknown>>(`/api/v1/referrals/${id}/handoff/`),
  uploadEvidence: (id: string, file: File) => {
    const form = new FormData();
    form.append("referral", id);
    form.append("file", file);
    return api<Record<string, unknown>>("/api/v1/evidence/", {
      method: "POST",
      body: form,
    });
  },
};

export type FacilityMatch = {
  id: string;
  facility: string;
  facility_name: string;
  rank: number;
  distance_km: number | null;
  availability_freshness: string;
  explanation: string;
  capability_coverage: Record<
    string,
    { present?: boolean; state?: string; fresh?: boolean; expires_at?: string | null }
  >;
};

export const facilitiesApi = {
  list: () => api<Paginated<Facility>>("/api/v1/facilities/"),
  get: (id: string) => api<Facility>(`/api/v1/facilities/${id}/`),
  capabilities: () => api<Paginated<Capability>>("/api/v1/capabilities/"),
};

export type Capability = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type FacilityCapability = {
  id: string;
  capability: Capability;
  availability_state: string;
  updated_at: string;
};

export type Facility = {
  id: string;
  name: string;
  facility_type: string;
  district: string;
  region: string;
  latitude: number;
  longitude: number;
  phone_placeholder: string;
  is_fictional: boolean;
  capabilities?: FacilityCapability[];
};

export type BenchmarkSummary = {
  micro_recall?: number | null;
  micro_precision?: number | null;
  mode?: string;
  model_name?: string;
  benchmark_claim?: string;
  case_count?: number;
  comparison?: {
    baseline_micro_recall?: number | null;
    agent_micro_recall?: number | null;
    baseline_micro_precision?: number | null;
    agent_micro_precision?: number | null;
  };
};

export type BenchmarkCaseRow = {
  case_id: string;
  recall: number;
  precision: number;
  readiness_correct: boolean;
};

export type BenchmarkArtifact = {
  summary?: BenchmarkSummary;
  cases?: BenchmarkCaseRow[];
};

export type SystemSettingRow = {
  key: string;
  label: string;
  help_text: string;
  category: string;
  value: string;
  display_value: string;
  editable: boolean;
  is_secret: boolean;
  configured: boolean;
  updated_at: string;
};

export const adminApi = {
  systemSettings: () =>
    api<{
      settings: SystemSettingRow[];
      architecture_note: string;
      env_fallback: Record<string, unknown>;
    }>("/api/v1/auth/admin/system-settings/"),
  patchSystemSettings: (settings: Record<string, string>) =>
    api<{ updated: string[]; settings: SystemSettingRow[] }>(
      "/api/v1/auth/admin/system-settings/",
      { method: "PATCH", body: JSON.stringify(settings) },
    ),
  createSystemSetting: (body: {
    key: string;
    label?: string;
    value?: string;
    category?: string;
    help_text?: string;
  }) =>
    api<SystemSettingRow>("/api/v1/auth/admin/system-settings/create/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  benchmark: () =>
    api<{
      disclaimer: string;
      primary_metric: string;
      case_count: number;
      run_status?: {
        running: boolean;
        method: string | null;
        mode: string | null;
        error: string | null;
        started_at: string | null;
        finished_at: string | null;
      };
      current_llm: {
        provider: string;
        model: string;
        base_url: string;
        api_key_configured: boolean;
      };
      architecture: { baseline: string; agent: string; llm_role: string };
      artifacts: {
        comparison_live?: BenchmarkArtifact;
        baseline_live?: BenchmarkArtifact;
        agent_live?: BenchmarkArtifact;
        comparison_mock?: BenchmarkArtifact;
        baseline_mock?: BenchmarkArtifact;
        agent_mock?: BenchmarkArtifact;
      };
      last_run?: {
        method: string;
        mode: string;
        finished_at: string | null;
        error: string | null;
        case_count?: number;
        micro_recall: number | null;
        micro_precision: number | null;
        benchmark_claim?: string;
        artifact_md?: string;
        artifact_json?: string;
        comparison_md?: string;
      };
    }>("/api/v1/evaluation/benchmark/"),
  runEvaluation: (method: "baseline" | "agent", mode: "mock" | "live") =>
    api<{ status: string; method: string; mode: string; message?: string }>(
      "/api/v1/evaluation/run/",
      { method: "POST", body: JSON.stringify({ method, mode }) },
    ),
  evaluationRunStatus: () =>
    api<{
      running: boolean;
      method: string | null;
      mode: string | null;
      error: string | null;
      started_at: string | null;
      finished_at: string | null;
    }>("/api/v1/evaluation/run/status/"),
};
