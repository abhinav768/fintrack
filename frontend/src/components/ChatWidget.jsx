import { useState, useRef, useEffect } from "react";
import { Sparkles, X, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { sendChatMessage } from "../api";

const SUGGESTIONS = [
  "Who owes the most?",
  "Any overdue EMIs?",
  "This month's summary",
  "Total profit so far?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const data = await sendChatMessage(msg);
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch (err) {
      const detail =
        err.response?.data?.detail || "Something went wrong. Try again.";
      setMessages((prev) => [...prev, { role: "ai", text: detail }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="group fixed bottom-24 right-5 z-40 flex h-12 items-center gap-2 rounded-full border border-line/10 bg-ink-800/90 pl-3 pr-4 text-sm text-paper shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-lime/40 md:bottom-8 md:right-8"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-onlime transition-transform duration-500 group-hover:rotate-[20deg]">
            <Sparkles size={14} />
          </span>
          <span className="hidden sm:inline">Ask FinTrack</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-24 z-50 flex h-[min(560px,calc(100vh-8rem))] animate-rise flex-col overflow-hidden rounded-3xl border border-line/10 bg-ink-900/95 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-8 sm:w-[400px] md:bottom-8">
          <div className="flex items-center justify-between border-b border-line/[0.07] px-5 py-4">
            <div>
              <p className="eyebrow">Assistant</p>
              <h3 className="display mt-1 text-2xl">
                Ask <em className="text-accent">anything</em>
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  title="Clear chat"
                  className="btn-icon hover:text-coral"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-icon" aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5 scrollbar-thin">
            {messages.length === 0 && !loading && (
              <div className="pt-2">
                <p className="text-sm text-muted">
                  I can read your loans, borrowers and payments. Try one of these:
                </p>
                <div className="mt-4 flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-line/10 px-4 py-2 text-sm text-paper transition-colors hover:border-lime/40 hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-md bg-lime text-onlime"
                      : "rounded-bl-md bg-line/[0.05] text-paper"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-line/[0.05] px-4 py-3.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-line/[0.07] p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your portfolio…"
              disabled={loading}
              maxLength={1000}
              className="input rounded-full py-2.5"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-onlime transition-opacity disabled:opacity-30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.5} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
