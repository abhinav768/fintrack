import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ArrowUpRight, Trash2, Download, Plus } from "lucide-react";
import { getLoans, deleteLoan, downloadExport } from "../api";
import { formatCurrency, formatFullDate, errorMessage } from "../lib/format";
import { useToast } from "./Toast";
import { Avatar, EmptyState, LoanStatusChip, PageHeader, PageLoader, ProgressBar, Reveal } from "./ui";

const FILTERS = ["all", "active", "overdue", "completed"];

export default function Loans() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const filter = FILTERS.includes(searchParams.get("filter")) ? searchParams.get("filter") : "all";
  const setFilter = (f) => setSearchParams(f === "all" ? {} : { filter: f });

  const fetchLoans = useCallback(() => {
    setLoading(true);
    getLoans()
      .then(setLoans)
      .catch((err) => toast.error(errorMessage(err, "Failed to load loans")))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this loan and all its payments?")) return;
    try {
      await deleteLoan(id);
      toast.success("Loan deleted");
      fetchLoans();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete loan"));
    }
  };

  const handleExport = async (kind) => {
    try {
      await downloadExport(kind);
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"));
    }
  };

  const counts = {
    all: loans.length,
    active: loans.filter((l) => l.status === "active").length,
    overdue: loans.filter((l) => l.overdue_count > 0).length,
    completed: loans.filter((l) => l.status === "completed").length,
  };

  const filtered = loans.filter((l) => {
    const matchesSearch = l.borrower_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "overdue" ? l.overdue_count > 0 : l.status === filter);
    return matchesSearch && matchesFilter;
  });

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        index="02"
        eyebrow="Ledger"
        title="All"
        accent="loans"
        subtitle={`${counts.all} loans on record, ${counts.active} still running.`}
        actions={
          <>
            <button onClick={() => handleExport("loans")} className="btn-ghost px-4">
              <Download size={14} /> Loans CSV
            </button>
            <button onClick={() => handleExport("payments")} className="btn-ghost px-4">
              <Download size={14} /> Payments CSV
            </button>
            <Link to="/add-loan" className="btn-primary">
              <Plus size={16} /> New loan
            </Link>
          </>
        }
      />

      <Reveal delay={100} className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-full border border-line/[0.07] p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm capitalize transition-colors ${
                filter === f ? "bg-paper text-ink-950" : "text-muted hover:text-paper"
              }`}
            >
              {f}
              <span className={`font-mono text-[11px] ${filter === f ? "text-ink-950/60" : "text-faint"}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Search borrower…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input rounded-full pl-11"
          />
        </div>
      </Reveal>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing here"
          body={search ? `No loans match “${search}”.` : "No loans in this view yet."}
        />
      ) : (
        <Reveal delay={160} className="card overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_120px_72px] gap-4 border-b border-line/[0.07] px-6 py-3 lg:grid">
            {["Borrower", "Principal", "Collected", "Remaining", "Progress", ""].map((h) => (
              <span key={h} className="eyebrow">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-line/[0.06]">
            {filtered.map((loan) => {
              const progress = loan.total_return > 0 ? (loan.total_paid / loan.total_return) * 100 : 0;
              return (
                <Link
                  key={loan.id}
                  to={`/loans/${loan.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-line/[0.03] sm:px-6 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_120px_72px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={loan.borrower_name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm text-paper">{loan.borrower_name}</p>
                        <LoanStatusChip status={loan.status} overdueCount={loan.overdue_count} />
                      </div>
                      <p className="mt-0.5 text-xs text-faint">
                        {formatFullDate(loan.loan_date)} · {loan.total_months} months
                      </p>
                    </div>
                  </div>
                  <span className="figure hidden text-sm text-muted lg:block">{formatCurrency(loan.principal)}</span>
                  <span className="figure hidden text-sm text-accent lg:block">{formatCurrency(loan.total_paid)}</span>
                  <div className="text-right lg:text-left">
                    <span className="figure text-sm text-paper">{formatCurrency(loan.remaining)}</span>
                    <p className="text-[11px] text-faint lg:hidden">
                      {loan.months_paid}/{loan.total_months} paid
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
                    <ProgressBar value={progress} tone={loan.overdue_count > 0 ? "coral" : "lime"} className="flex-1" />
                    <span className="w-10 text-right font-mono text-[11px] text-muted">
                      {loan.months_paid}/{loan.total_months}
                    </span>
                  </div>
                  <div className="hidden items-center justify-end gap-1 lg:flex">
                    <button
                      onClick={(e) => handleDelete(e, loan.id)}
                      className="btn-icon opacity-0 hover:text-coral group-hover:opacity-100"
                      aria-label="Delete loan"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ArrowUpRight
                      size={16}
                      className="text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      )}
    </div>
  );
}
