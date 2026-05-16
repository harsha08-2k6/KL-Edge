import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { readLocal, STORAGE_KEYS } from "../utils/storage.js";
import { enrichSubjects } from "../../shared/attendance";
import { fetchFaculty } from "../utils/api.js";

export default function Subjects() {
  const [rawSubjects, setRawSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [mappings, setMappings] = useState([]);

  useEffect(() => {
    setRawSubjects(readLocal(STORAGE_KEYS.attendance, []));
    const timetableData = readLocal(STORAGE_KEYS.timetable, { mappings: [] });
    setMappings(timetableData.mappings || []);
    
    fetchFaculty().then(setFacultyList).catch(() => setFacultyList([]));
  }, []);

  const subjects = useMemo(() => {
    const enriched = enrichSubjects(rawSubjects);
    return enriched.map(subject => {
      // Find faculty for this subject in mappings
      const mapping = mappings.find(m => 
        m.subject.toLowerCase().includes(subject.subject.toLowerCase()) ||
        subject.subject.toLowerCase().includes(m.subject.toLowerCase())
      );
      
      let facultyInfo = null;
      if (mapping) {
        facultyInfo = facultyList.find(f => 
          f.faculty.toLowerCase().includes(mapping.faculty.toLowerCase()) ||
          mapping.faculty.toLowerCase().includes(f.faculty.toLowerCase())
        );
      }
      
      return { ...subject, facultyInfo };
    });
  }, [rawSubjects, mappings, facultyList]);

  return (
    <Layout title="Subjects">
      <div className="space-y-3">
        {subjects.map((subject) => (
          <article key={subject.subject} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{subject.subject}</h2>
                <p className="mt-1 text-sm font-semibold text-ink/58">
                  Need {subject.neededFor85} classes for 85% · Can bunk {subject.bunkableTo75}
                </p>
                {subject.facultyInfo ? (
                  <p className="mt-2 text-xs font-bold text-violet">
                    {subject.facultyInfo.faculty} · {subject.facultyInfo.cabin}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">{subject.final}%</p>
                <div className="mt-2"><StatusPill status={subject.status} /></div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {["L", "T", "P", "S"].map((key) => (
                <div key={key} className="rounded-lg bg-paper px-2 py-3 text-center">
                  <p className="text-xs font-black text-ink/50">{key}</p>
                  <p className="mt-1 font-black">{subject[key] ?? "-"}</p>
                </div>
              ))}
            </div>
          </article>
        ))}

        {!subjects.length ? (
          <div className="rounded-lg border border-dashed border-ink/25 bg-white p-6 text-center shadow-soft">
            <p className="font-black">Sync attendance to see subjects.</p>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

