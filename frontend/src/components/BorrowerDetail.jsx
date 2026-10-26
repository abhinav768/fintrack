import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone, ArrowUpRight } from "lucide-react";
import { getBorrower } from "../api";
import { formatCurrency, formatFullDate, errorMessage } from "../lib/format";
import { useToast } from "./Toast";
import { Avatar, EmptyState, LoanStatusChip, PageLoader, ProgressBar, Reveal } from "./ui";

export default function BorrowerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [borrower, setBorrower] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBorrower(id)
      .then(setBorrower)
      .catch((err) => toast.error(errorMessage(err, "Failed to load borrower")))
      .finally(() => setLoading(false));
  }, [id, toast]);

  if (loading) return <PageLoader />;
  if (!borrower) return <EmptyState title="Borrower not found" body="They may have been deleted." />;

  const { totals } = borrower;
  const facts = [
    { label: "Lent", value: formatCurrency(totals.lent) },
    { label: "Collected", value: formatCurrency(totals.collected), tone: "text-lime" },
    { label: "Outstanding", value: formatCurrency(totals.outstanding) },
    { label: "Overdue EMIs", value: totals.overdue_count, tone: totals.overdue_count ? "text-coral" : "" },
  ];

  return (
    <div>
      <button onClick={() => navigate(-1)} className="link-underline mb-10 text-sm text-muted">
        <ArrowLeft size={15} /> Back
      </button>

      <Reveal className="flex flex-col gap-5 border-b border-white/[0.07] pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5">
          <Avatar name={borrower.name} size="lg" />
          <div>
            <p className="eyebrow">Borrower</p>
            <h1 className="display mt-2 text-5xl sm:text-6xl">{borrower.name}</h1>
          </div>
        </div>
        {borrower.phone && (
          <a href={`tel:${borrower.phone}`} className="btn-ghost self-start sm:self-auto">
            <Phone size={14} /> {borrower.phone}
          </a>
        )}
      </Reveal>

      <Reveal delay={80} className="mb-10 grid grid-cols-2 border-b border-white/[0.07] lg:grid-cols-4">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={`py-6 ${i % 2 ? "border-l border-white/[0.07] pl-5" : "pr-5"} ${i > 0 ? "lg:border-l lg:border-white/[0.07] lg:pl-6" : ""}`}
          >
            <p className="eyebrow">{f.label}</p>
            <p className={`figure mt-3 text-xl sm:text-2xl ${f.tone || "text-paper"}`}>{f.value}</p>
          </div>
        ))}
      </Reveal>

      <Reveal delay={140} className="card overflow-hidden">
        <div className="px-5 pb-5 pt-6 sm:px-6">
          <h3 className="display text-3xl">
            Loans <em className="text-muted">({borrower.loans.length})</em>
          </h3>
        </div>
        {borrower.loans.length === 0 ? (
          <p className="border-t border-white/[0.06] px-6 py-10 text-sm text-muted">No loans for this borrower yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {borrower.loans.map((loan) => {
              const progress = loan.total_return > 0 ? (loan.total_paid / loan.total_return) * 100 : 0;
              return (
                <Link key={loan.id} to={`/loans/${loan.id}`} className="row-link group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="figure text-sm text-paper">{formatCurrency(loan.principal)}</p>
                      <LoanStatusChip status={loan.status} overdueCount={loan.overdue_count} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Given {formatFullDate(loan.loan_date)} · {loan.months_paid}/{loan.total_months} paid
                    </p>
                    <ProgressBar value={progress} tone={loan.overdue_count ? "coral" : "lime"} className="mt-3 max-w-xs" />
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
    </div>
  );
}
