import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { getBorrowers, createBorrower, createLoan, previewLoan } from "../api";
import { formatCurrency, formatMonthYear, todayISO, errorMessage } from "../lib/format";
import { FUNDING_SOURCES, fundingLabel } from "../lib/money";
import { PageHeader, Reveal, Segmented } from "./ui";

function firstEmiMonth(loanDate) {
  if (!loanDate) return null;
  const [y, m] = loanDate.split("-").map(Number);
  const next = new Date(y, m, 1);
  return formatMonthYear(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
}

export default function AddLoan() {
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState([]);
  const [selectedBorrower, setSelectedBorrower] = useState("");
  const [newBorrower, setNewBorrower] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [principal, setPrincipal] = useState("");
  const [totalMonths, setTotalMonths] = useState(10);
  const [monthlyRate, setMonthlyRate] = useState("4");
  const [loanDate, setLoanDate] = useState(todayISO());
  const [fundingSource, setFundingSource] = useState("capital");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    getBorrowers()
      .then((list) => {
        setBorrowers(list);
        if (list.length === 0) setNewBorrower(true);
      })
      .catch(() => setError("Failed to load borrowers"));
  }, []);

  const principalNum = parseFloat(principal) || 0;
  const rateNum = parseFloat(monthlyRate);

  useEffect(() => {
    if (!(principalNum > 0) || !(rateNum >= 0) || !(totalMonths >= 1)) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      previewLoan({ principal: principalNum, monthly_rate: rateNum, months: totalMonths })
        .then((p) => !cancelled && setPreview(p))
        .catch(() => !cancelled && setPreview(null));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [principalNum, rateNum, totalMonths]);

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
        monthly_rate: rateNum,
        funding_source: fundingSource,
      });
      navigate("/loans");
    } catch (err) {
      setError(errorMessage(err, "Failed to create loan"));
    } finally {
      setSubmitting(false);
    }
  };

  const borrowerLabel = newBorrower
    ? name.trim() || "New borrower"
    : borrowers.find((b) => String(b.id) === selectedBorrower)?.name || "—";
  const interest = preview ? preview.total_return - principalNum : 0;

  return (
    <div>
      <PageHeader
        index="03"
        eyebrow="New entry"
        title="Lend"
        accent="money"
        subtitle="Record a loan. EMIs start the month after the loan date, with simple interest on the principal."
      />

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <Reveal delay={80} className="space-y-8">
          {/* Borrower */}
          <fieldset>
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">01 · Borrower</span>
              {borrowers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setNewBorrower(!newBorrower);
                    setSelectedBorrower("");
                  }}
                  className="link-underline text-xs"
                >
                  {newBorrower ? "Pick existing" : "+ Add new"}
                </button>
              )}
            </div>
            {newBorrower ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                />
              </div>
            ) : (
              <select
                value={selectedBorrower}
                onChange={(e) => setSelectedBorrower(e.target.value)}
                className="input appearance-none"
              >
                <option value="">Select a borrower…</option>
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.phone ? `(${b.phone})` : ""}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          {/* Amount */}
          <fieldset>
            <span className="eyebrow mb-3 block">02 · Amount</span>
            <div className="flex items-baseline gap-3 border-b border-line/10 pb-3 transition-colors focus-within:border-lime/60">
              <span className="font-display text-4xl text-muted">₹</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="display w-full bg-transparent text-6xl outline-none placeholder:text-ink-700 sm:text-7xl"
              />
            </div>
          </fieldset>

          {/* Terms */}
          <fieldset className="grid gap-6 sm:grid-cols-2">
            <div>
              <span className="eyebrow mb-3 block">03 · Tenure</span>
              <div className="flex gap-2">
                {[6, 10, 12, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTotalMonths(m)}
                    className={`flex-1 rounded-xl border py-3 font-mono text-sm transition-colors ${
                      totalMonths === m
                        ? "border-lime bg-lime text-onlime"
                        : "border-line/10 text-muted hover:border-line/25 hover:text-paper"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={totalMonths}
                  onChange={(e) => setTotalMonths(Math.min(120, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="input w-24 py-2 text-center figure"
                />
                <span className="text-xs text-muted">months (custom, up to 120)</span>
              </div>
            </div>
            <div>
              <span className="eyebrow mb-3 block">04 · Interest / month</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                  className="input pr-10 figure"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
              </div>
              <p className="mt-2 text-xs text-muted">Simple interest on principal. Default 4%.</p>
            </div>
          </fieldset>

          <fieldset>
            <span className="eyebrow mb-3 block">05 · Loan date</span>
            <input
              type="date"
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
              className="input sm:w-64"
            />
          </fieldset>

          <fieldset>
            <span className="eyebrow mb-3 block">06 · Money from</span>
            <Segmented
              options={FUNDING_SOURCES.map(({ id, label }) => ({ id, label }))}
              value={fundingSource}
              onChange={setFundingSource}
            />
            <p className="mt-2 text-xs text-muted">
              {FUNDING_SOURCES.find((s) => s.id === fundingSource).hint}
            </p>
          </fieldset>
        </Reveal>

        {/* Receipt */}
        <Reveal delay={160} className="lg:sticky lg:top-8 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-dashed border-line/10 p-6">
              <p className="eyebrow">Summary</p>
              <p className="display mt-3 truncate text-3xl">{borrowerLabel}</p>
            </div>
            <dl className="space-y-3 p-6 text-sm">
              {[
                ["Principal", formatCurrency(principalNum)],
                ["Interest", preview ? `${formatCurrency(interest)} · ${preview.interest_pct}%` : "—"],
                ["Tenure", `${totalMonths} months`],
                ["First EMI", firstEmiMonth(loanDate) || "—"],
                ["From", fundingLabel(fundingSource)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="figure text-paper">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-dashed border-line/10 p-6">
              <p className="eyebrow">Monthly EMI</p>
              <p className="display mt-2 text-5xl text-accent">
                {preview ? formatCurrency(preview.monthly_emi) : "₹0"}
              </p>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted">Total return</span>
                <span className="figure">{preview ? formatCurrency(preview.total_return) : "—"}</span>
              </div>
              {preview && preview.last_emi !== preview.monthly_emi && (
                <p className="mt-2 text-xs text-faint">
                  Last EMI is {formatCurrency(preview.last_emi)} to absorb rounding.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary mt-4 w-full py-4 text-base">
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Create loan <ArrowRight size={18} />
              </>
            )}
          </button>
        </Reveal>
      </form>
    </div>
  );
}
