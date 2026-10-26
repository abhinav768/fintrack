import { useState, useEffect } from "react";
import { Send, ExternalLink, Copy, Loader2, RefreshCw } from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  generateNotifySecret,
  changePassword,
} from "../api";
import { useAuth } from "../AuthContext";
import { errorMessage } from "../lib/format";
import { useToast } from "./Toast";
import { PageHeader, Reveal } from "./ui";

function Section({ index, title, body, children, delay }) {
  return (
    <Reveal delay={delay} className="grid gap-6 border-b border-line/[0.07] py-10 lg:grid-cols-[280px_1fr] lg:gap-12">
      <div>
        <p className="font-mono text-[11px] text-accent">{index}</p>
        <h2 className="display mt-2 text-3xl">{title}</h2>
        {body && <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </Reveal>
  );
}

export default function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const toast = useToast();
  const [profileName, setProfileName] = useState(profile?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [topic, setTopic] = useState("");
  const [topic2, setTopic2] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    getNotificationSettings()
      .then((d) => {
        setTopic(d.ntfy_topic);
        setTopic2(d.ntfy_topic_2 || "");
        setSecret(d.notify_secret);
        setConfigured(d.configured);
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load notification settings")));
  }, [toast]);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Profile name cannot be empty");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(profile.id, profileName.trim());
      toast.success("Profile name updated");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update profile name"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSave = async () => {
    if (!topic || !secret) {
      toast.error("Topic and secret are required");
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
      toast.success("Notification settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await sendTestNotification();
      toast.success("Test notification sent. Check your phone.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to send notification"));
    } finally {
      setTesting(false);
    }
  };

  const generateSecret = async () => {
    try {
      const { notify_secret } = await generateNotifySecret();
      setSecret(notify_secret);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to generate secret"));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to change password"));
    } finally {
      setChangingPassword(false);
    }
  };

  const copy = (value, label) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const cronUrl = `${window.location.origin}/api/notify/daily-reminders`;

  return (
    <div>
      <PageHeader index="05" eyebrow="Preferences" title="Settings" />

      <Section delay={60} index="01" title="Profile" body={`Signed in as ${user?.username}.`}>
        <label className="label">Profile name</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={profileName}
            maxLength={100}
            onChange={(e) => setProfileName(e.target.value)}
            className="input flex-1"
          />
          <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary">
            {savingProfile && <Loader2 size={16} className="animate-spin" />} Save
          </button>
        </div>
      </Section>

      <Section delay={120} index="02" title="Password" body="Use at least 8 characters. You stay signed in on this device.">
        <form onSubmit={handleChangePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
          />
          <button type="submit" disabled={changingPassword || !currentPassword || !newPassword} className="btn-primary">
            {changingPassword && <Loader2 size={16} className="animate-spin" />} Update
          </button>
        </form>
      </Section>

      <Section
        delay={180}
        index="03"
        title="Reminders"
        body="Get a push notification on the morning an EMI is due."
      >
        <ol className="mb-8 space-y-3 text-sm text-muted">
          {[
            <>
              Install the{" "}
              <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" className="link-underline">
                ntfy app <ExternalLink size={11} />
              </a>{" "}
              and subscribe to a topic name.
            </>,
            <>Enter the same topic below, generate a secret and save.</>,
            <>
              Create a daily job on{" "}
              <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="link-underline">
                cron-job.org <ExternalLink size={11} />
              </a>{" "}
              using the URL and header shown after saving.
            </>,
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-mono text-xs text-faint">0{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label">Topic · phone 1</label>
            <input
              type="text"
              placeholder="fintrack-reminders"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Topic · phone 2 (optional)</label>
            <input
              type="text"
              placeholder="Leave empty if not needed"
              value={topic2}
              onChange={(e) => setTopic2(e.target.value)}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Cron secret</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="input flex-1 font-mono text-xs"
              />
              <button onClick={generateSecret} className="btn-ghost px-4" title="Generate a new secret">
                <RefreshCw size={14} /> <span className="hidden sm:inline">Generate</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" />} Save reminders
          </button>
          <button onClick={handleTest} disabled={testing || !configured} className="btn-ghost">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />} Send test
          </button>
        </div>

        {configured && (
          <div className="card mt-8 p-5">
            <p className="eyebrow">Cron job · daily at 03:30 UTC (9:00 IST)</p>
            <div className="mt-4 space-y-2">
              {[
                { label: "URL", shown: cronUrl, value: cronUrl },
                { label: "Header", shown: `X-Notify-Token: ${secret}`, value: secret, copyLabel: "Token" },
              ].map(({ label, shown, value, copyLabel }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 font-mono text-[11px] text-faint">{label}</span>
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-ink-950 px-3 py-2.5 font-mono text-xs text-paper scrollbar-thin">
                    {shown}
                  </code>
                  <button onClick={() => copy(value, copyLabel || label)} className="btn-icon" title={`Copy ${label}`}>
                    <Copy size={15} />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              On cron-job.org add the header under Advanced → Headers. Keeping the secret out of the URL keeps it out of logs.
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}
