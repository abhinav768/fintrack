import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Plus, Pencil, Check } from "lucide-react";
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
import { FUNDING_SOURCES, PAYMENT_METHODS, fundingLabel } from "../lib/money";
import { useToast } from "./Toast";
import { Avatar, EmptyState, LoanStatusChip, Modal, PageLoader, ProgressBar, Reveal, Segmented } from "./ui";

function monthTone(month) {
  if (month.status === "paid") return { dot: "bg-lime border-lime", chip: <span className="chip-lime">Paid</span> };
  if (month.overdue) return { dot: "bg-coral border-coral", chip: <span className="chip-coral">Overdue</span> };
  if (month.status === "partial") return { dot: "bg-amber border-amber", chip: <span className="chip-amber">Partial</span> };
  return { dot: "bg-ink-950 border-line/25", chip: null };
}

function PaymentModal({ loanId, month, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(month.payment_id);
  const [amount, setAmount] = useState(String(month.expected_amount));
  const [date, setDate] = useState(month.payment_date || todayISO());
  const [notes, setNotes] = useState(month.notes || "");
  const [method, setMethod] = useState(month.method || "online");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount);
    if (!(value > 0)) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    setSubmitting(true);
    try {
      const body = { amount: value, payment_date: date, notes: notes || null, method };
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
      title={editing ? "Update payment" : "Record payment"}
      subtitle={`Month ${month.month_number} · ${formatMonthYear(month.due_date)} · EMI ${formatCurrency(month.expected_amount)}`}
      onClose={onClose}
    >
      <div className="mt-6 space-y-5">
        {editing && (
          <p className="rounded-xl border border-amber/20 bg-amber/10 px-4 py-3 text-xs text-amber">
            Already recorded {formatCurrency(month.paid_amount)}. Enter the new total received for this month.
          </p>
        )}
        <div>
          <label className="label">Amount received</label>
          <div className="flex items-baseline gap-2 border-b border-line/10 pb-2 focus-within:border-lime/60">
            <span className="font-display text-3xl text-muted">₹</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="display w-full bg-transparent text-5xl outline-none"
              autoFocus
            />
          </div>
          <p className="mt-2 text-xs text-muted">Less than the EMI is saved as a partial payment.</p>
        </div>
        <div>
          <label className="label">Received as</label>
          <Segmented options={PAYMENT_METHODS} value={method} onChange={setMethod} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Date</label>
            <input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Note</label>
            <input
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="input"
            />
          </div>
        </div>
      </div>
      <div className="mt-8 flex gap-3">
        <button onClick={onClose} className="btn-ghost flex-1">
          Cancel
        </button>
        <button onClick={submit} disabled={submitting} className="btn-primary flex-1">
          {submitting ? "Saving…" : editing ? "Update" : "Confirm"}
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
  const [source, setSource] = useState(loan.funding_source);
  const [submitting, setSubmitting] = useState(false);
  const locked = loan.has_payments;

  useEffect(() => {
    getBorrowers().then(setBorrowers).catch(() => toast.error("Failed to load borrowers"));
  }, [toast]);

  const submit = async () => {
    const body = { borrower_id: parseInt(borrowerId), funding_source: source };
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
    <Modal title="Edit loan" subtitle={`Loan #${loan.id}`} onClose={onClose}>
      <div className="mt-6 space-y-4">
        <div>
          <label className="label">Borrower</label>
          <select value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} className="input">
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Money from</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
            {FUNDING_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {locked ? (
          <p className="rounded-xl bg-line/[0.04] px-4 py-3 text-xs text-muted">
            Amount, rate, tenure and date are locked because payments have been recorded.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Principal</label>
              <input type="number" min="1" value={principal} onChange={(e) => setPrincipal(e.target.value)} className="input figure" />
            </div>
            <div>
              <label className="label">Rate % / mo</label>
              <input type="number" min="0" max="20" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} className="input figure" />
            </div>
            <div>
              <label className="label">Months</label>
              <input type="number" min="1" max="120" value={months} onChange={(e) => setMonths(e.target.value)} className="input figure" />
            </div>
            <div className="col-span-2">
              <label className="label">Loan date</label>
              <input type="date" value={loanDate} onChange={(e) => setLoanDate(e.target.value)} className="input" />
            </div>
          </div>
        )}
      </div>
      <div className="mt-8 flex gap-3">
        <button onClick={onClose} className="btn-ghost flex-1">
          Cancel
        </button>
        <button onClick={submit} disabled={submitting} className="btn-primary flex-1">
          {submitting ? "Saving…" : "Save"}
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

  if (loading) return <PageLoader />;
  if (!loan) return <EmptyState title="Loan not found" body="It may have been deleted." />;

  const progress = loan.total_return > 0 ? (loan.total_paid / loan.total_return) * 100 : 0;
  const facts = [
    ["Principal", formatCurrency(loan.principal)],
    ["Total return", formatCurrency(loan.total_return)],
    ["Monthly EMI", formatCurrency(loan.monthly_emi)],
    [`Interest · ${loan.monthly_rate}%/mo`, formatCurrency(loan.total_return - loan.principal)],
  ];

  return (
    <div>
      <button onClick={() => navigate(-1)} className="link-underline mb-10 text-sm text-muted">
        <ArrowLeft size={15} /> Back
      </button>

      <Reveal className="flex flex-col gap-6 border-b border-line/[0.07] pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-5">
          <Avatar name={loan.borrower_name} size="lg" />
          <div>
            <p className="eyebrow">
              Loan #{loan.id} · {formatFullDate(loan.loan_date)} · from {fundingLabel(loan.funding_source)}
            </p>
            <Link
              to={`/borrowers/${loan.borrower_id}`}
              className="display mt-2 block text-5xl transition-colors hover:text-accent sm:text-6xl"
            >
              {loan.borrower_name}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LoanStatusChip status={loan.status} overdueCount={loan.overdue_count} />
          <button onClick={() => setEditOpen(true)} className="btn-ghost px-4 py-2">
            <Pencil size={14} /> Edit
          </button>
        </div>
      </Reveal>

      <Reveal delay={80} className="grid grid-cols-2 border-b border-line/[0.07] lg:grid-cols-4">
        {facts.map(([label, value], i) => (
          <div
            key={label}
            className={`py-6 ${i % 2 ? "pl-5" : "pr-5"} ${i > 0 ? "lg:border-l lg:border-line/[0.07] lg:pl-6" : ""} ${i % 2 ? "border-l border-line/[0.07]" : ""}`}
          >
            <p className="eyebrow">{label}</p>
            <p className="figure mt-3 text-xl text-paper sm:text-2xl">{value}</p>
          </div>
        ))}
      </Reveal>

      <Reveal delay={140} className="py-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="eyebrow">Collected</p>
            <p className="display mt-2 text-4xl">
              {formatCurrency(loan.total_paid)}{" "}
              <em className="text-2xl text-muted">of {formatCurrency(loan.total_return)}</em>
            </p>
          </div>
          <span className="display text-4xl text-accent">{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} />
      </Reveal>

      <Reveal delay={200} className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-2 px-5 pb-5 pt-6 sm:px-6">
          <h3 className="display text-3xl">
            Payment <em className="text-muted">schedule</em>
          </h3>
          <p className="eyebrow">
            {formatMonthYear(loan.cycle_start_date)} — {formatMonthYear(loan.schedule[loan.schedule.length - 1].due_date)}
          </p>
        </div>

        <ol className="relative border-t border-line/[0.06]">
          {loan.schedule.map((month, idx) => {
            const tone = monthTone(month);
            const last = idx === loan.schedule.length - 1;
            return (
              <li key={month.month_number} className="group relative flex gap-4 px-5 py-5 transition-colors hover:bg-line/[0.02] sm:px-6">
                <div className="relative flex w-8 shrink-0 flex-col items-center">
                  <span className="font-mono text-[11px] text-faint">{String(month.month_number).padStart(2, "0")}</span>
                  <span className={`mt-2 flex h-3 w-3 items-center justify-center rounded-full border-2 ${tone.dot}`}>
                    {month.status === "paid" && <Check size={8} strokeWidth={4} className="text-onlime" />}
                  </span>
                  {!last && <span className="absolute top-10 h-[calc(100%-1rem)] w-px bg-line/[0.08]" />}
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-paper">{formatFullDate(month.due_date)}</p>
                      {tone.chip}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      <span className="figure">{formatCurrency(month.expected_amount)}</span> due
                      {month.status === "partial" && <> · {formatCurrency(month.outstanding)} outstanding</>}
                      {month.notes && <> · {month.notes}</>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {month.payment_id && (
                      <div className="mr-1 text-right">
                        <p className={`figure text-sm ${month.status === "paid" ? "text-accent" : "text-amber"}`}>
                          {formatCurrency(month.paid_amount)}
                        </p>
                        <p className="text-[11px] text-faint">
                          {month.method === "cash" ? "Cash" : "UPI"} · {formatFullDate(month.payment_date)}
                        </p>
                      </div>
                    )}
                    {month.payment_id ? (
                      <>
                        <button
                          onClick={() => setPayMonth(month)}
                          className="btn-icon"
                          title={month.status === "partial" ? "Top up payment" : "Edit payment"}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(month.payment_id)}
                          className="btn-icon text-faint hover:text-coral"
                          title="Remove payment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      loan.status === "active" && (
                        <button
                          onClick={() => setPayMonth(month)}
                          className={`btn px-4 py-2 text-xs ${
                            month.overdue ? "bg-coral text-onlime hover:bg-coral/90" : "border border-line/10 text-paper hover:border-lime hover:bg-lime hover:text-onlime"
                          }`}
                        >
                          <Plus size={14} /> Record
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Reveal>

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
