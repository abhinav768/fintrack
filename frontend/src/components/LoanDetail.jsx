import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  IndianRupee,
  Calendar,
  Trash2,
  Plus,
} from "lucide-react";
import { getLoan, addPayment, deletePayment } from "../api";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function formatFullDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchLoan = () => {
    getLoan(id)
      .then(setLoan)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLoan();
  }, [id]);

  const handlePay = async () => {
    if (!payModal) return;
    setSubmitting(true);
    try {
      await addPayment(id, {
        amount: payModal.expected_amount,
        month_number: payModal.month_number,
        payment_date: payDate,
        notes: payNotes || null,
      });
      setPayModal(null);
      setPayNotes("");
      fetchLoan();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!confirm("Remove this payment record?")) return;
    await deletePayment(paymentId);
    fetchLoan();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="py-20 text-center text-slate-500">Loan not found</div>
    );
  }

  const progress =
    loan.total_return > 0 ? (loan.total_paid / loan.total_return) * 100 : 0;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
              {loan.borrower_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {loan.borrower_name}
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                Loan #{loan.id} &middot; Given on {formatFullDate(loan.loan_date)}
              </p>
            </div>
          </div>
          <span
            className={`self-start rounded-full px-3 py-1.5 text-sm font-semibold ${
              loan.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {loan.status === "active" ? "Active" : "Completed"}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-3.5">
            <p className="text-xs font-medium text-blue-500">Principal</p>
            <p className="mt-1 text-lg font-bold text-blue-700">
              {formatCurrency(loan.principal)}
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3.5">
            <p className="text-xs font-medium text-purple-500">Total Return</p>
            <p className="mt-1 text-lg font-bold text-purple-700">
              {formatCurrency(loan.total_return)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3.5">
            <p className="text-xs font-medium text-emerald-500">Monthly EMI</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {formatCurrency(loan.monthly_emi)}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3.5">
            <p className="text-xs font-medium text-amber-500">
              Interest ({loan.interest_rate}%)
            </p>
            <p className="mt-1 text-lg font-bold text-amber-700">
              {formatCurrency(loan.total_return - loan.principal)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Collection: {formatCurrency(loan.total_paid)} of{" "}
              {formatCurrency(loan.total_return)}
            </span>
            <span className="font-semibold text-emerald-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Payment schedule */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-800">
            Payment Schedule
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            EMI cycle: {formatDate(loan.cycle_start_date)} &mdash;{" "}
            {formatDate(loan.schedule[loan.schedule.length - 1].due_date)}
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {loan.schedule.map((month) => (
            <div
              key={month.month_number}
              className={`px-4 py-4 sm:px-6 ${
                month.paid ? "bg-emerald-50/40" : ""
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:h-10 sm:w-10 ${
                    month.paid
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {month.month_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Month {month.month_number} &mdash;{" "}
                        {formatDate(month.due_date)}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <IndianRupee size={11} />
                        {formatCurrency(month.expected_amount)} expected
                        {month.paid && month.notes && (
                          <span className="ml-1 text-slate-400">
                            &middot; {month.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {month.paid ? (
                        <>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                              <CheckCircle2 size={15} />
                              {formatCurrency(month.paid_amount)}
                            </div>
                            <p className="text-xs text-slate-400">
                              {formatFullDate(month.payment_date)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeletePayment(month.payment_id)}
                            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Remove payment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setPayModal(month)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 sm:text-sm"
                        >
                          <Plus size={14} />
                          <span className="hidden sm:inline">Record</span> Pay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">
              Record Payment
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Month {payModal.month_number} &mdash;{" "}
              {formatDate(payModal.due_date)}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Amount
                </label>
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <IndianRupee size={16} className="mr-2 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(payModal.expected_amount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Payment Date
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Paid via UPI"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setPayModal(null);
                  setPayNotes("");
                }}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={submitting}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
