"use client";

import { Component, type ReactNode } from "react";

export default class GameErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[GameBoard error]", error, info);
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-lg border border-rose-700 bg-rose-950/40 p-6 max-w-lg">
            <h2 className="font-display text-xl font-semibold text-rose-200">
              Something went sideways
            </h2>
            <p className="mt-2 text-sm text-rose-100">
              {this.state.error.message}
            </p>
            <p className="mt-4 text-xs text-rose-300">
              Refresh the page to start again.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
