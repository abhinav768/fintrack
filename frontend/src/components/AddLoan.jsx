import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IndianRupee,
  Calendar,
  User,
  Phone,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { getBorrowers, createBorrower, createLoan } from "../api";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function AddLoan() {
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState([]);
  const [selectedBorrower, setSelectedBorrower] = useState("");
  const [newBorrower, setNewBorrower] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [principal, setPrincipal] = useState("");
  const [totalMonths, setTotalMonths] = useState(10);
  const [loanDate, setLoanDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBorrowers().then(setBorrowers);
  }, []);

  const principalNum = parseFloat(principal) || 0;
  const interestPct = 4 * totalMonths;
  const totalReturn = principalNum * (1 + interestPct / 100);
  const monthlyEmi = totalMonths > 0 ? totalReturn / totalMonths : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!principal || principalNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      let borrowerId;
      if (newBorrower) {
        if (!name.trim()) {
          setError("Please enter borrower name");
          setSubmitting(false);
          return;
        }
        const b = await createBorrower({
          name: name.trim(),
          phone: phone.trim() || null,
        });
        borrowerId = b.id;
      } else {
        if (!selectedBorrower) {
          setError("Please select a borrower");
          setSubmitting(false);
          return;
        }
        borrowerId = parseInt(selectedBorrower);
      }

      await createLoan({
        borrower_id: borrowerId,
        principal: principalNum,
        loan_date: loanDate,
        total_months: totalMonths,
      });
      navigate("/loans");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create loan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Create New Loan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Record a new lending transaction
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Borrower selection */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">
                Borrower
              </label>
              <button
                type="button"
                onClick={() => {
                  setNewBorrower(!newBorrower);
                  setSelectedBorrower("");
                }}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                {newBorrower ? (
                  "Select existing"
                ) : (
                  <>
                    <PlusCircle size={12} /> Add new
                  </>
                )}
              </button>
            </div>

            {newBorrower ? (
              <div className="space-y-3">
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Borrower name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Phone number (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            ) : (
              <select
                value={selectedBorrower}
                onChange={(e) => setSelectedBorrower(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select a borrower...</option>
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.phone ? `(${b.phone})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Principal amount */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Principal Amount
            </label>
            <div className="relative">
              <IndianRupee
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 10000"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          {/* Tenure */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Tenure (Months)
            </label>
            <div className="flex gap-2">
              {[10, 15].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTotalMonths(m)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    totalMonths === m
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {m} months
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="60"
                value={totalMonths}
                onChange={(e) =>
                  setTotalMonths(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Quick pick 10 or 15, or type any custom duration
            </p>
          </div>

          {/* Loan date */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Loan Date
            </label>
            <div className="relative">
              <Calendar
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={loanDate}
                onChange={(e) => setLoanDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              EMI cycle will start from the following month
            </p>
          </div>

          {/* Preview */}
          {principalNum > 0 && (
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-emerald-800">
                Loan Summary
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-emerald-600">Principal</p>
                  <p className="text-base font-bold text-emerald-800">
                    {formatCurrency(principalNum)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600">
                    Total Return ({interestPct}%)
                  </p>
                  <p className="text-base font-bold text-emerald-800">
                    {formatCurrency(totalReturn)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600">Monthly EMI</p>
                  <p className="text-base font-bold text-emerald-800">
                    {formatCurrency(monthlyEmi)}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-emerald-200 pt-3 text-center text-xs text-emerald-600">
                {totalMonths} monthly installments of{" "}
                {formatCurrency(monthlyEmi)} each
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? (
              "Creating..."
            ) : (
              <>
                Create Loan <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
