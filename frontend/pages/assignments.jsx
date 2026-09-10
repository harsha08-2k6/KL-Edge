import { useState, useEffect } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

const getUrgency = (dueDateStr) => {
  if (!dueDateStr) return { color: "border-ink/10 bg-ink/5", text: "text-ink/60", label: "No Date", dot: "⚪" };
  const due = new Date(dueDateStr).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return { color: "border-coral/20 bg-coral/5", text: "text-coral font-bold", label: diffDays <= 0 ? "Due today" : "Due tomorrow", dot: "🔴" };
  if (diffDays <= 3) return { color: "border-amber/20 bg-amber/5", text: "text-amber font-bold", label: `Due in ${diffDays} days`, dot: "🟠" };
  if (diffDays <= 7) return { color: "border-yellow-500/30 bg-yellow-500/10", text: "text-yellow-600 font-bold", label: `Due in ${diffDays} days`, dot: "🟡" };
  return { color: "border-mint/20 bg-mint/5", text: "text-mint font-bold", label: `Due in ${diffDays} days`, dot: "🟢" };
};

export default function Assignments() {
  const [lmsAssignments, setLmsAssignments] = useState([]);

  useEffect(() => {
    setLmsAssignments(readLocal(STORAGE_KEYS.lmsAssignments, []));
  }, []);

  return (
    <Layout title="All Assignments">
      <div className="space-y-3">
        {lmsAssignments.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white/80 p-6 text-center shadow-soft">
            <p className="text-sm font-black text-ink/40">No pending assignments</p>
            <p className="mt-1 text-xs font-semibold text-ink/30">You're all caught up!</p>
          </div>
        ) : (
          lmsAssignments.map((assignment) => {
            const urgency = getUrgency(assignment.dueDate);
            return (
              <div key={assignment.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${urgency.color}`}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">{assignment.course}</p>
                  <h4 className="mt-0.5 text-sm font-black text-ink">{assignment.title}</h4>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-ink/60">
                      Due: {assignment.dueDateText || new Date(assignment.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={urgency.text}>
                      {urgency.dot} {urgency.label}
                    </span>
                  </div>
                </div>
                <a
                  href={assignment.lmsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="tap flex items-center justify-center whitespace-nowrap rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink/90 transition-colors"
                >
                  Open LMS
                </a>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
