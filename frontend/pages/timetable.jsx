import { useEffect, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

export default function Timetable() {
  const [grid, setGrid] = useState([]);
  const [mappings, setMappings] = useState([]);

  useEffect(() => {
    const data = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    if (Array.isArray(data)) {
      setGrid(data);
    } else {
      setGrid(data.grid || []);
      setMappings(data.mappings || []);
    }
  }, []);

  return (
    <Layout title="Timetable">
      {grid.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <tbody>
                {grid.map((row, i) => (
                  <tr key={i} className={i === 0 ? "bg-ink text-paper" : "border-t border-ink/10"}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-3 py-3 ${i === 0 ? "font-black" : "font-semibold text-ink/80"}`}>
                        {cell || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-10 text-center shadow-soft">
          <p className="font-black text-ink/60">No timetable synced yet</p>
          <p className="mt-2 text-sm text-ink/40">Sync from Settings to fetch your timetable.</p>
        </div>
      )}

      {mappings.length > 0 && (
        <div className="mt-5 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink/40">Subject — Faculty</h2>
          <div className="mt-3 space-y-2">
            {mappings.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-ink/80">{m.subject}</span>
                <span className="text-sm font-semibold text-ink/50">{m.faculty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

