import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Calendar,
  Trash2,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import {
  getLoan,
  addPayment,
  updatePayment,
  deletePayment,
  updateLoan,
  getBorrowers,
} from "../api";
import {
  formatCurrency,
  formatMonthYear,
  formatFullDate,
  todayISO,
  errorMessage,
} from "../lib/format";
import { useToast } from "./Toast";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

function rowStyle(month) {
  if (month.status === "paid") return { row: "bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700" };
  if (month.overdue) return { row: "bg-red-50/40", badge: "bg-red-100 text-red-700" };
  if (month.status === "partial") return { row: "bg-amber-50/40", badge: "bg-amber-100 text-amber-700" };
  return { row: "", badge: "bg-slate-100 text-slate-500" };
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PaymentModal({ loanId, month, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(month.payment_id);
  const [amount, setAmount] = useState(String(month.expected_amount));
  const [date, setDate] = useState(month.payment_date || todayISO());
  const [notes, setNotes] = useState(month.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount);
    if (!(value > 0)) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    setSubmitting(true);
    try {
      const body = { amount: value, payment_date: date, notes: notes || null };
      if (editing) await updatePayment(month.payment_id, body);
      else await addPayment(loanId, { ...body, month_number: month.month_number });
      toast.success(editing ? "Payment updated" : "Payment recorded");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save payment"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editing ? "Update Payment" : "Record Payment"}
      subtitle={`Month ${month.month_number} — ${formatMonthYear(month.due_date)} · EMI ${formatCurrency(month.expected_amount)}`}
      onClose={onClose}
    >
      <div className="mt-5 space-y-4">
        {editing && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Already recorded: {formatCurrency(month.paid_amount)}. Enter the new total received for this month.
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Amount received</label>
          <div className="relative">
            <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">Less than the EMI is saved as a partial payment.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment date</label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              max={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Paid via UPI"
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : editing ? "Update" : "Confirm Payment"}
        </button>
      </div>
    </Modal>
  );
}

function EditLoanModal({ loan, onClose, onSaved }) {
  const toast = useToast();
  const [borrowers, setBorrowers] = useState([]);
  const [borrowerId, setBorrowerId] = useState(String(loan.borrower_id));
  const [principal, setPrincipal] = useState(String(loan.principal));
  const [rate, setRate] = useState(String(loan.monthly_rate));
  const [months, setMonths] = useState(String(loan.total_months));
  const [loanDate, setLoanDate] = useState(loan.loan_date);
  const [submitting, setSubmitting] = useState(false);
  const locked = loan.has_payments;

  useEffect(() => {
    getBorrowers().then(setBorrowers).catch(() => toast.error("Failed to load borrowers"));
  }, [toast]);

  const submit = async () => {
    const body = { borrower_id: parseInt(borrowerId) };
    if (!locked) {
      Object.assign(body, {
        principal: parseFloat(principal),
        monthly_rate: parseFloat(rate),
        total_months: parseInt(months),
        loan_date: loanDate,
      });
    }
    setSubmitting(true);
    try {
      await updateLoan(loan.id, body);
      toast.success("Loan updated");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update loan"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Edit Loan" subtitle={`Loan #${loan.id}`} onClose={onClose}>
      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Borrower</label>
          <select value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} className={inputClass}>
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {locked ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Amount, rate, tenure and date are locked because payments have been recorded.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Principal</label>
              <input type="number" min="1" value={principal} onChange={(e) => setPrincipal(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Rate (% / month)</label>
              <input type="number" min="0" max="20" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Months</label>
              <input type="number" min="1" max="120" value={months} onChange={(e) => setMonths(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Loan date</label>
              <input type="date" value={loanDate} onChange={(e) => setLoanDate(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payMonth, setPayMonth] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchLoan = useCallback(
    () =>
      getLoan(id)
        .then(setLoan)
        .catch((err) => toast.error(errorMessage(err, "Failed to load loan")))
        .finally(() => setLoading(false)),
    [id, toast]
  );

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  const handleDeletePayment = async (paymentId) => {
    if (!confirm("Remove this payment record?")) return;
    try {
      await deletePayment(paymentId);
      toast.success("Payment removed");
      fetchLoan();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove payment"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!loan) {
    return <div className="py-20 text-center text-slate-500">Loan not found</div>;
  }

  const progress = loan.total_return > 0 ? (loan.total_paid / loan.total_return) * 100 : 0;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
              {loan.borrower_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <Link to={`/borrowers/${loan.borrower_id}`} className="text-xl font-bold text-slate-800 hover:text-emerald-700">
                {loan.borrower_name}
              </Link>
              <p className="mt-0.5 text-sm text-slate-400">
                Loan #{loan.id} &middot; Given on {formatFullDate(loan.loan_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            {loan.overdue_count > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
                <AlertTriangle size={14} /> {loan.overdue_count} overdue
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                loan.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {loan.status === "active" ? "Active" : "Completed"}
            </span>
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              title="Edit loan"
            >
              <Pencil size={15} />
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-3.5">
            <p className="text-xs font-medium text-blue-500">Principal</p>
            <p className="mt-1 text-lg font-bold text-blue-700">{formatCurrency(loan.principal)}</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3.5">
            <p className="text-xs font-medium text-purple-500">Total Return</p>
            <p className="mt-1 text-lg font-bold text-purple-700">{formatCurrency(loan.total_return)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3.5">
            <p className="text-xs font-medium text-emerald-500">Monthly EMI</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">{formatCurrency(loan.monthly_emi)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3.5">
            <p className="text-xs font-medium text-amber-500">
              Interest ({loan.monthly_rate}%/mo · {loan.interest_rate}%)
            </p>
            <p className="mt-1 text-lg font-bold text-amber-700">
              {formatCurrency(loan.total_return - loan.principal)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Collection: {formatCurrency(loan.total_paid)} of {formatCurrency(loan.total_return)}
            </span>
            <span className="font-semibold text-emerald-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-800">Payment Schedule</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            EMI cycle: {formatMonthYear(loan.cycle_start_date)} &mdash;{" "}
            {formatMonthYear(loan.schedule[loan.schedule.length - 1].due_date)}
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {loan.schedule.map((month) => {
            const style = rowStyle(month);
            return (
              <div key={month.month_number} className={`px-4 py-4 sm:px-6 ${style.row}`}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:h-10 sm:w-10 ${style.badge}`}
                  >
                    {month.month_number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {formatFullDate(month.due_date)}
                          {month.overdue && <span className="ml-2 text-xs font-medium text-red-600">Overdue</span>}
                          {month.status === "partial" && !month.overdue && (
                            <span className="ml-2 text-xs font-medium text-amber-600">Partial</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatCurrency(month.expected_amount)} due
                          {month.status === "partial" && <> &middot; {formatCurrency(month.outstanding)} outstanding</>}
                          {month.notes && <> &middot; {month.notes}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        {month.payment_id && (
                          <div className="text-right">
                            <div
                              className={`flex items-center justify-end gap-1.5 text-sm font-semibold ${
                                month.status === "paid" ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              {month.status === "paid" && <CheckCircle2 size={15} />}
                              {formatCurrency(month.paid_amount)}
                            </div>
                            <p className="text-xs text-slate-400">{formatFullDate(month.payment_date)}</p>
                          </div>
                        )}
                        {month.payment_id ? (
                          <>
                            <button
                              onClick={() => setPayMonth(month)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                              title={month.status === "partial" ? "Top up payment" : "Edit payment"}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(month.payment_id)}
                              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                              title="Remove payment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          loan.status === "active" && (
                            <button
                              onClick={() => setPayMonth(month)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 sm:text-sm"
                            >
                              <Plus size={14} />
                              <span className="hidden sm:inline">Record</span> Pay
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {payMonth && (
        <PaymentModal
          loanId={loan.id}
          month={payMonth}
          onClose={() => setPayMonth(null)}
          onSaved={() => {
            setPayMonth(null);
            fetchLoan();
          }}
        />
      )}
      {editOpen && (
        <EditLoanModal
          loan={loan}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            fetchLoan();
          }}
        />
      )}
    </div>
  );
}
