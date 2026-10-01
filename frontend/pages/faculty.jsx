import { Search, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { fetchFaculty } from "../utils/api.js";

export default function Faculty() {
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [faculty, setFaculty] = useState([]);

  useEffect(() => {
    fetchFaculty()
      .then((res) => {
        setFaculty(Array.isArray(res) ? res : res?.faculty || res?.data || []);
      })
      .catch(() => setFaculty([]));
  }, []);

  const branches = useMemo(() => {
    const unique = new Set();
    faculty.forEach((entry) => {
      if (entry.department) unique.add(entry.department);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [faculty]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let filtered = faculty;
    if (branch) {
      filtered = filtered.filter((entry) => entry.department === branch);
    }
    if (!needle) return filtered;

    return filtered.filter((entry) =>
      `${entry.faculty} ${entry.cabin} ${entry.department || ""} ${entry.empId || ""}`.toLowerCase().includes(needle)
    );
  }, [branch, faculty, query]);

  const exportFacultyCSV = () => {
    if (!results || !results.length) return;
    const headers = ["Employee ID", "Faculty Name", "Department", "Cabin", "Room Number"];
    const rows = results.map(entry => [
      entry.empId || "",
      entry.faculty || "",
      entry.department || "",
      entry.cabin || "",
      entry.roomNo || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `faculty_list_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout title="Faculty Search">
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border-ink/15 bg-white pl-9 pr-3 text-sm font-bold shadow-soft focus:border-mint focus:ring-mint"
            placeholder="Search faculty name or cabin"
          />
        </label>

        <label className="block">
          <span className="sr-only">Branch filter</span>
          <select
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            className="h-10 w-full rounded-lg border-ink/15 bg-white px-3 text-sm font-bold shadow-soft focus:border-mint focus:ring-mint sm:min-w-[160px]"
          >
            <option value="">All branches</option>
            {branches.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <button
          onClick={exportFacultyCSV}
          disabled={!results.length}
          title="Export CSV"
          className="tap inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3.5 text-xs font-black text-ink/75 shadow-soft transition-colors hover:text-ink disabled:opacity-40"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      <section className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
        {results.map((entry) => (
          <article key={`${entry.faculty}-${entry.cabin}`} className="flex items-center justify-between gap-2.5 rounded-lg border border-ink/10 bg-white p-3 shadow-soft md:flex-col md:items-start md:p-5 hover:shadow-md transition-all">
            <div className="flex-1 w-full">
              <h2 className="text-sm md:text-base font-black text-ink line-clamp-2" title={entry.faculty}>{entry.faculty}</h2>
              <div className="mt-0.5 flex flex-wrap gap-1.5 md:mt-2">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-ink/40">{entry.department}</span>
                {entry.empId && <span className="text-[10px] md:text-xs font-bold text-mint">ID: {entry.empId}</span>}
              </div>
            </div>
            <div className="text-right md:text-left md:mt-auto md:w-full md:flex md:items-center md:justify-between md:pt-4">
              <p className="rounded-md bg-violet/12 px-2.5 py-1.5 text-sm font-black text-violet">
                {entry.cabin}
              </p>
              {entry.roomNo && entry.roomNo !== entry.cabin && (
                <p className="mt-1 text-[10px] font-black uppercase text-ink/30 md:mt-0">Room: {entry.roomNo}</p>
              )}
            </div>
          </article>
        ))}
      </section>
    </Layout>
  );
}
