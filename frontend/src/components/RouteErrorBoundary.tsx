import { Component, type ReactNode } from "react";

type RouteErrorBoundaryState = {
  error: Error | null;
};

export default class RouteErrorBoundary extends Component<
  { children: ReactNode },
  RouteErrorBoundaryState
> {
  declare props: { children: ReactNode };
  declare setState: (state: Partial<RouteErrorBoundaryState>) => void;

  state: RouteErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen pt-32 pb-20 px-4 md:px-margin-desktop flex items-center justify-center relative z-10">
          <div className="bg-[#141A28] border border-white/5 rounded-3xl p-8 max-w-lg text-center">
            <h2 className="text-2xl font-semibold text-white mb-3">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-6">
              {this.state.error.message || "The page could not be rendered."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="bg-[#2563EB] hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
