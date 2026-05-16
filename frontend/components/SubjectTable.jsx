import { StatusPill } from "./StatusPill.jsx";

const cells = ["L", "T", "P", "S"];

export function SubjectTable({ subjects }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="bg-ink text-paper">
            <tr>
              <th className="px-4 py-3">Subject</th>
              {cells.map((cell) => (
                <th key={cell} className="px-3 py-3 text-center">{cell}</th>
              ))}
              <th className="px-3 py-3 text-center">Final %</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.courseCode} className="border-t border-ink/10">
                <td className="px-4 py-3 font-bold">{subject.subject}</td>
                {cells.map((cell) => (
                  <td key={cell} className="px-3 py-3 text-center font-semibold text-ink/70">
                    {subject[cell] ?? "-"}
                  </td>
                ))}
                <td className="px-3 py-3 text-center text-lg font-black">{subject.final}%</td>
                <td className="px-4 py-3"><StatusPill status={subject.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

