import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export function Toast({ message, type = "success", duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const isSuccess = type === "success";

  return (
    <div className="fixed top-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 transition-all duration-300 animate-slide-in">
      <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white/90 p-3.5 shadow-lg backdrop-blur-md">
        <div className={`flex-shrink-0 ${isSuccess ? "text-mint" : "text-coral"}`}>
          {isSuccess ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
        </div>
        <div className="flex-1 text-sm font-bold text-ink">
          {message}
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-ink/30 hover:bg-surface hover:text-ink transition-colors"
          aria-label="Close notification"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
