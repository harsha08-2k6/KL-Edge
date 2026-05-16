import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { readLocal, STORAGE_KEYS, writeLocal } from "../utils/storage.js";
import { enrichSubjects } from "../../shared/attendance";
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

  return (
    <Layout title="Subjects">
      <div className="mb-4 flex gap-2">
        {[75, 85].map((t) => (
          <button
            key={t}
            onClick={() => selectTarget(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-black transition-colors ${
              target === t ? "bg-ink text-paper" : "bg-white border border-ink/10 text-ink/50"
            }`}
          >
            {t}% Target
          </button>
        ))}
      </div>

      {subjects.length ? (
        <SubjectTable subjects={subjects} />
      ) : (
        <div className="rounded-lg border border-dashed border-ink/25 bg-white p-6 text-center shadow-soft">
          <p className="font-black">Sync attendance to see subjects.</p>
        </div>
      )}
    </Layout>
  );
}

