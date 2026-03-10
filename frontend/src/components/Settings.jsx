import { useState, useEffect } from "react";
import {
  Bell,
  Shield,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Loader2,
  BellRing,
  User,
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
} from "../api";
import { useAuth } from "../AuthContext";

export default function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const [profileName, setProfileName] = useState(profile?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [topic, setTopic] = useState("");
  const [topic2, setTopic2] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getNotificationSettings().then((d) => {
      setTopic(d.ntfy_topic);
      setTopic2(d.ntfy_topic_2 || "");
      setSecret(d.notify_secret);
      setConfigured(d.configured);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      setToast({ type: "error", msg: "Profile name cannot be empty" });
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(profile.id, profileName.trim());
      setToast({ type: "ok", msg: "Profile name updated!" });
    } catch {
      setToast({ type: "error", msg: "Failed to update profile name" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSave = async () => {
    if (!topic || !secret) {
      setToast({ type: "error", msg: "All fields are required" });
      return;
    }
    setSaving(true);
    try {
      await updateNotificationSettings({
        ntfy_topic: topic,
        ntfy_topic_2: topic2,
        notify_secret: secret,
      });
      setConfigured(true);
      setToast({ type: "ok", msg: "Settings saved!" });
    } catch {
      setToast({ type: "error", msg: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await sendTestNotification();
      setToast({ type: "ok", msg: "Test notification sent! Check your phone." });
    } catch (e) {
      setToast({
        type: "error",
        msg: e.response?.data?.detail || "Failed to send notification",
      });
    } finally {
      setTesting(false);
    }
  };

  const generateSecret = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++)
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    setSecret(result);
  };

  const cronUrl = configured
    ? `${window.location.origin}/api/notify/daily-reminders?token=${secret}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile and notification settings
        </p>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.msg}
        </div>
      )}

      {/* Profile section */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
          <User size={18} className="text-emerald-600" /> Profile
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Profile Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingProfile ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Signed in as <strong>{user?.username}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-semibold text-blue-800">
          <Bell size={18} /> How it works
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-blue-700">
          <li>
            <strong>Step 1:</strong> Install the{" "}
            <a
              href="https://ntfy.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              ntfy app <ExternalLink size={12} />
            </a>{" "}
            on your phone and subscribe to your topic.
          </li>
          <li>
            <strong>Step 2:</strong> Enter the same topic name below, generate a
            secret token, and save.
          </li>
          <li>
            <strong>Step 3:</strong> Set up a free cron job at{" "}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              cron-job.org <ExternalLink size={12} />
            </a>{" "}
            to trigger the reminder URL daily at 9:00 AM IST.
          </li>
        </ol>
      </div>

      {/* Config form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
          <BellRing size={18} className="text-emerald-600" /> Notification
          Configuration
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ntfy Topic Name (Phone 1)
            </label>
            <input
              type="text"
              placeholder="fintrack-abhinav-reminders"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              Must match the topic you subscribed to in the ntfy app.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ntfy Topic Name (Phone 2)
              <span className="ml-1 text-xs font-normal text-slate-400">
                — optional
              </span>
            </label>
            <input
              type="text"
              placeholder="fintrack-sabina-reminders"
              value={topic2}
              onChange={(e) => setTopic2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              Optional second phone. Leave empty if not needed.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cron Secret Token
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={generateSecret}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Shield size={14} className="mr-1 inline" />
                Generate
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Secures the reminder endpoint from unauthorized access.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Settings
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !configured}
              className="flex items-center gap-2 rounded-lg border border-emerald-300 px-5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {testing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Send Test
            </button>
          </div>
        </div>
      </div>

      {/* Cron URL section */}
      {configured && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <ExternalLink size={18} className="text-emerald-600" /> Cron Job URL
          </h3>
          <p className="mb-3 text-sm text-slate-500">
            Copy this URL and set it up as a daily cron job at{" "}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 underline"
            >
              cron-job.org
            </a>{" "}
            to trigger at <strong>9:00 AM IST</strong> (3:30 AM UTC).
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 break-all">
              {cronUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cronUrl);
                setToast({ type: "ok", msg: "URL copied!" });
              }}
              className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50"
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <strong>cron-job.org schedule:</strong> Set execution time to{" "}
            <code className="rounded bg-amber-100 px-1">03:30</code> UTC (=
            9:00 AM IST). Choose &quot;Every day&quot; for frequency.
          </div>
        </div>
      )}
    </div>
  );
}
