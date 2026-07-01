import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchPortalStatus } from "../utils/api.js";

export function Footer() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPortalStatus().then((res) => {
      if (active) {
        setIsOnline(res.status === "online");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="mt-8 border-t border-ink/10 pt-6 pb-20 text-center text-xs text-ink/70">
      <div className="mx-auto max-w-md space-y-4">
        {/* Description */}
        <div>
          <p className="text-ink/75 leading-relaxed px-2">
            Access attendance, timetable, internals, CGPA, courses, and academic information from one place.
          </p>
        </div>
        {/* Resources */}
        <div>
          <div className="flex justify-center gap-1.5 flex-wrap text-ink/70 font-semibold">
            <Link to="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
            <span className="text-ink/30">•</span>
            <Link to="/documentation" className="hover:text-ink transition-colors">Documentation</Link>
            <span className="text-ink/30">•</span>
            <a href="mailto:tsivaharshavardhanreddy08@gmail.com" className="hover:text-ink transition-colors">Report a Bug</a>
            <span className="text-ink/30">•</span>
            <a href="https://github.com/harsha08-2k6/KL-Edge.git" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">GitHub</a>
          </div>
        </div>

        {/* Badges / Tech Info */}
        <div className="flex items-center justify-center gap-3 pt-2 text-[11px] font-bold">
          <span className="inline-flex items-center rounded bg-surface px-1.5 py-0.5 text-ink/75">
            ⚡ Built with React + FastAPI
          </span>
          {isOnline ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-mint font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
              Portal Status: Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-coral/10 px-1.5 py-0.5 text-coral font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-coral animate-pulse" />
              Portal Status: Offline
            </span>
          )}
        </div>

        {/* Author / Disclaimer */}
        <div className="pt-3 border-t border-ink/5 text-[10px] text-ink/60 space-y-1">
          <p className="font-bold text-ink/70">Built by SHVR</p>
          <p className="px-4 leading-normal italic text-ink/65">
            KL-Edge is an independent student project and is not affiliated with or endorsed by the university. All academic data is retrieved from the official student portal.
          </p>
          <div className="pt-1">
            <p className="font-bold text-ink/70">© 2026 KL-Edge • v1.0.0</p>
            <p className="text-[9px] text-ink/50 mt-0.5">Last Updated: July 2026</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
