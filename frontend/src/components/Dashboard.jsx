import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pencil, X, Check, Plus } from "lucide-react";
import { useAuth } from "../AuthContext";
import {
  getDashboard,
  getLoans,
  getBalance,
  updateBalance,
  getMonthlyCollection,
  getOverdue,
} from "../api";
import { formatCurrency, formatDayMonth, errorMessage } from "../lib/format";
import { useToast } from "./Toast";
import {
  Avatar,
  EmptyState,
  Money,
  PageLoader,
  ProgressBar,
  Reveal,
  useCountUp,
} from "./ui";

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between px-5 pb-4 pt-6 sm:px-6">
      <h3 className="display text-2xl sm:text-3xl">{children}</h3>
      {action}
    </div>
  );
}

function Ticker({ items }) {
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map(([label, value]) => (
        <span key={label} className="flex items-center gap-3 px-6">
          <span className="eyebrow">{label}</span>
          <span className="figure text-sm text-paper">{value}</span>
          <span className="ml-6 h-1 w-1 rounded-full bg-lime" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative -mx-5 overflow-hidden border-y border-white/[0.07] py-3.5 sm:-mx-8 lg:-mx-12">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row}
        {row}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loans, setLoans] = useState([]);
  const [balance, setBalance] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [overdue, setOverdue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState("");

  useEffect(() => {
    Promise.allSettled([
      getDashboard(),
      getLoans(),
      getBalance(),
      getMonthlyCollection(),
      getOverdue(),
    ])
      .then(([s, l, b, m, o]) => {
        if (s.status === "fulfilled") setStats(s.value);
        if (l.status === "fulfilled") setLoans(l.value);
        if (b.status === "fulfilled") setBalance(b.value);
        if (m.status === "fulfilled") setMonthly(m.value);
        if (o.status === "fulfilled") setOverdue(o.value);
        if ([s, l, b, m, o].some((r) => r.status === "rejected")) {
          toast.error("Some dashboard data couldn't be loaded. Try refreshing.");
        }
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const animatedBalance = useCountUp(balance?.current_balance ?? 0, 1200);

  const handleSaveBalance = async () => {
    const val = parseFloat(newBalance);
    if (isNaN(val)) return;
    try {
      setBalance(await updateBalance({ base_balance: val }));
      setEditingBalance(false);
      toast.success("Balance updated");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update balance"));
    }
  };

  if (loading) return <PageLoader />;

  if (!stats) {
    return (
      <EmptyState
        title="Couldn't load your overview"
        body="Check your connection and refresh the page."
      />
    );
  }

  const activeLoans = loans.filter((l) => l.status === "active");
  const monthPct = monthly ? pct(monthly.collected_total, monthly.expected_total) : 0;
  const lifetimePct = pct(stats.total_collected, stats.total_expected_return);

  const tiles = [
    { label: "Total lent", value: stats.total_principal_given, note: `${stats.total_loans} loans` },
    { label: "Expected return", value: stats.total_expected_return, note: "Principal + interest" },
    { label: "Collected", value: stats.total_collected, note: `${lifetimePct}% of expected`, accent: true },
    { label: "Pending", value: stats.total_pending, note: `${stats.active_loans} active` },
  ];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <Reveal as="p" className="eyebrow">
            <span className="text-lime">01</span>
            <span className="mx-2 text-faint">/</span>
            {greeting()}, {profile?.name}
          </Reveal>
          <Reveal delay={80} as="p" className="mt-8 text-sm text-muted">
            Account balance
          </Reveal>
          <Reveal delay={140}>
            <h1 className="display mt-2 break-all text-[3.75rem] sm:text-8xl xl:text-[8.5rem]">
              <Money
                value={Math.round(animatedBalance)}
                symbolClass="mr-1 align-[0.55em] font-sans text-[0.32em] font-normal text-muted sm:mr-3"
              />
            </h1>
          </Reveal>

          {balance && (
            <Reveal delay={220} className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted">Opening</span>
                {editingBalance ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveBalance()}
                      className="input w-32 py-1.5 text-center figure"
                      autoFocus
                    />
                    <button onClick={handleSaveBalance} className="btn-icon text-lime" aria-label="Save">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditingBalance(false)} className="btn-icon" aria-label="Cancel">
                      <X size={15} />
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setNewBalance(String(balance.base_balance));
                      setEditingBalance(true);
                    }}
                    className="group flex items-center gap-1.5 figure text-paper"
                    title="Edit opening balance"
                  >
                    {formatCurrency(balance.base_balance)}
                    <Pencil size={12} className="text-faint transition-colors group-hover:text-lime" />
                  </button>
                )}
              </div>
              {balance.new_collections > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted">+ EMIs</span>
                  <span className="figure text-lime">{formatCurrency(balance.new_collections)}</span>
                </div>
              )}
              {balance.new_lending > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted">− Lent</span>
                  <span className="figure text-amber">{formatCurrency(balance.new_lending)}</span>
                </div>
              )}
            </Reveal>
          )}
        </div>

        {monthly && (
          <Reveal delay={260} className="card p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">{monthly.month}</p>
              <span className="chip-muted">{monthly.emis.length} EMIs</span>
            </div>
            <p className="display mt-6 text-7xl">
              {monthPct}
              <span className="text-4xl text-muted">%</span>
            </p>
            <p className="mt-1 text-sm text-muted">collected this month</p>
            <ProgressBar value={monthPct} className="mt-6" />
            <div className="mt-4 flex justify-between text-xs">
              <span className="figure text-paper">{formatCurrency(monthly.collected_total)}</span>
              <span className="figure text-muted">of {formatCurrency(monthly.expected_total)}</span>
            </div>
          </Reveal>
        )}
      </section>

      <Reveal delay={320}>
        <Ticker
          items={[
            ["Lent", formatCurrency(stats.total_principal_given)],
            ["Expected", formatCurrency(stats.total_expected_return)],
            ["Collected", formatCurrency(stats.total_collected)],
            ["Pending", formatCurrency(stats.total_pending)],
            ["Active loans", stats.active_loans],
            ["Completed", stats.completed_loans],
            ["Overdue", overdue?.count ?? 0],
          ]}
        />
      </Reveal>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] lg:grid-cols-4">
        {tiles.map((t, i) => (
          <Reveal key={t.label} delay={380 + i * 60} className="bg-ink-950 p-5 sm:p-6">
            <p className="eyebrow">{t.label}</p>
            <p className={`figure mt-5 text-xl sm:text-3xl ${t.accent ? "text-lime" : "text-paper"}`}>
              {formatCurrency(t.value)}
            </p>
            <p className="mt-2 text-xs text-muted">{t.note}</p>
          </Reveal>
        ))}
      </section>

      {/* Overdue */}
      {overdue && overdue.count > 0 && (
        <Reveal delay={420} className="overflow-hidden rounded-2xl border border-coral/25 bg-coral/[0.04]">
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-6 sm:px-6">
            <div>
              <p className="eyebrow text-coral">Needs attention</p>
              <h3 className="display mt-2 text-3xl">
                {overdue.count} overdue EMI{overdue.count > 1 ? "s" : ""}
              </h3>
            </div>
            <p className="figure text-2xl text-coral">{formatCurrency(overdue.total_outstanding)}</p>
          </div>
          <div className="divide-y divide-coral/10 border-t border-coral/10">
            {overdue.items.slice(0, 5).map((item) => (
              <Link
                key={`${item.loan_id}-${item.month_number}`}
                to={`/loans/${item.loan_id}`}
                className="row-link"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={item.borrower_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-paper">{item.borrower_name}</p>
                    <p className="text-xs text-muted">
                      Due {formatDayMonth(item.due_date)} · {item.days_overdue} days late
                    </p>
                  </div>
                </div>
                <span className="figure text-sm text-coral">{formatCurrency(item.outstanding)}</span>
              </Link>
            ))}
          </div>
          {overdue.count > 5 && (
            <Link
              to="/loans?filter=overdue"
              className="block border-t border-coral/10 px-6 py-4 text-center text-sm text-coral hover:bg-coral/[0.06]"
            >
              View all {overdue.count} overdue
            </Link>
          )}
        </Reveal>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        {/* This month */}
        {monthly && (
          <Reveal delay={460} className="card overflow-hidden">
            <SectionTitle
              action={<span className="eyebrow">{formatCurrency(monthly.pending_total)} left</span>}
            >
              This <em className="text-muted">month</em>
            </SectionTitle>
            {monthly.emis.length === 0 ? (
              <p className="px-6 pb-10 pt-4 text-sm text-muted">No EMIs due this month.</p>
            ) : (
              <div className="max-h-[440px] divide-y divide-white/[0.06] overflow-y-auto border-t border-white/[0.06] scrollbar-thin">
                {[...monthly.emis]
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .map((emi) => (
                    <Link
                      key={`${emi.loan_id}-${emi.month_number}`}
                      to={`/loans/${emi.loan_id}`}
                      className="row-link"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="w-12 shrink-0 font-mono text-xs text-muted">
                          {formatDayMonth(emi.due_date)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-paper">{emi.borrower_name}</p>
                          <p className="text-xs text-faint">Month {emi.month_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`figure text-sm ${emi.paid ? "text-muted line-through decoration-faint" : "text-paper"}`}>
                          {formatCurrency(emi.emi_amount)}
                        </span>
                        {emi.paid ? (
                          <span className="chip-lime">Paid</span>
                        ) : emi.status === "partial" ? (
                          <span className="chip-amber">Partial</span>
                        ) : (
                          <span className="chip-muted">Due</span>
                        )}
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </Reveal>
        )}

        {/* Active loans */}
        <Reveal delay={520} className="card overflow-hidden">
          <SectionTitle
            action={
              <Link to="/loans" className="link-underline text-sm">
                All loans <ArrowUpRight size={14} />
              </Link>
            }
          >
            Active <em className="text-muted">loans</em>
          </SectionTitle>
          {activeLoans.length === 0 ? (
            <div className="border-t border-white/[0.06] px-6 py-10">
              <p className="text-sm text-muted">No active loans yet.</p>
              <Link to="/add-loan" className="btn-primary mt-5">
                <Plus size={16} /> Create your first loan
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {activeLoans.slice(0, 6).map((loan) => {
                const progress = pct(loan.total_paid, loan.total_return);
                return (
                  <Link key={loan.id} to={`/loans/${loan.id}`} className="row-link group">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={loan.borrower_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-paper">{loan.borrower_name}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <ProgressBar value={progress} className="w-24" />
                          <span className="font-mono text-[11px] text-muted">
                            {loan.months_paid}/{loan.total_months}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="figure text-sm text-paper">{formatCurrency(loan.remaining)}</p>
                        <p className="text-[11px] text-faint">remaining</p>
                      </div>
                      <ArrowUpRight
                        size={16}
                        className="text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>
    </div>
  );
}
