import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IndianRupee,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  LogOut,
} from "lucide-react";
import { useAuth } from "../AuthContext";

const GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-pink-600",
  "from-lime-500 to-emerald-600",
];

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
      setError(err.response?.data?.detail || "Failed to create profile");
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
      setError(err.response?.data?.detail || "Failed to delete profile");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
            <IndianRupee size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">FinTrack</h1>
          <p className="mt-2 text-base text-slate-400">
            Who&apos;s managing finances?
          </p>
        </div>

        {error && (
          <div className="mb-6 flex max-w-md items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-center gap-8">
          {profiles.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className="group relative flex w-32 flex-col items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:scale-110 hover:bg-white/5 focus:outline-none"
            >
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-4xl font-bold text-white shadow-lg transition-shadow duration-200 group-hover:shadow-xl group-hover:shadow-black/30 ${GRADIENTS[idx % GRADIENTS.length]}`}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="w-full truncate text-center text-sm font-medium text-slate-300 transition-colors group-hover:text-white">
                {p.name}
              </span>

              {profiles.length > 1 && (
                <button
                  onClick={(e) => handleDelete(e, p.id)}
                  disabled={deleting === p.id}
                  className="absolute -right-1 -top-1 hidden rounded-full bg-slate-700 p-1.5 text-slate-400 shadow-lg transition-colors hover:bg-red-500/20 hover:text-red-400 group-hover:block"
                >
                  {deleting === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </button>
          ))}

          {showCreate ? (
            <div className="flex w-48 flex-col items-center gap-3 rounded-2xl border border-slate-600/50 bg-slate-800/80 p-5 shadow-xl backdrop-blur">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Profile name"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2.5 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex w-full gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Create"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setNewName("");
                    setError("");
                  }}
                  className="flex-1 rounded-lg border border-slate-600 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="group flex w-32 flex-col items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:scale-110 hover:bg-white/5"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-dashed border-slate-600 text-slate-500 transition-colors duration-200 group-hover:border-emerald-500/60 group-hover:text-emerald-400">
                <Plus size={36} />
              </div>
              <span className="text-sm font-medium text-slate-500 transition-colors group-hover:text-slate-300">
                Add Profile
              </span>
            </button>
          )}
        </div>

        <div className="mt-12">
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <LogOut size={15} />
            Sign out ({user?.username})
          </button>
        </div>
      </div>
    </div>
  );
}
