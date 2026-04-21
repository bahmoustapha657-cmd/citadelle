import React from "react";
import { captureClientError } from "../sentry";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    captureClientError(erreur, {
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.setState({ erreur: null });
    }
  };

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A1628",
          fontFamily: "'Segoe UI',system-ui,sans-serif",
          padding: "24px 16px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "28px 32px",
            maxWidth: 460,
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#0A1628" }}>
            Une erreur est survenue
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#475569" }}>
            L'application a rencontré un problème. Rechargez la page pour
            réessayer — vos données sont préservées.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: "linear-gradient(90deg,#1e40af,#16a34a)",
              color: "#fff",
              border: "none",
              padding: "12px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
