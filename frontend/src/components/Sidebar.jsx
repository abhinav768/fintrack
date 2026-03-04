import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  HandCoins,
  PlusCircle,
  Users,
  IndianRupee,
} from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/loans", icon: HandCoins, label: "All Loans" },
  { to: "/add-loan", icon: PlusCircle, label: "New Loan" },
  { to: "/borrowers", icon: Users, label: "Borrowers" },
];

export default function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <IndianRupee size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">FinTrack</h1>
          <p className="text-xs text-slate-400">Loan Manager</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-xs text-slate-400">
          4% / month &middot; flexible tenure
        </p>
      </div>
    </aside>
  );
}
