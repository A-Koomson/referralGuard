/** Central API client — session cookies + CSRF; never localStorage tokens. */

export type ApiError = {
  error: {
    code: string;
    message: string | Record<string, unknown>;
    status: number;
    details?: unknown;
  };
};

let csrfToken: string | null = null;

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch("/api/v1/auth/csrf/", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to obtain CSRF cookie");
  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const token = await ensureCsrf();
    headers.set("X-CSRFToken", token);
  }
  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as ApiError)?.error?.message ||
      (data as { detail?: string }).detail ||
      res.statusText;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data as T;
}

export const authApi = {
  csrf: () => ensureCsrf(),
  login: (email: string, password: string) =>
    api<{ user: User }>("/api/v1/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => api<{ detail: string }>("/api/v1/auth/logout/", { method: "POST" }),
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
  analyse: (id: string) =>
    api<{ referral: ReferralCase; findings_created: number }>(
      `/api/v1/referrals/${id}/analyse/`,
      { method: "POST" },
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
