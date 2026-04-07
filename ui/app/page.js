import Link from "next/link";

const QUICK_PROMPTS = [
  "What does Article 14 provide?",
  "Explain Article 21 in simple words.",
  "What remedies are available under Article 32?",
  "Difference between Article 19 and Article 21.",
];

const HIGHLIGHTS = [
  { value: "Constitution-first", label: "Grounded in Indian constitutional context" },
  { value: "Source-linked", label: "Every answer can cite retrieved excerpts" },
  { value: "Fast clarity", label: "Designed for direct, practical legal guidance" },
];

const LAW_PILLARS = [
  "Fundamental Rights",
  "Writ Remedies",
  "Judicial Review",
  "Directive Principles",
];

const TRUST_POINTS = [
  "Responsive legal tone presets",
  "Retrieval-aware source citations",
  "Built for constitutional reasoning",
];
export default function Page() {
  return (
    <main className="app-shell app-shell--home">
      <div className="scene-bg" aria-hidden="true">
        <span className="scene-orb scene-orb--left" />
        <span className="scene-orb scene-orb--right" />
        <span className="scene-grid" />
      </div>

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Constitutional intelligence for India</p>
          <h1 className="hero-title">
            A legal interface that feels like a modern court chamber.
          </h1>
          <p className="hero-lead">
            Adhikar AI blends source-aware constitutional retrieval with a cinematic, high-trust workspace for legal
            questions, remedies, and practical guidance.
          </p>

          <div className="hero-actions">
            <Link href="/chat" className="hero-button hero-button--primary">
              Open Chat Workspace
            </Link>
            <Link href="/chat" className="hero-button hero-button--secondary">
              Ask about writ remedies
            </Link>
          </div>

          <div className="hero-highlights">
            {HIGHLIGHTS.map((item) => (
              <article key={item.value} className="highlight-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>

          <div className="trust-row">
            {TRUST_POINTS.map((point) => (
              <span key={point} className="trust-pill">
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="law-orb law-orb--outer" />
          <div className="law-orb law-orb--inner" />
          <div className="law-structure">
            <div className="law-roof" />
            <div className="law-columns">
              <span />
              <span />
              <span />
            </div>
            <div className="law-base" />
          </div>
          <div className="law-scales">
            <span className="scale-rod" />
            <span className="scale-arm scale-arm--left" />
            <span className="scale-arm scale-arm--right" />
            <span className="scale-chain scale-chain--left" />
            <span className="scale-chain scale-chain--right" />
            <span className="scale-pan scale-pan--left" />
            <span className="scale-pan scale-pan--right" />
            <span className="scale-stand" />
          </div>
          <div className="law-ribbon">3D legal reasoning</div>
        </div>
      </section>

      <section className="workspace-grid workspace-grid--home">
        <aside className="info-panel">
          <div className="panel-card panel-card--glass panel-card--intro">
            <p className="panel-kicker">Home</p>
            <h2>Ask, compare, and reason through constitutional problems.</h2>
            <p>
              Start from this overview tab, then move to the Chat tab to begin a legal conversation. This keeps
              discovery and discussion in separate spaces.
            </p>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Legal pillars</h3>
              <span className="status-badge status-badge--ready">Ready</span>
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
              <h3>Why this split</h3>
              <span className="session-id">Home + Chat</span>
            </div>
            <p className="panel-note">The Home tab explains capabilities while Chat stays focused on question-answer flow.</p>
          </div>

          <div className="panel-card panel-card--glow">
            <h3>Suggested starts</h3>
            <div className="quick-prompts quick-prompts--stacked">
              {QUICK_PROMPTS.map((prompt) => (
                <Link key={prompt} href="/chat" className="quick-prompt-btn quick-prompt-btn--wide">
                  {prompt}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="info-panel">
          <div className="panel-card panel-card--glass panel-card--intro">
            <p className="panel-kicker">Chat Tab</p>
            <h2>Your live legal assistant is now in a separate tab.</h2>
            <p>
              Open the Chat tab from the top navigation to ask questions, continue sessions, and get source-linked
              constitutional responses.
            </p>
            <div className="hero-actions">
              <Link href="/chat" className="hero-button hero-button--primary">
                Go to Chat
              </Link>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>How to use</h3>
            </div>
            <p className="panel-note">1. Open Chat tab.</p>
            <p className="panel-note">2. Choose tone preset and ask your question.</p>
            <p className="panel-note">3. Review linked sources and continue follow-ups.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
