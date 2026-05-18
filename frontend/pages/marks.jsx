import { Wrench } from "lucide-react";
import { Layout } from "../components/Layout.jsx";

export default function Marks() {
  return (
    <Layout title="Marks">
      <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white/70 p-8 text-center shadow-soft">
        <div className="mx-auto w-fit rounded-full bg-sky/10 p-3 text-sky">
          <Wrench size={24} />
        </div>
        <p className="mt-4 font-black text-ink/70">Coming Soon</p>
        <p className="mt-1 text-sm font-semibold text-ink/45">
          This feature is currently under development.
        </p>
      </div>
    </Layout>
  );
}
