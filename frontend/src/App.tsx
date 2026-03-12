import { useEffect, useState } from "react";
import {
  API_BASE_URL,
  getConsentStatus,
  grantConsent,
  revokeConsent,
  type ConsentStatus,
} from "./api";
import "./App.css";

type ViewState = {
  consent: ConsentStatus | null;
  session: string | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
};

const initialState: ViewState = {
  consent: null,
  session: null,
  isLoading: true,
  isMutating: false,
  error: null,
};

function App() {
  const [state, setState] = useState<ViewState>(initialState);

  const loadConsent = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getConsentStatus();
      setState((prev) => ({
        ...prev,
        consent: result.consent,
        session: result.session,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to fetch consent status.",
      }));
    }
  };

  useEffect(() => {
    void loadConsent();
  }, []);

  const updateConsent = async (action: "grant" | "revoke") => {
    setState((prev) => ({ ...prev, isMutating: true, error: null }));

    try {
      const result = action === "grant" ? await grantConsent() : await revokeConsent();
      setState((prev) => ({
        ...prev,
        consent: result.consent,
        session: result.session,
        isMutating: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isMutating: false,
        error: error instanceof Error ? error.message : "Unable to update consent.",
      }));
    }
  };

  return (
    <main className="app-shell">
      <h1>RCPD Frontend Foundation</h1>
      <p className="subtitle">PR1: Consent management MVP</p>

      <section className="card" aria-live="polite">
        <div className="row">
          <span className="label">API Base URL</span>
          <code>{API_BASE_URL}</code>
        </div>

        <div className="row">
          <span className="label">Session</span>
          <code>{state.session ?? "Not available yet"}</code>
        </div>

        <div className="row">
          <span className="label">Consent Status</span>
          <strong>
            {state.isLoading ? "Loading…" : state.consent ?? "Unknown"}
          </strong>
        </div>

        {state.error && <p className="error">{state.error}</p>}

        <div className="actions">
          <button
            type="button"
            onClick={() => void updateConsent("grant")}
            disabled={state.isLoading || state.isMutating}
          >
            {state.isMutating ? "Saving…" : "Grant consent"}
          </button>

          <button
            type="button"
            onClick={() => void updateConsent("revoke")}
            disabled={state.isLoading || state.isMutating}
            className="secondary"
          >
            {state.isMutating ? "Saving…" : "Revoke consent"}
          </button>

          <button
            type="button"
            onClick={() => void loadConsent()}
            disabled={state.isLoading || state.isMutating}
            className="secondary"
          >
            Refresh status
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
