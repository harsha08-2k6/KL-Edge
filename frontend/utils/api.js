const isProduction = import.meta.env.PROD;
const API_BASE = import.meta.env.VITE_API_BASE || (isProduction ? "/_/backend" : "http://localhost:8000");

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchCaptcha() {
  const response = await fetch(`${API_BASE}/api/captcha`);
  const payload = await response.json();

  if (!response.ok) {
    throw new ApiError(payload?.error || "Could not load ERP captcha", response.status);
  }

  return payload;
}

export async function syncAttendance({ erpId, password, captcha, academicYear, semesterId, captchaSessionId }) {
  const response = await fetch(`${API_BASE}/api/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ erpId, password, captcha, academicYear, semesterId, captchaSessionId })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new ApiError(payload?.error || "Sync failed", response.status);
  }

  return payload;
}

export async function fetchFaculty() {
  const response = await fetch(`${API_BASE}/api/faculty`);
  if (!response.ok) return [];
  return response.json();
}
