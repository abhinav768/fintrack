import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "../lib/format";

const AVATAR_TONES = [
  "bg-lime/15 text-lime",
  "bg-[#7CC4FF]/15 text-[#7CC4FF]",
  "bg-coral/15 text-coral",
  "bg-amber/15 text-amber",
  "bg-[#C9A7FF]/15 text-[#C9A7FF]",
  "bg-white/10 text-paper",
];

function toneFor(name = "") {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function Avatar({ name, size = "md" }) {
  const sizes = {
    sm: "h-9 w-9 text-base",
    md: "h-11 w-11 text-lg",
    lg: "h-16 w-16 text-3xl",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display ${sizes[size]} ${toneFor(name)}`}
    >
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

export function Reveal({ delay = 0, as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag className={`animate-rise ${className}`} style={{ animationDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

export function PageHeader({ index, eyebrow, title, accent, subtitle, actions }) {
  return (
    <Reveal className="mb-10 flex flex-col gap-6 border-b border-white/[0.07] pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">
          {index && <span className="text-lime">{index}</span>}
          {index && <span className="mx-2 text-faint">/</span>}
          {eyebrow}
        </p>
        <h1 className="display mt-4 text-5xl sm:text-6xl lg:text-7xl">
          {title} {accent && <em className="text-muted">{accent}</em>}
        </h1>
        {subtitle && <p className="mt-4 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Reveal>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-72 items-center justify-center">
      <div className="h-px w-40 overflow-hidden bg-white/10">
        <div className="h-full w-1/3 animate-[marquee_1.2s_linear_infinite] bg-lime" />
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <p className="display text-3xl">{title}</p>
      {body && <p className="mt-3 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "lime", className = "" }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const colors = { lime: "bg-lime", coral: "bg-coral", amber: "bg-amber", muted: "bg-muted" };
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-out ${colors[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function LoanStatusChip({ status, overdueCount = 0 }) {
  if (overdueCount > 0) return <span className="chip-coral">{overdueCount} overdue</span>;
  if (status === "completed") return <span className="chip-muted">Completed</span>;
  return <span className="chip-lime">Active</span>;
}

export function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md animate-rise rounded-t-3xl border border-white/10 bg-ink-900 p-6 pb-safe shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="display text-3xl">{title}</h3>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Money({ value, className = "", symbolClass = "text-muted" }) {
  const n = Number(value) || 0;
  const digits = formatCurrency(Math.abs(n)).replace("₹", "");
  return (
    <span className={className}>
      {n < 0 && <span className="text-coral">−</span>}
      <span className={symbolClass}>₹</span>
      {digits}
    </span>
  );
}

export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(target);
  const from = useRef(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(start + (end - start) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = end;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
