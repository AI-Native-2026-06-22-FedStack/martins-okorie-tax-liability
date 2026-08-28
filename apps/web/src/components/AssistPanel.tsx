// path: apps/web/src/components/AssistPanel.tsx
// AI Assist panel for TaxPulse Plan Cycle details.
// Sends questions to the /assist endpoint and visibly renders the grounded answer and its citations.

import { useState, type FormEvent } from "react";

export type AssistCitationView = {
  id: string;
  label: string;
  href?: string;
};

export type AssistResultView = {
  answer: string;
  citations: AssistCitationView[];
};

export type AssistPanelProps = {
  endpoint?: string;
  tenantId?: string;
  buildRequest?: (question: string) => unknown;
  readResponse?: (payload: unknown) => AssistResultView;
};

export function AssistPanel({
  endpoint = "http://127.0.0.1:8000/assist",
  tenantId = "tenant-alpha-advisory",
  buildRequest = (q: string) => ({ question: q, tenant_id: tenantId }),
  readResponse = (payload: unknown): AssistResultView => {
    const raw = payload as { answer?: string; citations?: string[] };
    return {
      answer: raw.answer || "",
      citations: (raw.citations || []).map((cid: string) => ({
        id: cid,
        label: `Provision ${cid}`,
        href: `#${cid}`,
      })),
    };
  },
}: AssistPanelProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AssistResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest(question)),
      });
      if (!response.ok) throw new Error(`Assist request failed: ${response.status}`);
      setResult(readResponse(await response.json()));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Assist request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="assist-title" style={{ marginTop: "1.5rem", padding: "1.25rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
      <h2 id="assist-title" style={{ margin: "0 0 0.75rem 0", fontSize: "1.25rem", fontWeight: 600 }}>AI Assist</h2>
      <form onSubmit={submit}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Policy question
          <textarea
            aria-label="Policy question"
            style={{ display: "block", width: "100%", minHeight: "80px", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about tax provisions or calculation rules (e.g. What is the single reserve limit for TPX-RP-001-B?)"
          />
        </label>
        <button
          disabled={loading || !question.trim()}
          type="submit"
          style={{ padding: "0.5rem 1rem", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
        >
          {loading ? "Checking…" : "Ask"}
        </button>
      </form>

      {error && <p role="alert" style={{ color: "#e11d48", marginTop: "0.75rem" }}>{error}</p>}
      {result && (
        <article style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
          <p style={{ margin: "0 0 0.75rem 0", lineHeight: 1.5 }}>{result.answer}</p>
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontWeight: 600 }}>Sources</h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {result.citations.map((citation) => (
              <li key={citation.id} style={{ margin: "0.25rem 0" }}>
                {citation.href ? (
                  <a href={citation.href} style={{ color: "#0284c7", textDecoration: "underline" }}>{citation.label}</a>
                ) : (
                  citation.label
                )}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
