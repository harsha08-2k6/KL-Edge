import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "../components/Layout.jsx";

export default function Privacy() {
  return (
    <Layout
      title="Privacy Policy"
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
        <p className="text-xs text-ink/40 font-bold">Last Updated: July 1, 2026</p>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Overview</h2>
          <p className="mt-1">
            KL-Edge is an independent student project designed to help students access academic information such as attendance, timetable, CGPA, internals, and course details from the official university portal.
          </p>
          <p className="mt-2 font-bold text-coral">
            This project is not affiliated with, endorsed by, or maintained by the university.
          </p>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Information We Access</h2>
          <p className="mt-1">
            When you sign in, KL-Edge may access information available from the official student portal, including:
          </p>
          <ul className="mt-1 list-disc list-inside space-y-0.5 pl-2">
            <li>Student profile</li>
            <li>Attendance</li>
            <li>Timetable</li>
            <li>Internal marks</li>
            <li>CGPA</li>
            <li>Course information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Credentials</h2>
          <p className="mt-1">
            Your login credentials are used only to authenticate with the official student portal.
          </p>
          <p className="mt-2 font-bold">
            KL-Edge does not permanently store your username or password on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Data Storage</h2>
          <p className="mt-1">
            Academic data is retrieved only to display it to you within the application.
          </p>
          <p className="mt-2">
            KL-Edge does not sell, share, or distribute your personal information to any third party.
          </p>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Security</h2>
          <p className="mt-1">
            Reasonable measures are taken to protect user information during communication with the application. However, no online service can guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Third-Party Services</h2>
          <p className="mt-1">
            KL-Edge may communicate with the official university portal to retrieve your academic information. The privacy practices of the university portal are governed by their respective policies.
          </p>
        </section>

        <section>
          <h2 className="text-base font-black text-ink mt-4">Contact</h2>
          <p className="mt-1">
            For privacy concerns or questions, contact:
          </p>
          <p className="mt-1 font-bold">
            Email: <a href="mailto:tsivaharshavardhanreddy08@gmail.com" className="text-mint hover:underline">tsivaharshavardhanreddy08@gmail.com</a>
          </p>
        </section>
      </div>
    </Layout>
  );
}
