import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Wallet,
  CalendarDays,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import {
  getDashboard,
  getLoans,
  getBalance,
  updateBalance,
  getMonthlyCollection,
} from "../api";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [loans, setLoans] = useState([]);
  const [balance, setBalance] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState("");

  useEffect(() => {
    Promise.all([
      getDashboard(),
      getLoans(),
      getBalance(),
      getMonthlyCollection(),
    ])
      .then(([s, l, b, m]) => {
        setStats(s);
        setLoans(l);
        setBalance(b);
        setMonthly(m);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveBalance = async () => {
    const val = parseFloat(newBalance);
    if (isNaN(val)) return;
    await updateBalance({ base_balance: val });
    const b = await getBalance();
    setBalance(b);
    setEditingBalance(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: "Total Lent",
      value: formatCurrency(stats.total_principal_given),
      icon: IndianRupee,
      gradient: "from-blue-500 to-blue-600",
      shadow: "shadow-blue-500/20",
      lightBg: "bg-blue-500/10",
    },
    {
      label: "Expected Return",
      value: formatCurrency(stats.total_expected_return),
      icon: TrendingUp,
      gradient: "from-violet-500 to-purple-600",
      shadow: "shadow-violet-500/20",
      lightBg: "bg-violet-500/10",
    },
    {
      label: "Collected",
      value: formatCurrency(stats.total_collected),
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-teal-600",
      shadow: "shadow-emerald-500/20",
      lightBg: "bg-emerald-500/10",
    },
    {
      label: "Pending",
      value: formatCurrency(stats.total_pending),
      icon: Clock,
      gradient: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/20",
      lightBg: "bg-amber-500/10",
    },
  ];

  const activeLoans = loans.filter((l) => l.status === "active");

  return (
    <div>
      {/* Hero header */}
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl sm:p-8">
        <div className="relative">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {profile?.name ? `${profile.name}` : "Dashboard"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Overview of your lending portfolio
            </p>

            {/* Balance inline */}
            {balance && (
              <div className="mt-5 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                    Account Balance
                  </p>
                  <p className="mt-1 text-3xl font-bold text-white sm:text-4xl">
                    {formatCurrency(balance.current_balance)}
                  </p>
                </div>
                <div className="flex items-center gap-4 pb-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Base
                    </p>
                    {editingBalance ? (
                      <div className="mt-0.5 flex items-center gap-1">
                        <input
                          type="number"
                          value={newBalance}
                          onChange={(e) => setNewBalance(e.target.value)}
                          className="w-24 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-sm text-white outline-none focus:border-emerald-400"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveBalance}
                          className="rounded p-1 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingBalance(false)}
                          className="rounded p-1 text-slate-400 hover:bg-white/10"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-300">
                        {formatCurrency(balance.base_balance)}
                        <button
                          onClick={() => {
                            setNewBalance(String(balance.base_balance));
                            setEditingBalance(true);
                          }}
                          className="rounded p-0.5 text-slate-500 hover:text-slate-300"
                        >
                          <Pencil size={11} />
                        </button>
                      </p>
                    )}
                  </div>
                  {balance.new_collections > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        + New EMIs
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-emerald-400">
                        {formatCurrency(balance.new_collections)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-5 ${card.shadow}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                {card.label}
              </p>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md sm:h-10 sm:w-10 ${card.gradient} ${card.shadow}`}
              >
                <card.icon size={17} />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold text-slate-800 sm:mt-3 sm:text-2xl">
              {card.value}
            </p>
            <div className={`absolute -bottom-4 -right-4 h-20 w-20 rounded-full opacity-[0.04] transition-opacity group-hover:opacity-[0.08] ${card.lightBg}`} />
          </div>
        ))}
      </div>

      {/* Monthly Collection */}
      {monthly && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                <CalendarDays size={15} />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                {monthly.month} Collection
              </h3>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-slate-400 sm:inline">
                {formatCurrency(monthly.collected_total)} of{" "}
                {formatCurrency(monthly.expected_total)}
              </span>
              {monthly.expected_total > 0 && (
                <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm shadow-emerald-500/20">
                  {Math.round(
                    (monthly.collected_total / monthly.expected_total) * 100
                  )}
                  %
                </span>
              )}
            </div>
          </div>

          {monthly.expected_total > 0 && (
            <div className="px-5 pt-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-blue-500">
                    Expected
                  </p>
                  <p className="mt-1 text-sm font-bold text-blue-700 sm:text-base">
                    {formatCurrency(monthly.expected_total)}
                  </p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-500">
                    Collected
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-700 sm:text-base">
                    {formatCurrency(monthly.collected_total)}
                  </p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-amber-500">
                    Pending
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber-700 sm:text-base">
                    {formatCurrency(monthly.pending_total)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                  style={{
                    width: `${Math.min(100, (monthly.collected_total / monthly.expected_total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {monthly.emis.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No EMIs due this month
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {monthly.emis.map((emi) => (
                <Link
                  key={`${emi.loan_id}-${emi.month_number}`}
                  to={`/loans/${emi.loan_id}`}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                        emi.paid
                          ? "bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700"
                          : "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700"
                      }`}
                    >
                      {emi.borrower_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {emi.borrower_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Month {emi.month_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        emi.paid ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {formatCurrency(emi.emi_amount)}
                    </span>
                    {emi.paid ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <Clock size={16} className="text-amber-400" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Stats */}
        <div className="lg:col-span-1">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800">
              Quick Stats
            </h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Active Loans</span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-lg font-bold text-emerald-600">
                  {stats.active_loans}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Completed</span>
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-lg font-bold text-slate-600">
                  {stats.completed_loans}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total Loans</span>
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-lg font-bold text-blue-600">
                  {stats.total_loans}
                </span>
              </div>
              {stats.total_expected_return > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Collection Progress</span>
                    <span className="font-bold text-emerald-600">
                      {Math.round(
                        (stats.total_collected / stats.total_expected_return) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                      style={{
                        width: `${Math.min(100, (stats.total_collected / stats.total_expected_return) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Loans */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-800">
                Active Loans
              </h3>
              <Link
                to="/loans"
                className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
              >
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {activeLoans.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                <AlertCircle size={40} className="mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">No active loans yet</p>
                <Link
                  to="/add-loan"
                  className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Create your first loan
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeLoans.slice(0, 5).map((loan) => {
                  const progress =
                    loan.total_return > 0
                      ? (loan.total_paid / loan.total_return) * 100
                      : 0;
                  return (
                    <Link
                      key={loan.id}
                      to={`/loans/${loan.id}`}
                      className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-sm font-bold text-emerald-700">
                            {loan.borrower_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {loan.borrower_name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatCurrency(loan.principal)} &middot;{" "}
                              {loan.months_paid}/{loan.total_months} paid
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex items-center gap-4">
                        <div className="hidden w-24 sm:block">
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {formatCurrency(loan.remaining)}
                        </span>
                        <ArrowRight
                          size={14}
                          className="hidden text-slate-300 sm:block"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
