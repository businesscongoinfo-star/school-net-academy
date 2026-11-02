import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Crown, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiError, post } from '../lib/api';
import { useToast } from '../components/toast';
import { Logo } from '../components/logo';
import { Button, Field, Input } from '../components/ui';
import { Avatar } from '../components/ui';

const DEMO_ENV = ((import.meta as unknown as { env?: Record<string, string | boolean> }).env ?? {});
/** Les comptes de démonstration de la plateforme restent réservés à la démo statique. */
const SHOW_PLATFORM_DEMO = Boolean(DEMO_ENV.DEV) || DEMO_ENV.VITE_DEMO === '1';

const DEMO_ACCOUNTS = [
  { email: 'direction@schoolnet.academy', name: 'Chancelle Mabiala', role: 'Direction', color: '#0f766e' },
  { email: 'prof.mbemba@schoolnet.academy', name: 'Prosper Mbemba', role: 'Enseignant', color: '#b45309' },
  { email: 'parent.ondongo@schoolnet.academy', name: 'Nadège Ondongo', role: 'Parent', color: '#7c3aed' },
  { email: 'superadmin@schoolnet.academy', name: 'Ariane Okemba', role: 'Super admin', color: '#0e7490' },
  { email: 'essai@schoolnet.academy', name: 'Patrick Loemba', role: 'Essai expiré', color: '#b45309' },
].filter((account) => SHOW_PLATFORM_DEMO || account.role !== 'Super admin');

const DEMO_PASSWORD = 'demo1234';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { info } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  async function social(provider: 'google' | 'facebook') {
    setError(null);
    try {
      const data = await post<{ error?: string; hint?: string; url?: string }>(`/auth/oauth/${provider}`, {});
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      info(data.error ?? 'Connexion sociale indisponible.', data.hint);
    } catch (err) {
      const detail = (err as ApiError & { details?: { hint?: string } }).details;
      info(
        err instanceof ApiError ? err.message : 'Connexion sociale indisponible.',
        detail?.hint ?? "Configurez GOOGLE_CLIENT_ID / FACEBOOK_APP_ID sur le serveur pour activer la connexion sociale.",
      );
    }
  }

  async function submit(nextEmail: string, nextPassword: string, key: string) {
    setError(null);
    setPending(key);
    try {
      await login(nextEmail, nextPassword);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="auth">
      <div className="auth-art">
        <Link to="/" className="row gap-10" style={{ position: 'relative', zIndex: 1 }}>
          <Logo />
        </Link>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 64 }}>
          <span className="lp-eyebrow" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.18)', color: '#cfeae4' }}>
            <Sparkles size={13} /> Espace école
          </span>
          <h1 style={{ marginTop: 22 }}>La scolarité de vos élèves, sans aucune friction.</h1>
          <p className="lead">
            Inscriptions, paiements, notes et cours en ligne : tout est centralisé, à jour et
            accessible selon votre rôle.
          </p>
        </div>
        <div className="auth-quote">
          <p>
            « Nous avons abandonné les cahiers de suivi. Les relances d'impayés et les bulletins se
            font désormais en quelques minutes, et les parents voient les mêmes informations que nous. »
          </p>
          <div className="who">
            <Avatar name="Chancelle Mabiala" color="#2dd4bf" size="sm" />
            <div>
              <strong>Chancelle Mabiala</strong>
              <span>Directrice générale, School Net Academy</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form">
          <Link to="/" className="row gap-6 small muted" style={{ marginBottom: 22 }}>
            <ArrowLeft size={14} /> Retour au site
          </Link>
          <h2>Connexion à votre espace</h2>
          <p className="sub">Adresse e-mail ou compte social — un seul espace pour tout gérer.</p>

          <div className="social-row">
            <button type="button" className="social-btn" onClick={() => social('google')}>
              <span className="social-icon google">G</span> Google
            </button>
            <button type="button" className="social-btn" onClick={() => social('facebook')}>
              <span className="social-icon facebook">f</span> Facebook
            </button>
          </div>
          <div className="auth-divider">ou avec votre e-mail</div>

          <form
            className="stack gap-16 mt-16"
            onSubmit={(event) => {
              event.preventDefault();
              submit(email, password, 'form');
            }}
          >
            {error && (
              <div style={{ background: 'var(--danger-soft)', color: '#a52f23', padding: '10px 12px', borderRadius: 10, fontSize: 12.5, border: '1px solid #f6d5d1' }}>
                {error}
              </div>
            )}
            <Field label="Adresse e-mail" htmlFor="email">
              <div className="input-with-icon">
                <Mail size={15} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="prenom.nom@schoolnet.academy"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </Field>
            <Field label="Mot de passe" htmlFor="password">
              <div className="input-with-icon">
                <Lock size={15} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-400)', padding: 4, display: 'grid', placeItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
              <label className="checkbox"><input type="checkbox" defaultChecked /> <span>Rester connecté</span></label>
              <Link to="/mot-de-passe-oublie" className="link-btn">Mot de passe oublié ?</Link>
            </div>
            <Button type="submit" variant="primary" size="lg" block loading={pending === 'form'}>
              Se connecter <ArrowRight size={16} />
            </Button>
          </form>

          <div className="demo-box">
            <div className="row gap-6">
              <ShieldCheck size={13} style={{ color: 'var(--primary)' }} />
              <span className="title">Connexion démo — un clic</span>
            </div>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                className="demo-account"
                disabled={pending !== null}
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  submit(account.email, DEMO_PASSWORD, account.role);
                }}
              >
                <Avatar name={account.name} color={account.color} size="sm" />
                <span className="grow">
                  <span className="name" style={{ display: 'block' }}>{account.name} · {account.role}</span>
                  <span className="mail">{account.email}</span>
                </span>
                {pending === account.role ? <span className="spinner" style={{ color: 'var(--primary)' }} /> : <ArrowRight size={14} style={{ color: 'var(--ink-300)' }} />}
              </button>
            ))}
            <div className="tiny muted mt-8" style={{ paddingLeft: 8 }}>
              Mot de passe commun : <strong>{DEMO_PASSWORD}</strong>
            </div>
          </div>

          <p className="tiny muted" style={{ marginTop: 22, lineHeight: 1.6 }}>
            En vous connectant, vous acceptez les conditions d'utilisation et la politique de
            confidentialité de School Net Academy.
          </p>
        </div>
      </div>
    </div>
  );
}
