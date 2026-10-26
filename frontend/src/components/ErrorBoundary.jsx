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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <h1 className="text-xl font-bold text-slate-800">Something went wrong</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Your data is safe. Reload the page to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Reload
        </button>
      </div>
    );
  }
}
