import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight, Trash2 } from "lucide-react";
import { getLoans, deleteLoan } from "../api";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchLoans = () => {
    setLoading(true);
    getLoans()
      .then(setLoans)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this loan and all its payments?")) return;
    await deleteLoan(id);
    fetchLoans();
  };

  const filtered = loans.filter((l) => {
    const matchesSearch = l.borrower_name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = filter === "all" || l.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">All Loans</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loans.length} total &middot; {loans.filter((l) => l.status === "active").length} active
          </p>
        </div>
        <Link
          to="/add-loan"
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          + New Loan
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by borrower name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
          <p className="text-slate-500">No loans found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => {
            const progress =
              loan.total_return > 0
                ? (loan.total_paid / loan.total_return) * 100
                : 0;
            return (
              <Link
                key={loan.id}
                to={`/loans/${loan.id}`}
                className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
                      {loan.borrower_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {loan.borrower_name}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Loan date: {loan.loan_date} &middot; EMI starts:{" "}
                        {loan.cycle_start_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-bold text-slate-800">
                        {formatCurrency(loan.principal)}
                      </p>
                      <p className="text-xs text-slate-400">Principal</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-bold text-emerald-600">
                        {formatCurrency(loan.total_paid)}
                      </p>
                      <p className="text-xs text-slate-400">Collected</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-600">
                        {formatCurrency(loan.remaining)}
                      </p>
                      <p className="text-xs text-slate-400">Remaining</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        loan.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {loan.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, loan.id)}
                      className="rounded-lg p-2 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ArrowRight
                      size={16}
                      className="text-slate-300 transition-colors group-hover:text-emerald-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {loan.months_paid} of {loan.total_months} months paid
                    </span>
                    <span className="font-medium">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        loan.status === "completed"
                          ? "bg-emerald-500"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
