import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";

export default function Cgpa() {
  const [rawCgpa, setRawCgpa] = useState(null);

  useEffect(() => {
    setRawCgpa(readLocal(STORAGE_KEYS.cgpa, null));
  }, []);

  const cgpa = useMemo(() => {
    if (typeof rawCgpa === "number") return { value: rawCgpa };
    if (rawCgpa && typeof rawCgpa === "object") return rawCgpa;
    return null;
  }, [rawCgpa]);

  return (
    <Layout title="CGPA">
      {cgpa?.value != null ? (
        <section className="rounded-lg border border-ink/10 bg-white p-4 text-center shadow-soft">
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">Current CGPA</p>
          <p className="mt-2 text-3xl font-black text-ink">{cgpa.value}</p>
          {cgpa.updatedAt ? (
            <p className="mt-1 text-xs font-semibold text-ink/45">
              Updated {new Date(cgpa.updatedAt).toLocaleDateString()}
            </p>
          ) : null}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-4 text-center shadow-soft">
          <p className="font-black text-ink/60">No CGPA saved yet</p>
          <p className="mt-1 text-sm text-ink/40">Add CGPA data to see it here.</p>
        </div>
      )}
    </Layout>
  );
}
