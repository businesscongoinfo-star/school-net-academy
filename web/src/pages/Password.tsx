import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { ApiError, post } from '../lib/api';
import { Logo } from '../components/logo';
import { Button, Field, Input } from '../components/ui';

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Link to="/" className="row gap-10">
          <Logo />
        </Link>
        <h1>Un accès simple, sécurisé et sans paperasse.</h1>
        <p className="lead">
          School Net Academy protège les données de votre établissement. En cas d'oubli, un lien
          de réinitialisation valable 30 minutes vous est envoyé.
        </p>
        <ul className="signup-points">
          <li><CheckCircle2 size={16} /> Mot de passe chiffré (scrypt)</li>
          <li><CheckCircle2 size={16} /> Sessions signées, déconnexion immédiate</li>
          <li><CheckCircle2 size={16} /> Support joignable 7j/7 par e-mail</li>
        </ul>
      </aside>
      <main className="auth-form-side">
        <div className="auth-form">
          <Link to="/connexion" className="row gap-6 small muted" style={{ marginBottom: 18 }}>
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>
          <h2>{title}</h2>
          <p className="sub">{subtitle}</p>
          <div style={{ marginTop: 22 }}>{children}</div>
        </div>
      </main>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ message: string; resetPath?: string; delivered?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await post<{ message: string; resetPath?: string; delivered?: boolean }>('/auth/forgot', { email: email.trim() });
      setSent(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Demande impossible. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Mot de passe oublié" subtitle="Indiquez l'adresse e-mail de votre compte : nous vous envoyons un lien de réinitialisation.">
      {sent ? (
        <div className="stack gap-14">
          <div className="callout success">
            <CheckCircle2 size={17} />
            <div>
              <strong>{sent.message}</strong>
              <p className="small">
                {sent.delivered
                  ? 'Vérifiez votre boîte de réception (et les indésirables) : le lien expire dans 30 minutes.'
                  : "Aucun service d'e-mail n'est actif pour le moment. Écrivez-nous à businesscongo.inf@gmail.com : nous rétablissons votre accès sous 24 h."}
              </p>
            </div>
          </div>
          {sent.resetPath && (
            <Link className="btn btn-primary btn-block" to={sent.resetPath}>
              <KeyRound size={15} /> Ouvrir le lien de réinitialisation
            </Link>
          )}
          <Link className="btn btn-secondary btn-block" to="/connexion">Retour à la connexion</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="stack gap-16">
          <div className="input-with-icon">
            <Mail size={16} />
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="direction@mon-ecole.cg"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <Button type="submit" variant="primary" block icon={Mail} loading={pending}>
            Envoyer le lien de réinitialisation
          </Button>
          <p className="tiny muted center">
            Un problème persistant ? Écrivez à <a href="mailto:businesscongo.inf@gmail.com">businesscongo.inf@gmail.com</a>.
          </p>
        </form>
      )}
    </AuthFrame>
  );
}

/** Supabase renvoie les jetons dans le fragment (#access_token=…) après le clic. */
function readSupabaseTokens() {
  if (typeof window === 'undefined') return { accessToken: '', type: '', error: '' };
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hash = new URLSearchParams(raw);
  const query = new URLSearchParams(window.location.search);
  return {
    accessToken: hash.get('access_token') ?? '',
    type: hash.get('type') ?? '',
    error: hash.get('error_description') ?? query.get('error_description') ?? '',
  };
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [supabase] = useState(readSupabaseTokens);
  const accessToken = supabase.accessToken;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setPending(true);
    try {
      if (accessToken) await post('/auth/reset-supabase', { accessToken, password });
      else await post('/auth/reset', { token, password });
      setDone(true);
      window.setTimeout(() => navigate('/connexion', { replace: true }), 1600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réinitialisation impossible.');
    } finally {
      setPending(false);
    }
  }

  if (supabase.error) {
    return (
      <AuthFrame title="Lien expiré" subtitle={supabase.error}>
        <Link className="btn btn-primary btn-block" to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
      </AuthFrame>
    );
  }

  if (!token && !accessToken) {
    return (
      <AuthFrame title="Lien invalide" subtitle="Ce lien de réinitialisation est incomplet ou a déjà été utilisé.">
        <Link className="btn btn-primary btn-block" to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 8 caractères, différent des précédents.">
      {done ? (
        <div className="callout success">
          <CheckCircle2 size={17} />
          <div>
            <strong>Mot de passe mis à jour</strong>
            <p className="small">Redirection vers la page de connexion…</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="stack gap-16">
          <Field label="Nouveau mot de passe">
            <Input type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Confirmer le mot de passe">
            <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="error-text">{error}</p>}
          <Button type="submit" variant="primary" block icon={ShieldCheck} loading={pending}>
            Enregistrer le mot de passe
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
