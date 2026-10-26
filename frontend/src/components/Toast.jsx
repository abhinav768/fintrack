import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, msg) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, type, msg }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({ success: (msg) => show("ok", msg), error: (msg) => show("error", msg) }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex animate-rise items-center gap-3 rounded-2xl border bg-ink-800/95 px-4 py-3 text-sm text-paper shadow-2xl backdrop-blur ${
              t.type === "ok" ? "border-lime/30 [&>svg]:text-lime" : "border-coral/40 [&>svg]:text-coral"
            }`}
          >
            {t.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
