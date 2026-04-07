"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEYS = {
  sessionId: "adhikar.sessionId",
  responseStyle: "adhikar.responseStyle",
};

const QUICK_PROMPTS = [
  "What does Article 14 provide?",
  "Explain Article 21 in simple words.",
  "What remedies are available under Article 32?",
  "Difference between Article 19 and Article 21.",
];

const LAW_PILLARS = [
  "Fundamental Rights",
  "Writ Remedies",
  "Judicial Review",
  "Directive Principles",
];

function mapTurnsToMessages(turns) {
  return turns.flatMap((turn) => {
    const userMessage = {
      role: "You",
      text: turn.user_query,
      variant: "user",
      sources: [],
    };

    const assistantMessage = {
      role: turn.needs_clarification ? "Need More Details" : "Adhikar AI",
      text: turn.assistant_response,
      variant: turn.needs_clarification ? "clarification" : "assistant",
      sources: turn.sources || [],
    };

    return [userMessage, assistantMessage];
  });
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [responseStyle, setResponseStyle] = useState("friendly_concise");
  const [status, setStatus] = useState("Ready");
  const [isClarifying, setIsClarifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const storedSessionId = window.localStorage.getItem(STORAGE_KEYS.sessionId);
    const nextSessionId = storedSessionId || crypto.randomUUID().slice(0, 8);
    window.localStorage.setItem(STORAGE_KEYS.sessionId, nextSessionId);
    setSessionId(nextSessionId);

    const storedStyle = window.localStorage.getItem(STORAGE_KEYS.responseStyle);
    if (storedStyle) {
      setResponseStyle(storedStyle);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);

    const loadSessionHistory = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (payload.response_style) {
          setResponseStyle(payload.response_style);
          window.localStorage.setItem(STORAGE_KEYS.responseStyle, payload.response_style);
        }

        if (Array.isArray(payload.turns) && payload.turns.length > 0) {
          setMessages(mapTurnsToMessages(payload.turns));
        }

        setIsClarifying(Boolean(payload.clarification_state?.active));
      } catch {
        // Leave the session empty if history cannot be fetched.
      }
    };

    void loadSessionHistory();
  }, [sessionId]);

  useEffect(() => {
    if (!responseStyle) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.responseStyle, responseStyle);
  }, [responseStyle]);

  useEffect(() => {
    if (chatRef.current) {
      setTimeout(() => {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 0);
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + "px";
    }
  }, [query]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSending) return;

    setQuery("");
    setMessages((prev) => [...prev, { role: "You", text: trimmed, variant: "user", sources: [] }]);
    setIsSending(true);
    setStatus("Working...");

    try {
      const response = await fetch(`/api/chat`, {
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

      if (payload.response_style) {
        setResponseStyle(payload.response_style);
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

  const statusClass =
    status === "Working..." ? "status-badge--working" : isClarifying ? "status-badge--clarify" : "status-badge--ready";

  return (
    <main className="app-shell app-shell--chat">
      <div className="scene-bg" aria-hidden="true">
        <span className="scene-orb scene-orb--left" />
        <span className="scene-orb scene-orb--right" />
        <span className="scene-grid" />
      </div>

      <section className="workspace-grid">
        <aside className="info-panel">
          <div className="panel-card panel-card--glass panel-card--intro">
            <p className="panel-kicker">Chat Workspace</p>
            <h2>Ask, compare, and reason through constitutional problems.</h2>
            <p>
              The interface is tuned for long-form legal inquiry, source citations, and quick follow-up prompts. It
              stays focused while still feeling premium.
            </p>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Legal pillars</h3>
              <span className={`status-badge ${statusClass}`}>{status}</span>
            </div>
            <div className="pillar-list">
              {LAW_PILLARS.map((pillar) => (
                <span key={pillar} className="pillar-chip">
                  {pillar}
                </span>
              ))}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Session</h3>
              <span className="session-id">ID: {sessionId}</span>
            </div>
            <p className="panel-note">Tone preset: {responseStyle.replace("_", " ")}</p>
            <select className="tone-selector tone-selector--wide" value={responseStyle} onChange={(e) => setResponseStyle(e.target.value)}>
              <option value="friendly_concise">Friendly & Concise</option>
              <option value="student_friendly">Student Friendly</option>
              <option value="short_formal">Formal & Brief</option>
            </select>
          </div>

          <div className="panel-card panel-card--glow">
            <h3>Quick entry</h3>
            <div className="quick-prompts quick-prompts--stacked">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="quick-prompt-btn quick-prompt-btn--wide"
                  onClick={() => setQuery(prompt)}
                  disabled={isSending}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <div>
              <p className="chat-kicker">Constitution Chat</p>
              <h2>Compose a question and let the system reason in context.</h2>
            </div>
            <p className="chat-subtitle">Source-linked answers, follow-up support, and a calm dark courtroom aesthetic.</p>
          </header>

          <div className="chat-container" ref={chatRef}>
            <div className="messages-wrapper">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__badge">Welcome to Adhikar AI</div>
                  <h3>Start with an article, a right, or a real-world legal problem.</h3>
                  <p>
                    Ask about constitutional provisions, compare rights, or describe a dispute. The interface will keep
                    the conversation structured and easy to follow.
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <article key={`${m.role}-${idx}`} className={`message message--${m.variant}`}>
                    <div className="message-bubble">
                      <div className="message-label">{m.role}</div>
                      <p className="message-content">{m.text}</p>

                      {m.sources?.length > 0 && (
                        <details className="sources-wrap">
                          <summary>Sources ({m.sources.length})</summary>
                          <ul className="sources-list">
                            {m.sources.map((src) => (
                              <li key={`${idx}-${src.source_id}`}>
                                [Source {src.source_id}] {src.section_hint} (page {src.page})
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </article>
                ))
              )}

              {isSending && (
                <article className="message message--assistant">
                  <div className="message-bubble">
                    <div className="message-label">Adhikar AI</div>
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>

          <div className="composer-section composer-section--floating">
            <div className="composer-inner">
              <div className="controls-row">
                <div className="status-info">
                  <div className={`status-badge ${statusClass}`}>{status}</div>
                  <span className="session-id">ID: {sessionId}</span>
                </div>
                <div className="composer-meta">Enter to send, Shift+Enter for a new line</div>
              </div>

              <form className="composer-form" onSubmit={submit}>
                <div className="input-wrapper">
                  <textarea
                    ref={textareaRef}
                    className="composer-textarea"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit(e);
                      }
                    }}
                    placeholder="Ask about the Constitution or describe a legal issue..."
                    rows={1}
                    disabled={isSending}
                  />
                </div>
                <button type="submit" className="send-button" disabled={!query.trim() || isSending}>
                  {isSending ? "Sending..." : "Send"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}