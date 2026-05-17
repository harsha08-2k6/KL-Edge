import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { fetchFaculty } from "../utils/api.js";

export default function Faculty() {
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [faculty, setFaculty] = useState([]);

  useEffect(() => {
    fetchFaculty().then(setFaculty).catch(() => setFaculty([]));
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

  return (
    <Layout title="Faculty Search" width="wide">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
      </div>

      <section className="mt-3 space-y-2 overflow-x-auto">
        {results.map((entry) => (
          <article key={`${entry.faculty}-${entry.cabin}`} className="flex items-center justify-between gap-2.5 rounded-lg border border-ink/10 bg-white p-2.5 shadow-soft">
            <div className="flex-1">
              <h2 className="text-sm font-black text-ink">{entry.faculty}</h2>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{entry.department}</span>
                {entry.empId && <span className="text-[10px] font-bold text-mint">ID: {entry.empId}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="rounded-md bg-violet/12 px-2.5 py-1.5 text-sm font-black text-violet">
                {entry.cabin}
              </p>
              {entry.roomNo && entry.roomNo !== entry.cabin && (
                <p className="mt-1 text-[10px] font-black uppercase text-ink/30">Room: {entry.roomNo}</p>
              )}
            </div>
          </article>
        ))}
      </section>
    </Layout>
  );
}

