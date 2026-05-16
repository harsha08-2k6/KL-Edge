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

export function calculateOverall(subjects = []) {
  if (!subjects.length) return 0;
  const finals = subjects.map(calculateAttendance).filter(Number.isFinite);
  if (!finals.length) return 0;
  return Math.round(finals.reduce((sum, v) => sum + v, 0) / finals.length);
}

export function getAttendanceStatus(percentage) {
  if (percentage >= 90) return { label: "Safe", tone: "safe" };
  if (percentage >= 85) return { label: "Good", tone: "good" };
  if (percentage >= 75) return { label: "Warning", tone: "warning" };
  return { label: "Danger", tone: "danger" };
}

export function classesNeededForTarget(currentPercentage, targetPercentage = 85) {
  if (currentPercentage >= targetPercentage) return 0;
  const current = Number(currentPercentage);
  const target = Number(targetPercentage);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target >= 100) return 0;
  return Math.ceil((target - current) / (100 - target));
}

export function classesCanBunk(currentPercentage, floorPercentage = 75) {
  const current = Number(currentPercentage);
  const floor = Number(floorPercentage);
  if (!Number.isFinite(current) || current <= floor) return 0;
  return Math.floor((current - floor) / floor);
}

export function enrichSubjects(subjects = []) {
  return subjects.map((subject) => {
    const final = calculateAttendance(subject);
    return {
      ...subject,
      final,
      status: getAttendanceStatus(final),
      neededFor85: classesNeededForTarget(final, 85),
      bunkableTo75: classesCanBunk(final, 75)
    };
  });
}

