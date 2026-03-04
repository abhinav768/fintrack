import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, Phone, Trash2, PlusCircle } from "lucide-react";
import { getBorrowers, createBorrower, deleteBorrower } from "../api";

export default function Borrowers() {
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const fetchBorrowers = () => {
    setLoading(true);
    getBorrowers()
      .then(setBorrowers)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBorrowers();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    try {
      await createBorrower({ name: name.trim(), phone: phone.trim() || null });
      setName("");
      setPhone("");
      setShowAdd(false);
      fetchBorrowers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add borrower");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this borrower?")) return;
    try {
      await deleteBorrower(id);
      fetchBorrowers();
    } catch (err) {
      alert(err.response?.data?.detail || "Cannot delete borrower");
    }
  };

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
          <h2 className="text-2xl font-bold text-slate-800">Borrowers</h2>
          <p className="mt-1 text-sm text-slate-500">
            {borrowers.length} registered borrowers
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <PlusCircle size={16} /> Add Borrower
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="relative flex-1">
              <Phone
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Add
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </form>
      )}

      {borrowers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
          <User size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No borrowers yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {borrowers.map((b) => (
            <div
              key={b.id}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{b.name}</h3>
                    {b.phone && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {b.phone}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="rounded-lg p-2 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  title="Delete borrower"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  <span className="font-semibold text-emerald-600">
                    {b.active_loans}
                  </span>{" "}
                  active
                </span>
                <span>
                  <span className="font-semibold text-slate-600">
                    {b.total_loans}
                  </span>{" "}
                  total loans
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
