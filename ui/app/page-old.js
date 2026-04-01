"use client";

import { useEffect, useRef, useState } from "react";

const QUICK_PROMPTS = [
  "What does Article 14 provide?",
  "Explain Article 21 in simple words.",
  "What remedies are available under Article 32?",
  "Difference between Article 19 and Article 21.",
];

export default function Page() {
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [responseStyle, setResponseStyle] = useState("friendly_concise");
  const [status, setStatus] = useState("Ready");
  const [isClarifying, setIsClarifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID().slice(0, 8));
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatRef.current) {
      setTimeout(() => {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 0);
    }
  }, [messages, isSending]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSending) return;

    setQuery("");
    setMessages((prev) => [...prev, { role: "You", text: trimmed, variant: "user", sources: [] }]);
    setIsSending(true);
    setStatus("Working...");

    try {
      const response = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          session_id: sessionId,
          response_style: responseStyle,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Request failed");
      }

      const needsClarification = payload.needs_clarification === true;
      setIsClarifying(needsClarification);
      setStatus(needsClarification ? "Clarification mode" : "Answer ready");

      setMessages((prev) => [
        ...prev,
        {
          role: needsClarification ? "Need More Details" : "Adhikar AI",
          text: payload.response || "",
          variant: needsClarification ? "clarification" : "assistant",
          sources: payload.sources || [],
        },
      ]);
    } catch (error) {
      setStatus("Connection issue");
      setIsClarifying(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "System",
          text: `Error: ${error.message}`,
          variant: "system",
          sources: [],
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const statusClass = isClarifying ? "pill pill--warn" : "pill";

  return (
    <>
      <div className="orbs" aria-hidden="true">
        <span className="orb orb--one" />
        <span className="orb orb--two" />
        <span className="orb orb--three" />
      </div>

      <main className="app">
        <aside className="sidebar">
          <div className="logoWrap">
            <p className="eyebrow">Constitution-First Legal Assistant</p>
            <h1>Adhikar AI</h1>
            <p className="subtitle">A focused legal conversation workspace grounded in Constitution context.</p>
          </div>

          <section className="block">
            <h2>Session</h2>
            <div className="statusLine">
              <span className={statusClass}>{status}</span>
              <span className="sessionText">Session {sessionId}</span>
            </div>
          </section>

          <section className="block">
            <h2>Response Tone</h2>
            <select
              className="control"
              value={responseStyle}
              onChange={(e) => setResponseStyle(e.target.value)}
            >
              <option value="friendly_concise">Friendly concise</option>
              <option value="student_friendly">Student friendly</option>
              <option value="short_formal">Short formal</option>
            </select>
          </section>

          <section className="block">
            <h2>Quick Start</h2>
            <div className="chips">
              {QUICK_PROMPTS.map((item) => (
                <button key={item} type="button" className="chip" onClick={() => setQuery(item)}>
                  {item}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="chatShell">
          <header className="topbar">
            <p className="topbarLabel">Constitution Chat</p>
            <p className="topbarSub">Natural conversation with precise constitutional grounding.</p>
          </header>

          <section className="chat" aria-live="polite" ref={chatRef}>
            {messages.map((m, idx) => (
              <article key={`${m.role}-${idx}`} className={`message message--${m.variant}`}>
                <div className="messageHead">
                  <h3 className="role">{m.role}</h3>
                </div>
                <p className="text">{m.text}</p>

                {m.sources?.length > 0 && (
                  <details className="sourcesWrap">
                    <summary>Sources</summary>
                    <ul className="sources">
                      {m.sources.map((src) => (
                        <li key={`${idx}-${src.source_id}`}>
                          [Source {src.source_id}] {src.section_hint} (page {src.page})
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            ))}

            {isSending && (
              <article className="message message--assistant">
                <div className="messageHead">
                  <h3 className="role">Adhikar AI</h3>
                </div>
                <p className="typing">Thinking...</p>
              </article>
            )}
          </section>

          <form className="composer" onSubmit={submit}>
            <div className="composerInner">
              <textarea
                rows={1}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
                placeholder="Ask a constitutional question... (Enter to send, Shift+Enter for newline)"
              />
              <button id="send-btn" type="submit" disabled={isSending}>
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            <p className="composerHint">Tip: mention Article/Part + specific issue for the sharpest answers.</p>
          </form>
        </section>
      </main>
    </>
  );
}
