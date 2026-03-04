import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { getDashboard, getLoans } from "../api";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), getLoans()])
      .then(([s, l]) => {
        setStats(s);
        setLoans(l);
      })
      .finally(() => setLoading(false));
  }, []);

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
      color: "bg-blue-500",
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    {
      label: "Expected Return",
      value: formatCurrency(stats.total_expected_return),
      icon: TrendingUp,
      color: "bg-purple-500",
      bg: "bg-purple-50",
      text: "text-purple-700",
    },
    {
      label: "Collected",
      value: formatCurrency(stats.total_collected),
      icon: CheckCircle2,
      color: "bg-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
    {
      label: "Pending",
      value: formatCurrency(stats.total_pending),
      icon: Clock,
      color: "bg-amber-500",
      bg: "bg-amber-50",
      text: "text-amber-700",
    },
  ];

  const activeLoans = loans.filter((l) => l.status === "active");

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your lending portfolio
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}
              >
                <card.icon size={18} className={card.text} />
              </div>
            </div>
            <p className={`mt-3 text-2xl font-bold ${card.text}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800">
              Quick Stats
            </h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Active Loans</span>
                <span className="text-lg font-bold text-emerald-600">
                  {stats.active_loans}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Completed</span>
                <span className="text-lg font-bold text-slate-600">
                  {stats.completed_loans}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total Loans</span>
                <span className="text-lg font-bold text-slate-600">
                  {stats.total_loans}
                </span>
              </div>
              {stats.total_expected_return > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Collection Progress</span>
                    <span className="font-semibold text-emerald-600">
                      {Math.round(
                        (stats.total_collected / stats.total_expected_return) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
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

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-800">
                Active Loans
              </h3>
              <Link
                to="/loans"
                className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
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
                      className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
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
                        <div className="w-24">
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {formatCurrency(loan.remaining)}
                        </span>
                        <ArrowRight size={14} className="text-slate-400" />
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
