export function classesNeededForTarget() { return 0; }
export function classesCanBunk() { return 0; }
export function classesNeeded() { return 0; }
export function calculateWeightedOverall() { return { attended: 0, conducted: 0, percentage: 0 }; }
export function calculateRealBunks() { return 0; }
export function calculateRealNeed() { return 0; }
export function getSubjectAnalytics() { return { overall: 0, weighted: "0/0", components: {} }; }

export function calculateAttendance({ L, T, P, S }) {
  let total = 0;
  let weight = 0;

  if (L !== undefined && L !== null) {
    total += Number(L);
    weight += 1;
  }
  if (T !== undefined && T !== null) {
    total += Number(T);
    weight += 1;
  }
  if (P !== undefined && P !== null) {
    total += Number(P) * 0.5;
    weight += 0.5;
  }
  if (S !== undefined && S !== null) {
    total += Number(S) * 0.25;
    weight += 0.25;
  }

  if (weight === 0) return 0;
  return Math.round(total / weight);
}

export function getFinalAttendance(subject = {}) {
  const official = Number(subject.finalPercentage ?? subject.attendancePercentage ?? subject.percentage);
  if (Number.isFinite(official) && official > 0) {
    return Math.round(official);
  }

  return calculateAttendance(subject);
}

export function calculateOverall(subjects = []) {
  if (!subjects.length) return 0;
  const finals = subjects.map(getFinalAttendance).filter(Number.isFinite);
  if (!finals.length) return 0;
  return Math.round(finals.reduce((sum, v) => sum + v, 0) / finals.length);
}

export function getAttendanceStatus(percentage, target = 75) {
  const safe = target + 10;
  if (percentage >= safe) return { label: "Safe", tone: "safe" };
  if (percentage >= target) return { label: "Good", tone: "good" };
  if (percentage >= target - 5) return { label: "Warning", tone: "warning" };
  return { label: "Danger", tone: "danger" };
}

export function enrichSubjects(subjects = [], target = 75) {
  return subjects.map((subject) => {
    const final = getFinalAttendance(subject);

    return {
      ...subject,
      final,
      status: getAttendanceStatus(final, target)
    };
  });
}