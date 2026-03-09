import { useState, useEffect } from "react";
import {
  Bell,
  MessageCircle,
  Key,
  Shield,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Loader2,
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
} from "../api";

export default function Settings() {
  const [phone, setPhone] = useState("");
  const [apikey, setApikey] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getNotificationSettings().then((d) => {
      setPhone(d.whatsapp_phone);
      setApikey(d.whatsapp_apikey);
      setSecret(d.notify_secret);
      setConfigured(d.configured);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    if (!phone || !apikey || !secret) {
      setToast({ type: "error", msg: "All fields are required" });
      return;
    }
    setSaving(true);
    try {
      await updateNotificationSettings({
        whatsapp_phone: phone,
        whatsapp_apikey: apikey,
        notify_secret: secret,
      });
      setConfigured(true);
      setToast({ type: "ok", msg: "Settings saved successfully!" });
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
      setToast({ type: "ok", msg: "Test notification sent! Check WhatsApp." });
    } catch (e) {
      setToast({
        type: "error",
        msg: e.response?.data?.detail || "Failed to send test notification",
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
          Configure WhatsApp notifications for EMI reminders
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

      {/* Setup guide */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-semibold text-blue-800">
          <Bell size={18} /> How to set up WhatsApp notifications
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-blue-700">
          <li>
            <strong>Step 1:</strong> Send this WhatsApp message to{" "}
            <strong>+34 644 51 95 23</strong>:
            <div className="mt-1 rounded bg-white/70 px-3 py-1.5 font-mono text-xs">
              I allow callmebot to send me messages
            </div>
          </li>
          <li>
            <strong>Step 2:</strong> You'll receive an API key in the reply.
            Enter it below along with your phone number (with country code, e.g.
            +91XXXXXXXXXX).
          </li>
          <li>
            <strong>Step 3:</strong> Generate a secret token and save. Then set
            up a free cron job at{" "}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              cron-job.org <ExternalLink size={12} />
            </a>{" "}
            to call the reminder URL daily at 9:00 AM IST.
          </li>
        </ol>
      </div>

      {/* Config form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
          <MessageCircle size={18} className="text-emerald-600" /> WhatsApp
          Configuration
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Phone Number (with country code)
            </label>
            <input
              type="text"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              CallMeBot API Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="123456"
                value={apikey}
                onChange={(e) => setApikey(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Key size={18} className="mt-2.5 text-slate-400" />
            </div>
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
              This token secures the reminder endpoint from unauthorized access.
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
            <code className="flex-1 overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
              {cronUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cronUrl);
                setToast({ type: "ok", msg: "URL copied!" });
              }}
              className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50"
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <strong>cron-job.org schedule:</strong> Set execution time to{" "}
            <code className="rounded bg-amber-100 px-1">03:30</code> UTC (=
            9:00 AM IST). Choose &quot;Every day&quot; for frequency.
          </div>
        </div>
      )}
    </div>
  );
}
