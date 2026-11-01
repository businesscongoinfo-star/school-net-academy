import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Logo } from '../components/logo';

export function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--canvas)' }}>
      <div className="stack gap-16" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 420 }}>
        <div className="row gap-10" style={{ marginBottom: 8 }}>
          <Logo />
        </div>
        <span className="empty-icon" style={{ width: 60, height: 60, borderRadius: 18 }}>
          <Compass size={26} />
        </span>
        <h1 style={{ fontSize: 40, letterSpacing: '-0.04em' }}>404</h1>
        <p className="muted">Cette page n'existe pas ou a été déplacée.</p>
        <Link to="/app" className="btn btn-primary mt-16">
          <ArrowLeft size={15} /> Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
