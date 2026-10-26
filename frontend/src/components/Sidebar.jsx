import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutGrid,
  HandCoins,
  Plus,
  Users,
  Settings,
  LogOut,
  ArrowLeftRight,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "../AuthContext";

const links = [
  { to: "/", icon: LayoutGrid, label: "Overview" },
  { to: "/loans", icon: HandCoins, label: "Loans" },
  { to: "/add-loan", icon: Plus, label: "New loan" },
  { to: "/borrowers", icon: Users, label: "Borrowers" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Wordmark({ className = "" }) {
  return (
    <span className={`display select-none ${className}`}>
      Fin<em className="text-lime">track</em>
    </span>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { profile, logout, clearProfile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSwitchProfile = () => {
    setMenuOpen(false);
    clearProfile();
    navigate("/profiles");
  };

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.07] bg-ink-950/85 px-5 backdrop-blur-xl md:hidden">
        <Wordmark className="text-2xl" />
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-icon"
            aria-label="Account menu"
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 w-52 animate-rise rounded-2xl border border-white/10 bg-ink-900 p-2 shadow-2xl">
                <p className="eyebrow truncate px-3 py-2">{profile?.name}</p>
                <button
                  onClick={handleSwitchProfile}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-paper hover:bg-white/[0.05]"
                >
                  <ArrowLeftRight size={16} /> Switch profile
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-coral hover:bg-coral/10"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-ink-950/90 pb-safe backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  isActive ? "text-lime" : "text-muted"
                }`
              }
            >
              {to === "/add-loan" ? (
                <span className="-mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-lime text-ink-950">
                  <Icon size={18} strokeWidth={2.5} />
                </span>
              ) : (
                <Icon size={19} />
              )}
              {to !== "/add-loan" && label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop rail */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-white/[0.07] bg-ink-950 md:flex">
        <div className="px-7 pb-10 pt-9">
          <Wordmark className="text-[2.1rem]" />
          <p className="eyebrow mt-3 truncate" title={profile?.name}>
            {profile?.name || "Lending ledger"}
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-4">
          {links.map(({ to, label }, i) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-200 ${
                  isActive ? "text-paper" : "text-muted hover:text-paper"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`font-mono text-[11px] ${isActive ? "text-lime" : "text-faint"}`}>
                    0{i + 1}
                  </span>
                  <span>{label}</span>
                  <span
                    className={`ml-auto h-1.5 w-1.5 rounded-full bg-lime transition-all duration-300 ${
                      isActive ? "scale-100 opacity-100" : "scale-0 opacity-0"
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-white/[0.07] px-4 py-4">
          <button
            onClick={handleSwitchProfile}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:text-paper"
          >
            <ArrowLeftRight size={15} /> Switch profile
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-faint transition-colors hover:text-coral"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
