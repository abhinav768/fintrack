import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { createTransfer, deleteTransfer, getTransfers } from "../api";
import { errorMessage, formatCurrency, formatFullDate, todayISO } from "../lib/format";
import { useToast } from "./Toast";
import { Modal, Segmented } from "./ui";

const DIRECTIONS = [
  { id: "deposit", label: "Deposit cash to bank" },
  { id: "withdraw", label: "Withdraw to cash" },
];

export default function MoveMoney({ onClose, onChanged }) {
  const toast = useToast();
  const [direction, setDirection] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  const load = () => getTransfers().then(setHistory).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const value = parseFloat(amount);
    if (!(value > 0)) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    setSaving(true);
    try {
      await createTransfer({ direction, amount: value, transfer_date: date, notes: notes || null });
      toast.success(direction === "deposit" ? "Cash deposited to bank" : "Withdrawal recorded");
      setAmount("");
      setNotes("");
      load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to record transfer"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Remove this transfer?")) return;
    try {
      await deleteTransfer(id);
      load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove transfer"));
    }
  };

  return (
    <Modal
      title="Move money"
      subtitle="Moves money between cash in hand and the collection account. Your total stays the same."
      onClose={onClose}
    >
      <div className="mt-6 space-y-5">
        <Segmented options={DIRECTIONS} value={direction} onChange={setDirection} />
        <div>
          <label className="label">Amount</label>
          <div className="flex items-baseline gap-2 border-b border-line/10 pb-2 focus-within:border-accent/60">
            <span className="font-display text-3xl text-muted">₹</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              className="display w-full bg-transparent text-5xl outline-none placeholder:text-ink-700"
              autoFocus
            />
          </div>
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
              placeholder="e.g. HDFC branch"
              className="input"
            />
          </div>
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full">
          {saving ? "Saving…" : "Record transfer"}
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-2">Recent</p>
          <ul className="max-h-48 divide-y divide-line/[0.06] overflow-y-auto scrollbar-thin">
            {history.slice(0, 20).map((t) => (
              <li key={t.id} className="group flex items-center gap-3 py-2.5 text-sm">
                {t.direction === "deposit" ? (
                  <ArrowUpRight size={15} className="text-accent" />
                ) : (
                  <ArrowDownLeft size={15} className="text-amber" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-paper">{t.direction === "deposit" ? "Deposited" : "Withdrew"}</p>
                  <p className="truncate text-xs text-faint">
                    {formatFullDate(t.transfer_date)}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <span className="figure text-paper">{formatCurrency(t.amount)}</span>
                <button onClick={() => remove(t.id)} className="btn-icon text-faint hover:text-coral" aria-label="Remove transfer">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
