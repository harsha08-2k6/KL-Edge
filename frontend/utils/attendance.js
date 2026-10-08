export function classesNeededForTarget() { return 0; }
export function classesCanBunk() { return 0; }
export function classesNeeded() { return 0; }
export function calculateWeightedOverall() { return { attended: 0, conducted: 0, percentage: 0 }; }
export function calculateRealBunks() { return 0; }
export function calculateRealNeed() { return 0; }
export function getSubjectAnalytics() { return { overall: 0, weighted: "0/0", components: {} }; }

export function calculateAttendance(subject) {
  let attendedWeighted = 0;
  let conductedWeighted = 0;
  let hasComponents = false;

  const lCond = Number(subject.L_conducted) || 0;
  const lAtt = Number(subject.L_attended) || 0;
  if (lCond > 0 || lAtt > 0) {
    attendedWeighted += lAtt * 1;
    conductedWeighted += lCond * 1;
    hasComponents = true;
  }

  const tCond = Number(subject.T_conducted) || 0;
  const tAtt = Number(subject.T_attended) || 0;
  if (tCond > 0 || tAtt > 0) {
    attendedWeighted += tAtt * 1;
    conductedWeighted += tCond * 1;
    hasComponents = true;
  }

  const pCond = Number(subject.P_conducted) || 0;
  const pAtt = Number(subject.P_attended) || 0;
  if (pCond > 0 || pAtt > 0) {
    attendedWeighted += pAtt * 0.5;
    conductedWeighted += pCond * 0.5;
    hasComponents = true;
  }

  const sCond = Number(subject.S_conducted) || 0;
  const sAtt = Number(subject.S_attended) || 0;
  if (sCond > 0 || sAtt > 0) {
    attendedWeighted += sAtt * 0.25;
    conductedWeighted += sCond * 0.25;
    hasComponents = true;
  }

  if (!hasComponents || conductedWeighted === 0) {
    return -1;
  }

  return Math.round((attendedWeighted / conductedWeighted) * 100);
}

export function getFinalAttendance(subject = {}) {
  const calculated = calculateAttendance(subject);
  if (calculated !== -1) {
    return calculated;
  }

  const official = Number(subject.finalPercentage ?? subject.attendancePercentage ?? subject.percentage);
  if (Number.isFinite(official) && official >= 0) {
    return Math.round(official);
  }

  return 0;
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