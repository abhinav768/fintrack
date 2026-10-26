import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950 px-6 text-center">
        <h1 className="display text-5xl">
          Something <em className="text-muted">slipped.</em>
        </h1>
        <p className="max-w-sm text-sm text-muted">
          Your data is safe. Reload the page to continue.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Reload
        </button>
      </div>
    );
  }
}
