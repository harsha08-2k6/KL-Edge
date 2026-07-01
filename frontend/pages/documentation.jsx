import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "../components/Layout.jsx";

export default function Documentation() {
  return (
    <Layout
      title="KL-Edge Documentation"
      action={
        <Link
          to="/settings"
          className="tap inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 text-xs font-bold text-ink/70 shadow-soft transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
      }
    >
      <div className="mx-auto max-w-xl pb-10 text-ink/80 leading-relaxed space-y-4 text-sm">
        <section>
          <h2 className="text-base font-black text-ink mt-4">What is KL-Edge?</h2>
          <p className="mt-1">
            KL-Edge is a student dashboard that provides quick access to academic information from the official university portal through a clean and modern interface.
          </p>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Features</h2>
          <ul className="mt-1 list-disc list-inside space-y-0.5 pl-2">
            <li>Attendance tracking</li>
            <li>Timetable</li>
            <li>Internal marks</li>
            <li>CGPA</li>
            <li>Course information</li>
            <li>Responsive interface</li>
            <li>Fast loading experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Technology Stack</h2>
          <div className="mt-1">
            <p className="font-bold text-ink/70">Frontend</p>
            <ul className="list-disc list-inside pl-2">
              <li>React</li>
            </ul>
            <p className="mt-2 font-bold text-ink/70">Backend</p>
            <ul className="list-disc list-inside pl-2">
              <li>FastAPI</li>
              <li>Python</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">How It Works</h2>
          <ol className="mt-1 list-decimal list-inside space-y-1 pl-2">
            <li>Sign in using your university credentials.</li>
            <li>KL-Edge securely connects to the official student portal.</li>
            <li>Academic information is retrieved.</li>
            <li>The data is displayed in an organized dashboard.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Reporting Issues</h2>
          <p className="mt-1">Found a bug?</p>
          <p className="mt-1">
            Email: <a href="mailto:tsivaharshavardhanreddy08@gmail.com" className="text-mint hover:underline">tsivaharshavardhanreddy08@gmail.com</a>
          </p>
          <p className="mt-2 font-semibold">Please include:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>Browser</li>
            <li>Device</li>
            <li>Steps to reproduce</li>
            <li>Screenshots (if available)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Disclaimer</h2>
          <p className="mt-1">
            KL-Edge is an independent student project developed for educational purposes.
          </p>
          <p className="mt-2">
            It is not affiliated with or endorsed by the university. All academic information displayed within the application originates from the official university portal.
          </p>
        </section>
      </div>
    </Layout>
  );
}
