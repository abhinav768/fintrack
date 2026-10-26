import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, Phone, Trash2, PlusCircle, Search, Pencil, Check, X } from "lucide-react";
import { getBorrowers, createBorrower, deleteBorrower, updateBorrower } from "../api";
import { errorMessage } from "../lib/format";
import { useToast } from "./Toast";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

function BorrowerCard({ borrower, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(borrower.name);
  const [phone, setPhone] = useState(borrower.phone || "");

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      await updateBorrower(borrower.id, { name: name.trim(), phone: phone.trim() || null });
      toast.success("Borrower updated");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update borrower"));
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${borrower.name}?`)) return;
    try {
      await deleteBorrower(borrower.id);
      toast.success("Borrower deleted");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, "Cannot delete borrower"));
    }
  };

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {editing ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass.replace("pl-10", "pl-3")} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="Phone" className={inputClass.replace("pl-10", "pl-3")} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cancel">
              <X size={16} />
            </button>
            <button onClick={save} className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700" aria-label="Save">
              <Check size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <Link to={`/borrowers/${borrower.id}`} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
              {borrower.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 hover:text-emerald-700">{borrower.name}</h3>
              {borrower.phone && <p className="mt-0.5 text-xs text-slate-400">{borrower.phone}</p>}
            </div>
          </Link>
          <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button onClick={() => setEditing(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Edit borrower">
              <Pencil size={14} />
            </button>
            <button onClick={remove} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Delete borrower">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          <span className="font-semibold text-emerald-600">{borrower.active_loans}</span> active
        </span>
        <span>
          <span className="font-semibold text-slate-600">{borrower.total_loans}</span> total loans
        </span>
      </div>
    </div>
  );
}

export default function Borrowers() {
  const toast = useToast();
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");

  const fetchBorrowers = useCallback(() => {
    getBorrowers()
      .then(setBorrowers)
      .catch((err) => toast.error(errorMessage(err, "Failed to load borrowers")))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchBorrowers();
  }, [fetchBorrowers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      await createBorrower({ name: name.trim(), phone: phone.trim() || null });
      setName("");
      setPhone("");
      setShowAdd(false);
      toast.success("Borrower added");
      fetchBorrowers();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add borrower"));
    }
  };

  const q = search.trim().toLowerCase();
  const visible = borrowers.filter(
    (b) => !q || b.name.toLowerCase().includes(q) || (b.phone || "").includes(q)
  );

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
          <p className="mt-1 text-sm text-slate-500">{borrowers.length} registered borrowers</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <PlusCircle size={16} /> Add Borrower
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="relative flex-1">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Phone (optional)" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
              Add
            </button>
          </div>
        </form>
      )}

      {borrowers.length > 0 && (
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
          <User size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">{borrowers.length === 0 ? "No borrowers yet" : "No borrowers match your search"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <BorrowerCard key={b.id} borrower={b} onChanged={fetchBorrowers} />
          ))}
        </div>
      )}
    </div>
  );
}
