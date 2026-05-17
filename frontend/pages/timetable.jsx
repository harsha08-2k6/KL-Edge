import { useEffect, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function cellHasDay(cell, day) {
  return normalize(cell).includes(day.toLowerCase());
}

function getTodayName() {
  return dayNames[new Date().getDay()];
}

function getTodayRows(grid, today) {
  if (!Array.isArray(grid) || !grid.length) return [];

  const rowIndex = grid.findIndex((row) => row.some((cell) => cellHasDay(cell, today)));
  if (rowIndex > 0) {
    const headers = grid[0] || [];
    const row = grid[rowIndex] || [];
    return row
      .map((cell, index) => ({
        slot: headers[index] || (index === 0 ? "Day" : `Slot ${index}`),
        value: cell
      }))
      .filter((item, index) => index > 0 && normalize(item.value) && normalize(item.value) !== "-");
  }

  const headerRow = grid[0] || [];
  const dayColumnIndex = headerRow.findIndex((cell) => cellHasDay(cell, today));
  if (dayColumnIndex > 0) {
    return grid
      .slice(1)
      .map((row) => ({
        slot: row[0] || "Slot",
        value: row[dayColumnIndex]
      }))
      .filter((item) => normalize(item.value) && normalize(item.value) !== "-");
  }

  return [];
}

export default function Timetable() {
  const [grid, setGrid] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const today = getTodayName();
  const todayRows = getTodayRows(grid, today);

  useEffect(() => {
    const data = readLocal(STORAGE_KEYS.timetable, { grid: [], mappings: [] });
    setSyncStatus(readLocal(STORAGE_KEYS.timetableStatus, null));
    if (Array.isArray(data)) {
      setGrid(data);
    } else {
      setGrid(data.grid || []);
    }
  }, []);

  return (
    <Layout title="Timetable">
      {grid.length > 0 ? (
        <div className="rounded-xl border border-ink/10 bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Today</p>
              <h2 className="text-xl font-black text-ink">{today}</h2>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black text-ink/60">
              {todayRows.length} slot{todayRows.length === 1 ? "" : "s"}
            </span>
          </div>

          {todayRows.length ? (
            <div className="mt-3 space-y-2">
              {todayRows.map((item, index) => (
                <article key={`${item.slot}-${index}`} className="rounded-lg border border-ink/10 bg-paper p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-ink/40">{item.slot}</p>
                  <p className="mt-1 text-sm font-black text-ink">{item.value}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-ink/15 bg-paper p-4 text-center">
              <p className="font-black text-ink/60">No classes scheduled for {today}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-4 text-center shadow-soft md:p-5">
          <p className="font-black text-ink/60">
            {syncStatus?.status === "empty" ? "Timetable not available from ERP" : "No timetable synced yet"}
          </p>
          <p className="mt-2 text-sm text-ink/40">
            {syncStatus?.message || "Sync from Settings to fetch your timetable."}
          </p>
          {syncStatus?.status === "empty" && (
            <p className="mt-2 text-xs font-semibold text-ink/35">
              Attendance can update even when ERP returns an empty timetable page.
            </p>
          )}
        </div>
      )}
    </Layout>
  );
}

