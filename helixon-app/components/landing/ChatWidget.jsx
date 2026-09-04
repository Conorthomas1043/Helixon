"use client";
import { useState, useRef, useEffect } from "react";

const SUGGESTIONS = ["How does scoring work?", "What's included in the individual plan?", "Is my data secure?"];

// How far to lift the widget when the footer is in view, in px.
// Tuned to clear the footer's bottom-right "Login" link at common widths.
const FOOTER_CLEARANCE_PX = 88;

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [footerOffset, setFooterOffset] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Fix #3 — the launcher/panel are position:fixed to the bottom-right
  // corner, so they collide with whatever else lands there, e.g. the
  // footer's "Login" link. Watch the footer and lift the widget clear of
  // it while it's in view, instead of a magic-number bottom offset that
  // only happens to work at one viewport size.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const obs = new IntersectionObserver(
      ([entry]) => setFooterOffset(entry.isIntersecting ? FOOTER_CLEARANCE_PX : 0),
      { threshold: 0 }
    );
    obs.observe(footer);
    return () => obs.disconnect();
  }, []);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      let data;
      try { data = await res.json(); } catch { data = null; }

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      {/* ── Launcher ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat with Helixon assistant"}
        aria-expanded={open}
        className="fixed right-5 z-40 w-14 h-14 rounded-full bg-forest text-white shadow-raise flex items-center justify-center hover:bg-forest-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        style={{
          bottom: `calc(1.25rem + ${footerOffset}px)`,
          transition: "bottom 0.25s ease, background-color 0.15s ease",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        )}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Helixon assistant chat"
          className="fixed right-5 z-40 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] flex flex-col rounded-card border border-border bg-white shadow-raise overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            bottom: `calc(6rem + ${footerOffset}px)`,
            transition: "bottom 0.25s ease",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-mist shrink-0">
            <div className="w-8 h-8 rounded-btn flex items-center justify-center bg-forest shrink-0">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" className="fill-gold" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink font-display leading-tight">Helixon Assistant</p>
              <p className="text-2xs text-ink/45">Ask about pricing, scoring, or how it works</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div>
                <p className="text-xs leading-relaxed text-ink/60 mb-3">
                  Hi — I can answer questions about Helixon while you look around. What would you like to know?
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-3 py-2 rounded-btn border border-border text-ink/70 hover:bg-mint hover:border-mint transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] text-xs leading-relaxed rounded-btn px-3.5 py-2.5 ${
                    m.role === "user" ? "bg-forest text-white" : "bg-mist text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-mist rounded-btn"><TypingDots /></div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-btn bg-score-low/10 border border-score-low/30">
                <p className="text-xs text-score-low">{error}</p>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3 border-t border-border shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a question…"
              disabled={loading}
              className="flex-1 text-sm bg-mist rounded-btn px-3.5 py-2.5 outline-none text-ink placeholder:text-ink/40 focus:ring-2 focus:ring-forest disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-9 h-9 shrink-0 rounded-btn bg-forest text-white flex items-center justify-center hover:bg-forest-deep disabled:bg-border disabled:text-ink/40 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}