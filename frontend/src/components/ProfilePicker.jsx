import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Plus, Loader2, Trash2, LogOut, X } from "lucide-react";
import { useAuth } from "../AuthContext";
import { errorMessage } from "../lib/format";
import { Wordmark } from "./Sidebar";
import { Reveal } from "./ui";

export default function ProfilePicker() {
  const { user, profiles, selectProfile, createProfile, deleteProfile, logout } =
    useAuth();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const handleSelect = (profileId) => {
    selectProfile(profileId);
    navigate("/");
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError("Profile name is required");
      return;
    }
    setError("");
    setCreating(true);
    try {
      await createProfile(newName.trim());
      setNewName("");
      setShowCreate(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to create profile"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, profileId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this profile? All its data will be removed.")) return;
    setDeleting(profileId);
    try {
      await deleteProfile(profileId);
    } catch (err) {
      setError(errorMessage(err, "Failed to delete profile"));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 px-6 py-8 sm:px-12 lg:px-20">
      <header className="flex items-center justify-between">
        <Wordmark className="text-3xl" />
        <button onClick={logout} className="link-underline text-sm text-muted">
          <LogOut size={14} /> Sign out · {user?.username}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-16">
        <Reveal as="p" className="eyebrow">
          Choose a ledger
        </Reveal>
        <Reveal delay={60} as="h1" className="display mt-4 text-6xl sm:text-7xl lg:text-8xl">
          Who&apos;s <em className="text-muted">managing</em> today?
        </Reveal>

        {error && (
          <p className="mt-8 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>
        )}

        <ul className="mt-14 border-t border-white/[0.08]">
          {profiles.map((p, idx) => (
            <Reveal as="li" key={p.id} delay={140 + idx * 70} className="border-b border-white/[0.08]">
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(p.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect(p.id)}
                className="group flex cursor-pointer items-center gap-6 py-6 outline-none transition-[padding] duration-500 hover:pl-4 focus-visible:pl-4"
              >
                <span className="font-mono text-xs text-faint transition-colors group-hover:text-lime">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="display min-w-0 flex-1 truncate text-4xl transition-colors duration-300 group-hover:text-lime sm:text-5xl">
                  {p.name}
                </span>
                {profiles.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    disabled={deleting === p.id}
                    className="btn-icon text-faint opacity-0 hover:text-coral group-hover:opacity-100"
                    aria-label={`Delete ${p.name}`}
                  >
                    {deleting === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                )}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted transition-all duration-300 group-hover:rotate-45 group-hover:border-lime group-hover:bg-lime group-hover:text-ink-950">
                  <ArrowUpRight size={20} />
                </span>
              </div>
            </Reveal>
          ))}

          <Reveal as="li" delay={140 + profiles.length * 70} className="border-b border-white/[0.08] py-6">
            {showCreate ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Profile name"
                  maxLength={100}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="display flex-1 bg-transparent text-4xl outline-none placeholder:text-ink-700"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={creating} className="btn-primary">
                    {creating ? <Loader2 size={16} className="animate-spin" /> : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                      setError("");
                    }}
                    className="btn-icon"
                    aria-label="Cancel"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="group flex items-center gap-3 text-muted transition-colors hover:text-paper"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/20 transition-colors group-hover:border-lime group-hover:text-lime">
                  <Plus size={16} />
                </span>
                Add a profile
              </button>
            )}
          </Reveal>
        </ul>
      </main>
    </div>
  );
}
