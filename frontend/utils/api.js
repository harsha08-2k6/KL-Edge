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

export async function syncAttendance({ erpId, password, captcha, academicYear, semesterId, captchaSessionId, forceRefresh = false, refreshTimetable = false }) {
  const response = await fetch(`${API_BASE}/api/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ erpId, password, captcha, academicYear, semesterId, captchaSessionId, forceRefresh, refreshTimetable })
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

export async function syncTimetableOnly({ erpId, password, captcha = "", academicYear, semesterId, captchaSessionId = "", forceRefresh = false }) {
  const response = await fetch(`${API_BASE}/api/timetable/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ erpId, password, captcha, academicYear, semesterId, captchaSessionId, forceRefresh })
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse timetable response from server", response.status);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Timetable sync failed", response.status);
  }

  return payload;
}



export async function fetchSeatingPlan({ erpId, academicYear, semesterId }) {
  if (!erpId || !academicYear || !semesterId) return null;
  const t0 = performance.now();
  const params = new URLSearchParams({ erpId, academicYear, semesterId });
  try {
    const response = await fetch(`${API_BASE}/api/seating-plan?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const dur = performance.now() - t0;
    console.log(`[api:timing] fetchSeatingPlan took ${dur.toFixed(2)}ms (count: ${data?.count ?? 0})`);
    return data;
  } catch {
    return null;
  }
}

export async function fetchTimetable({ erpId, academicYear, semesterId }) {
  if (!erpId || !academicYear || !semesterId) return null;
  const t0 = performance.now();
  const params = new URLSearchParams({ erpId, academicYear, semesterId });
  try {
    const response = await fetch(`${API_BASE}/api/timetable?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const dur = performance.now() - t0;
    console.log(`[api:timing] fetchTimetable took ${dur.toFixed(2)}ms (status: ${data?.status})`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Parallel resource fetcher utilizing Promise.allSettled to load multiple
 * independent portal, seating, timetable, and faculty resources concurrently.
 */
export async function fetchDashboardResources({ erpId, academicYear, semesterId }) {
  const query = { erpId, academicYear, semesterId };
  const [portalOutcome, seatingOutcome, timetableOutcome, facultyOutcome] = await Promise.allSettled([
    fetchPortalStatus(),
    erpId && academicYear && semesterId ? fetchSeatingPlan(query) : Promise.resolve(null),
    erpId && academicYear && semesterId ? fetchTimetable(query) : Promise.resolve(null),
    fetchFaculty()
  ]);

  return {
    portalStatus: portalOutcome.status === "fulfilled" ? portalOutcome.value : { status: "offline" },
    seatingPlan: seatingOutcome.status === "fulfilled" ? seatingOutcome.value?.seatingPlan || [] : [],
    timetable: timetableOutcome.status === "fulfilled" ? timetableOutcome.value : null,
    faculty: facultyOutcome.status === "fulfilled" ? facultyOutcome.value : []
  };
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

export async function connectLMS(username, password) {
  const response = await fetch(`${API_BASE}/api/lms/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse LMS connect response", response.status);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "LMS Connection failed", response.status);
  }

  return payload;
}

export async function syncLMS(lmsToken, { username = "", password = "" } = {}) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (lmsToken) {
    headers["Authorization"] = `Bearer ${lmsToken}`;
  }

  const response = await fetch(`${API_BASE}/api/lms/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username, password })
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse LMS sync response", response.status);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Failed to sync LMS assignments", response.status);
  }

  return payload;
}

export async function fetchAssignments(lmsToken) {
  const response = await fetch(`${API_BASE}/api/lms/assignments`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${lmsToken}`
    }
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new ApiError("Failed to parse LMS assignments response", response.status);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Failed to fetch assignments", response.status);
  }

  return payload;
}

export async function disconnectLMS(lmsToken) {
  const response = await fetch(`${API_BASE}/api/lms/disconnect`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lmsToken}`
    }
  });

  if (!response.ok) {
    throw new ApiError("Failed to disconnect LMS", response.status);
  }
  return { success: true };
}

/**
 * Fetch assignments for multiple tokens concurrently using Promise.allSettled.
 */
export async function fetchMultipleAssignments(tokens = []) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  const results = await Promise.allSettled(tokens.map((tok) => fetchAssignments(tok)));
  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);
}
