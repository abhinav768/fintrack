import { useState, useEffect } from "react";
import {
  Bell,
  Phone,
  Key,
  Shield,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Loader2,
  MessageSquare,
  Hash,
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
} from "../api";

export default function Settings() {
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [fromNum, setFromNum] = useState("");
  const [phone, setPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getNotificationSettings().then((d) => {
      setSid(d.twilio_sid);
      setToken(d.twilio_token);
      setFromNum(d.twilio_from);
      setPhone(d.notify_phone);
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
    if (!sid || !token || !fromNum || !phone || !secret) {
      setToast({ type: "error", msg: "All fields are required" });
      return;
    }
    setSaving(true);
    try {
      await updateNotificationSettings({
        twilio_sid: sid,
        twilio_token: token,
        twilio_from: fromNum,
        notify_phone: phone,
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
      setToast({ type: "ok", msg: "Test SMS sent! Check your phone." });
    } catch (e) {
      setToast({
        type: "error",
        msg: e.response?.data?.detail || "Failed to send test SMS",
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
          Configure SMS notifications for EMI reminders via Twilio
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
          <Bell size={18} /> How to set up SMS notifications
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-blue-700">
          <li>
            <strong>Step 1:</strong> Sign up for a free{" "}
            <a
              href="https://www.twilio.com/try-twilio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              Twilio account <ExternalLink size={12} />
            </a>{" "}
            — you get ~$15 trial credit (enough for 300+ SMS).
          </li>
          <li>
            <strong>Step 2:</strong> Verify your phone number during signup.
            From the Twilio Console, copy your <strong>Account SID</strong>,{" "}
            <strong>Auth Token</strong>, and the{" "}
            <strong>Twilio phone number</strong> assigned to you.
          </li>
          <li>
            <strong>Step 3:</strong> Fill in the fields below, generate a secret
            token, and save. Then set up a free cron job at{" "}
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
          <MessageSquare size={18} className="text-emerald-600" /> Twilio SMS
          Configuration
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Account SID
            </label>
            <div className="flex items-center gap-2">
              <Hash size={16} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={sid}
                onChange={(e) => setSid(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Auth Token
            </label>
            <div className="flex items-center gap-2">
              <Key size={16} className="shrink-0 text-slate-400" />
              <input
                type="password"
                placeholder="Your Twilio Auth Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Twilio Phone Number (sender)
            </label>
            <div className="flex items-center gap-2">
              <Phone size={16} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="+1XXXXXXXXXX"
                value={fromNum}
                onChange={(e) => setFromNum(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              The phone number Twilio assigned to your account (found in Console
              &gt; Phone Numbers).
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Your Phone Number (receiver)
            </label>
            <div className="flex items-center gap-2">
              <Phone size={16} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Your number with country code. Must be verified in Twilio during
              trial.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cron Secret Token
            </label>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2">
                <Shield size={16} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={generateSecret}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
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
              Send Test SMS
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
