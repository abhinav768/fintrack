import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone, AlertTriangle, ArrowRight } from "lucide-react";
import { getBorrower } from "../api";
import { formatCurrency, formatFullDate, errorMessage } from "../lib/format";
import { useToast } from "./Toast";

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }
  if (!borrower) return <div className="py-20 text-center text-slate-500">Borrower not found</div>;

  const { totals } = borrower;
  const cards = [
    { label: "Lent", value: formatCurrency(totals.lent), tone: "bg-blue-50 text-blue-700" },
    { label: "Collected", value: formatCurrency(totals.collected), tone: "bg-emerald-50 text-emerald-700" },
    { label: "Outstanding", value: formatCurrency(totals.outstanding), tone: "bg-amber-50 text-amber-700" },
    { label: "Overdue EMIs", value: totals.overdue_count, tone: totals.overdue_count ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600" },
  ];

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
            {borrower.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{borrower.name}</h2>
            {borrower.phone && (
              <a href={`tel:${borrower.phone}`} className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-700">
                <Phone size={13} /> {borrower.phone}
              </a>
            )}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-lg p-3.5 ${c.tone}`}>
              <p className="text-xs font-medium opacity-80">{c.label}</p>
              <p className="mt-1 text-lg font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-800">Loans ({borrower.loans.length})</h3>
        </div>
        {borrower.loans.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No loans for this borrower yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {borrower.loans.map((loan) => (
              <Link
                key={loan.id}
                to={`/loans/${loan.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/80"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatCurrency(loan.principal)} · {loan.total_months} months
                  </p>
                  <p className="text-xs text-slate-400">
                    Given {formatFullDate(loan.loan_date)} · {loan.months_paid}/{loan.total_months} paid
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {loan.overdue_count > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <AlertTriangle size={11} /> {loan.overdue_count}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${loan.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {loan.status}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(loan.remaining)}</span>
                  <ArrowRight size={14} className="text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
