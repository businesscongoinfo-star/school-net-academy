import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Filet de sécurité global : une erreur de rendu affiche un écran de reprise
 * au lieu d'une page blanche.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur de rendu :', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-screen">
        <div className="error-card">
          <div className="error-icon"><AlertTriangle size={22} /></div>
          <h1>Un imprévu est survenu</h1>
          <p>
            Cette page n'a pas pu s'afficher correctement. Vos données sont intactes :
            rechargez la page ou revenez au tableau de bord.
          </p>
          <pre className="error-detail">{error.message}</pre>
          <div className="row gap-10">
            <button className="btn btn-secondary" onClick={() => { window.location.href = '/app'; }}>
              <Home size={16} /> Tableau de bord
            </button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Recharger
            </button>
          </div>
        </div>
      </div>
    );
  }
}
