import { Component, type ReactNode } from 'react';

type State = { failed: boolean };

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-shell">
        <main className="crash-screen" role="alert">
          <h1>Something went wrong.</h1>
          <p>CSV Lens hit an unexpected error. Your data stayed in this browser and was not sent anywhere. Reloading starts a fresh workspace.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Reload CSV Lens</button>
        </main>
      </div>
    );
  }
}
