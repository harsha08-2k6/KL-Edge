import { useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { enrichSubjects } from "../utils/attendance.js";
import { SubjectTable } from "../components/SubjectTable.jsx";

const cellLabel = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };

export default function Subjects() {
  const [rawSubjects, setRawSubjects] = useState([]);
  const [target, setTarget] = useState(() => readLocal("kl-edge.target", 75));

  useEffect(() => {
    setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
  }, []);

  const selectTarget = (t) => {
    setTarget(t);
    writeLocal("kl-edge.target", t);
  };

  const subjects = useMemo(() => enrichSubjects(rawSubjects, target), [rawSubjects, target]);

  const getSubjectSummary = (item) => {
    let conducted = item.conducted;
    let attended = item.attended;
    
    if (conducted == null || conducted === 0) {
      conducted = (item.L_conducted || 0) + (item.T_conducted || 0) + (item.P_conducted || 0) + (item.S_conducted || 0);
      attended = (item.L_attended || 0) + (item.T_attended || 0) + (item.P_attended || 0) + (item.S_attended || 0);
    }
    
    const absent = Math.max(0, conducted - attended);
    const percentage = item.final || item.percentage || 0;
    return { conducted, attended, absent, percentage };
  };

  const exportCSV = () => {
    if (!subjects || !subjects.length) return;
    const headers = ["Course Code", "Subject", "Component", "Section", "Conducted", "Attended", "Absent", "Percentage"];
    const rows = subjects.map(item => {
      const summary = getSubjectSummary(item);
      return [
        item.courseCode || "",
        item.subject || "",
        item.ltps || "",
        item.section || "",
        summary.conducted,
        summary.attended,
        summary.absent,
        `${summary.percentage}%`
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!subjects || !subjects.length) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const rowsHtml = subjects.map((item, index) => {
      const summary = getSubjectSummary(item);
      return `
        <tr>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px;">${index + 1}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px;"><b>${item.courseCode || ""}</b></td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px;">${item.subject || ""}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; text-align: center;">${item.ltps || ""}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; text-align: center;">${item.section || ""}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; text-align: center;">${summary.conducted}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; text-align: center;">${summary.attended}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; text-align: center;">${summary.absent}</td>
          <td style="border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; text-align: center; font-weight: bold; color: ${summary.percentage >= 75 ? '#10b981' : '#f43f5e'};">${summary.percentage}%</td>
        </tr>
      `;
    }).join("");

    const html = `
      <html>
        <head>
          <title>Attendance Report</title>
          <style>
            body { font-family: sans-serif; color: #12151f; margin: 30px; }
            h1 { font-size: 24px; margin-bottom: 5px; font-weight: 900; }
            p { font-size: 13px; color: rgba(18, 21, 31, 0.6); margin-top: 0; margin-bottom: 25px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 15px; }
            th { background: #f7f4ee; border: 1px solid rgba(18, 21, 31, 0.15); padding: 10px; text-align: left; font-weight: 900; }
            td { border: 1px solid rgba(18, 21, 31, 0.1); padding: 8px; }
          </style>
        </head>
        <body>
          <h1>KL-Edge Attendance Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th>Course Code</th>
                <th>Subject</th>
                <th style="text-align: center;">L/T/P/S</th>
                <th style="text-align: center;">Section</th>
                <th style="text-align: center;">Conducted</th>
                <th style="text-align: center;">Attended</th>
                <th style="text-align: center;">Absent</th>
                <th style="text-align: center;">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Layout title="Subjects">
      <div className="mb-2.5 flex gap-1.5">
        {[75, 85].map((t) => (
          <button
            key={t}
            onClick={() => selectTarget(t)}
            className={`h-9 flex-1 rounded-lg px-2.5 text-xs font-black transition-colors ${
              target === t ? "bg-ink text-paper" : "bg-white border border-ink/10 text-ink/50"
            }`}
          >
            {t}% Target
          </button>
        ))}
      </div>

      {subjects.length ? (
        <div className="mb-2.5 flex gap-2">
          <button
            onClick={exportCSV}
            className="tap flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="tap flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink"
          >
            <FileText size={14} />
            Download PDF
          </button>
        </div>
      ) : null}

      {subjects.length ? (
        <SubjectTable subjects={subjects} />
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-3 text-center shadow-soft">
          <p className="font-black">Sync attendance to see subjects.</p>
        </div>
      )}
    </Layout>
  );
}
