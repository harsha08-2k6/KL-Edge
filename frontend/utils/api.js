const API_BASE = import.meta.env.VITE_API_BASE || "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchCaptcha() {
  const response = await fetch(`${API_BASE}/api/captcha`);
  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse captcha response from server", response.status);
  }

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

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse sync response from server", response.status);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Sync failed", response.status);
  }

  return payload;
}

export async function fetchLatestSync(erpId) {
  if (!erpId) return null;
  const response = await fetch(`${API_BASE}/api/latest-sync?erpId=${encodeURIComponent(erpId)}`);
  const payload = await response.json();

  if (!response.ok) {
    return null;
  }

  return payload;
}

export async function fetchFaculty() {
  // Try to get from localStorage cache first for instant load
  const cached = localStorage.getItem("faculty_cache");
  const cachedTime = localStorage.getItem("faculty_cache_time");
  const now = Date.now();
  
  // Use cache if less than 24 hours old
  if (cached && cachedTime) {
    const age = now - parseInt(cachedTime);
    if (age < 24 * 60 * 60 * 1000) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache, continue to fetch
      }
    }
  }
  
  const response = await fetch(`${API_BASE}/api/faculty`);
  if (!response.ok) return [];
  const data = await response.json();
  
  // Cache the result
  try {
    localStorage.setItem("faculty_cache", JSON.stringify(data));
    localStorage.setItem("faculty_cache_time", now.toString());
  } catch {
    // Storage full or unavailable
  }
  
  return data;
}

export async function fetchPortalStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/portal-status`);
    if (!response.ok) return { status: "offline" };
    return await response.json();
  } catch {
    return { status: "offline" };
  }
}

export async function fetchNotice() {
  try {
    const response = await fetch(`${API_BASE}/api/notice`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.notice;
  } catch {
    return null;
  }
}

export async function updateNotice(erpId, title, content, expiresInHours, pdfFile) {
  const formData = new FormData();
  formData.append("erpId", erpId);
  formData.append("title", title);
  formData.append("content", content);
  formData.append("expiresInHours", String(expiresInHours));
  if (pdfFile) {
    formData.append("pdf", pdfFile);
  }

  const response = await fetch(`${API_BASE}/api/notice/update`, {
    method: "POST",
    body: formData
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse update notice response from server", response.status);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Failed to update notice", response.status);
  }

  return payload;
}
