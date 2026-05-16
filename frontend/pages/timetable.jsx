import { useEffect, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

export default function Timetable() {
  const [timetable, setTimetable] = useState([]);

  useEffect(() => {
    const data = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    // Handle migration from old array format to new object format
    if (Array.isArray(data)) {
      setTimetable(data);
    } else {
      setTimetable(data.grid || []);
    }
  }, []);

  return (
    <Layout title="Timetable">
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="overflow-x-auto">
          {timetable.length > 0 ? (
            <table className="w-full min-w-[800px] border-collapse text-left text-xs">
              <tbody>
                {timetable.map((row, i) => (
                  <tr key={i} className={i === 0 ? "bg-ink text-paper" : "border-t border-ink/10"}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-3 py-4 ${i === 0 ? "font-black" : "font-semibold"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="font-black text-ink/60">No timetable synced yet.</p>
              <p className="mt-2 text-sm text-ink/40">Sync attendance in Settings to fetch your timetable.</p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 px-2 text-[10px] font-bold uppercase tracking-wider text-ink/40">
        * Sync data from ERP Settings to update your timetable.
      </p>
    </Layout>
  );
}

