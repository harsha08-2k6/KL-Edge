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

export function classesNeededForTarget(currentPercentage, targetPercentage = 85) {
  if (currentPercentage >= targetPercentage) return 0;
  const current = Number(currentPercentage);
  const target = Number(targetPercentage);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target >= 100) return 0;
  return Math.ceil((target - current) / (100 - target));
}

export function classesCanBunk(attended, conducted, target) {
  if (!conducted || !attended) return 0;
  // How many classes can be skipped while staying at or above target%
  // (attended) / (conducted + N) >= target/100  →  N <= (attended - target/100 * conducted) / (target/100)
  return Math.max(0, Math.floor((attended - (target / 100) * conducted) / (target / 100)));
}

export function classesNeeded(attended, conducted, target) {
  if (!conducted) return 0;
  // How many consecutive classes must be attended to reach target%
  // (attended + N) / (conducted + N) >= target/100  →  N >= (target/100 * conducted - attended) / (1 - target/100)
  const needed = Math.ceil(((target / 100) * conducted - attended) / (1 - target / 100));
  return Math.max(0, needed);
}

export function enrichSubjects(subjects = [], target = 75) {
  return subjects.map((subject) => {
    const final = getFinalAttendance(subject);
    const components = ["L", "T", "P", "S"].filter(k => subject[k] != null);
    const ltpsBunk = {};
    const ltpsNeeded = {};

    for (const k of components) {
      const conducted = subject[`${k}_conducted`];
      const attended = subject[`${k}_attended`];
      if (conducted != null && attended != null) {
        ltpsBunk[k] = 0;
        ltpsNeeded[k] = 0;
      }
      // no fallback — show nothing if real counts unavailable
    }

    return {
      ...subject,
      final,
      status: getAttendanceStatus(final, target),
      neededForTarget: classesNeededForTarget(final, target),
      ltpsBunk,
      ltpsNeeded
    };
  });
}