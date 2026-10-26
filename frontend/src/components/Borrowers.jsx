import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Plus, Search, Pencil, Check, X, ArrowUpRight } from "lucide-react";
import { getBorrowers, createBorrower, deleteBorrower, updateBorrower } from "../api";
import { errorMessage } from "../lib/format";
import { useToast } from "./Toast";
import { Avatar, EmptyState, PageHeader, PageLoader, Reveal } from "./ui";

function BorrowerCard({ borrower, onChanged, delay }) {
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
    <Reveal delay={delay} className="card card-hover group flex flex-col p-5">
      {editing ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="input py-2.5" autoFocus />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="Phone" className="input py-2.5" />
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setEditing(false)} className="btn-icon" aria-label="Cancel">
              <X size={16} />
            </button>
            <button onClick={save} className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-onlime" aria-label="Save">
              <Check size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <Link to={`/borrowers/${borrower.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={borrower.name} />
            <div className="min-w-0">
              <h3 className="truncate text-[15px] text-paper">{borrower.name}</h3>
              <p className="mt-0.5 font-mono text-xs text-faint">{borrower.phone || "No phone"}</p>
            </div>
          </Link>
          <div className="flex gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button onClick={() => setEditing(true)} className="btn-icon" title="Edit borrower">
              <Pencil size={14} />
            </button>
            <button onClick={remove} className="btn-icon text-faint hover:text-coral" title="Delete borrower">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
      <Link
        to={`/borrowers/${borrower.id}`}
        className="mt-6 flex items-end justify-between border-t border-line/[0.06] pt-4"
      >
        <div className="flex gap-6">
          <div>
            <p className="figure text-2xl text-accent">{borrower.active_loans}</p>
            <p className="eyebrow mt-1">Active</p>
          </div>
          <div>
            <p className="figure text-2xl text-paper">{borrower.total_loans}</p>
            <p className="eyebrow mt-1">Total</p>
          </div>
        </div>
        <ArrowUpRight
          size={18}
          className="text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </Link>
    </Reveal>
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

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        index="04"
        eyebrow="People"
        title="Your"
        accent="borrowers"
        subtitle={`${borrowers.length} people in your book.`}
        actions={
          <button onClick={() => setShowAdd(!showAdd)} className={showAdd ? "btn-ghost" : "btn-primary"}>
            {showAdd ? <X size={16} /> : <Plus size={16} />} {showAdd ? "Close" : "Add borrower"}
          </button>
        }
      />

      {showAdd && (
        <form onSubmit={handleAdd} className="card mb-6 flex animate-rise flex-col gap-3 p-4 sm:flex-row">
          <input type="text" placeholder="Full name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="input flex-1" autoFocus />
          <input type="tel" placeholder="Phone (optional)" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className="input flex-1" />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
      )}

      {borrowers.length > 0 && (
        <Reveal delay={80} className="relative mb-6 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input rounded-full pl-11"
          />
        </Reveal>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={borrowers.length === 0 ? "No borrowers yet" : "No match"}
          body={borrowers.length === 0 ? "Add someone, or create a loan and add them there." : "Try a different name or number."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b, i) => (
            <BorrowerCard key={b.id} borrower={b} onChanged={fetchBorrowers} delay={120 + Math.min(i, 8) * 50} />
          ))}
        </div>
      )}
    </div>
  );
}
