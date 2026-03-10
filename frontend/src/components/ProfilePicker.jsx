import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IndianRupee,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useAuth } from "../AuthContext";

const COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-pink-600",
  "bg-teal-600",
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <IndianRupee size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">FinTrack</h1>
        <p className="mt-1 text-sm text-slate-500">
          Who&apos;s managing finances?
        </p>
      </div>

      {error && (
        <div className="mb-6 flex max-w-md items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-center gap-6">
        {profiles.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className="group relative flex w-28 flex-col items-center gap-3 rounded-xl p-3 transition-transform hover:scale-105 focus:outline-none"
          >
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-md transition-shadow group-hover:shadow-lg ${COLORS[idx % COLORS.length]}`}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="w-full truncate text-center text-sm font-medium text-slate-700">
              {p.name}
            </span>

            {profiles.length > 1 && (
              <button
                onClick={(e) => handleDelete(e, p.id)}
                disabled={deleting === p.id}
                className="absolute -right-1 -top-1 hidden rounded-full bg-white p-1.5 text-slate-400 shadow-md transition-colors hover:bg-red-50 hover:text-red-500 group-hover:block"
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
          <div className="flex w-44 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Profile name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex w-full gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
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
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="group flex w-28 flex-col items-center gap-3 rounded-xl p-3 transition-transform hover:scale-105"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors group-hover:border-emerald-400 group-hover:text-emerald-500">
              <Plus size={32} />
            </div>
            <span className="text-sm font-medium text-slate-500">
              Add Profile
            </span>
          </button>
        )}
      </div>

      <div className="mt-10">
        <button
          onClick={logout}
          className="text-sm text-slate-400 transition-colors hover:text-slate-600"
        >
          Sign out ({user?.username})
        </button>
      </div>
    </div>
  );
}
