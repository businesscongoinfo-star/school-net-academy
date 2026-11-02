import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Globe2, GraduationCap, Mail, Search,
  School, ShieldCheck, Sparkles, Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiError, get, post } from '../lib/api';
import { Logo } from '../components/logo';
import { Button, Field, Input } from '../components/ui';
import { useToast } from '../components/toast';
import { COUNTRIES, countryByCode, convertFromFcfa, formatCurrency } from '../lib/countries';
import type { CatalogResponse, Plan, User } from '../lib/types';

const STEPS = ['Établissement', 'Pays & devise', 'Offre', 'Votre compte'];

export function Signup() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  const [step, setStep] = useState(0);
  const [schoolName, setSchoolName] = useState('');
  const [kind, setKind] = useState<'ecole' | 'universite' | 'mixte'>('ecole');
  const [countryCode, setCountryCode] = useState('CG');
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('pro');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newsletter, setNewsletter] = useState(true);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const country = countryByCode(countryCode);

  useEffect(() => {
    if (user && !pending) navigate('/app', { replace: true });
  }, [user, pending, navigate]);

  useEffect(() => {
    get<CatalogResponse>(`/platform/catalog?currency=${encodeURIComponent(country.currency)}`)
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, [country.currency]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term));
  }, [search]);

  const plans: Plan[] = catalog?.plans ?? [];
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;

  const canNext = step === 0
    ? schoolName.trim().length >= 3
    : step === 2
      ? Boolean(selectedPlan)
      : true;

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      setStep(3);
      return;
    }
    setPending(true);
    try {
      const data = await post<{ user: User }>('/platform/signup', {
        schoolName: schoolName.trim(),
        kind,
        country: country.name,
        countryCode: country.code,
        currency: country.currency,
        adminName: adminName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || null,
        plan: planId,
        newsletter,
      });
      setUser(data.user);
      success(`Bienvenue ${adminName.split(' ')[0]} ! Votre essai gratuit de 7 jours démarre maintenant.`);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible. Réessayez dans un instant.');
    } finally {
      setPending(false);
    }
  }

  const priceLabel = (plan: Plan) => formatCurrency(
    plan.localPrice ?? convertFromFcfa(plan.priceFcfa, country.currency, catalog?.rates),
    plan.localCurrency ?? country.currency,
  );

  return (
    <div className="signup">
      <aside className="signup-art">
        <Link to="/" className="row gap-10" style={{ marginBottom: 28 }}>
          <Logo />
        </Link>
        <h1>Ouvrez l'espace numérique de votre établissement en 3 minutes.</h1>
        <p className="lead">
          Écoles, collèges et universités : scolarité, paiements, présences, cartes à QR code,
          SMS aux parents et assistant IA. Essai gratuit de 7 jours, sans engagement.
        </p>
        <ul className="signup-points">
          <li><CheckCircle2 size={16} /> 7 jours d'essai gratuit, puis abonnement au mois</li>
          <li><CheckCircle2 size={16} /> Devise et prix adaptés à votre pays</li>
          <li><CheckCircle2 size={16} /> Paiement Mobile Money, carte bancaire ou virement</li>
          <li><CheckCircle2 size={16} /> Données de démonstration prêtes à explorer</li>
        </ul>
        <div className="signup-badge">
          <div className="row gap-8"><Sparkles size={15} /> Déjà <strong>240+ établissements</strong> accompagnés</div>
          <span>Brazzaville · Kinshasa · Abidjan · Dakar · Libreville</span>
        </div>
        <div className="signup-orbs" aria-hidden>
          <span /><span /><span />
        </div>
      </aside>

      <main className="signup-main">
        <div className="signup-card">
          <div className="row gap-8" style={{ marginBottom: 6 }}>
            <span className="pill-soft"><Globe2 size={13} /> {country.name}</span>
            <span className="pill-soft"><Wallet size={13} /> {country.currency}</span>
          </div>
          <h2>Créer mon établissement</h2>
          <p className="sub">Étape {step + 1} sur {STEPS.length} — {STEPS[step]}</p>

          <div className="stepper">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                className={index === step ? 'active' : index < step ? 'done' : ''}
                onClick={() => index <= step && setStep(index)}
              >
                <span className="num">{index < step ? <Check size={12} /> : index + 1}</span>
                <span className="hide-sm">{label}</span>
              </button>
            ))}
          </div>

          {step === 0 && (
            <div className="stack gap-16">
              <Field label="Nom de l'établissement" hint="Tel qu'il apparaîtra sur les bulletins et reçus.">
                <Input
                  autoFocus
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  placeholder="Ex. Complexe scolaire La Grâce"
                />
              </Field>
              <div className="field">
                <span className="label">Type d'établissement</span>
                <div className="kind-grid">
                  {[
                    { id: 'ecole', label: 'École / collège / lycée', icon: School },
                    { id: 'universite', label: 'Université / institut', icon: GraduationCap },
                    { id: 'mixte', label: 'Les deux (groupe scolaire)', icon: Globe2 },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`kind-card${kind === option.id ? ' active' : ''}`}
                      onClick={() => setKind(option.id as typeof kind)}
                    >
                      <option.icon size={18} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="stack gap-14">
              <div className="field">
                <span className="label">Pays de l'établissement</span>
                <div className="search" style={{ minWidth: 0 }}>
                  <Search size={15} />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher un pays…"
                  />
                </div>
                <div className="country-list" role="listbox" aria-label="Pays">
                  {filtered.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      role="option"
                      aria-selected={item.code === countryCode}
                      className={`country-option${item.code === countryCode ? ' active' : ''}`}
                      onClick={() => setCountryCode(item.code)}
                    >
                      <span className="flag">{item.code}</span>
                      <span className="grow truncate">{item.name}</span>
                      <span className="tiny muted">{item.currency}</span>
                    </button>
                  ))}
                  {!filtered.length && <p className="small muted" style={{ padding: 12 }}>Aucun pays ne correspond.</p>}
                </div>
              </div>
              <div className="currency-note">
                <div>
                  <strong>Devise détectée : {country.currency}</strong>
                  <p className="small muted">
                    Les prix des abonnements et les montants de l'application s'afficheront en {country.currency}.
                    Indécis du pays ? Aucun souci, vous pourrez le modifier ensuite.
                  </p>
                </div>
                <span className="currency-chip">{country.currency}</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stack gap-12">
              {plans.map((plan) => {
                const active = plan.id === planId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={`plan-card${active ? ' active' : ''}${plan.popular ? ' popular' : ''}`}
                    onClick={() => setPlanId(plan.id)}
                  >
                    <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
                      <div className="grow">
                        <div className="row gap-8">
                          <strong>{plan.name}</strong>
                          {plan.popular && <span className="badge badge-primary">Populaire</span>}
                        </div>
                        <p className="small muted">{plan.tagline}</p>
                      </div>
                      <div className="right">
                        <div className="plan-price">{priceLabel(plan)}</div>
                        <div className="tiny muted">/ {plan.period}</div>
                      </div>
                    </div>
                    <p className="tiny muted" style={{ marginTop: 6 }}>
                      {plan.priceFcfa.toLocaleString('fr-FR')} FCFA · {plan.seats >= 999 ? 'utilisateurs illimités' : `${plan.seats} comptes`}
                    </p>
                  </button>
                );
              })}
              <p className="tiny muted">
                Aucun prélèvement aujourd'hui : l'essai de 7 jours est offert. Vous choisirez le moyen de
                paiement (Mobile Money, carte, virement) à la fin de l'essai.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="stack gap-14">
              <Field label="Votre nom complet">
                <Input autoFocus value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Ex. Chancelle Mabiala" />
              </Field>
              <Field label="Adresse e-mail" hint="Elle servira d'identifiant de connexion.">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="direction@mon-ecole.cg" />
              </Field>
              <div className="form-grid">
                <Field label="Téléphone (Mobile Money)">
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={`${country.dial} 06 000 00 00`} />
                </Field>
                <Field label="Mot de passe" hint="8 caractères minimum.">
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
                </Field>
              </div>
              <label className="checkbox">
                <input type="checkbox" checked={newsletter} onChange={(event) => setNewsletter(event.target.checked)} />
                <span>Recevoir la newsletter (nouveautés, guides, offres) — 1 e-mail par mois.</span>
              </label>
              <label className="checkbox">
                <input type="checkbox" defaultChecked />
                <span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span>
              </label>
            </div>
          )}

          {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

          <div className="row gap-10" style={{ marginTop: 22 }}>
            {step > 0 && (
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((value) => value - 1)}>
                Retour
              </Button>
            )}
            <div className="grow" />
            {step < 3 ? (
              <Button variant="primary" icon={ArrowRight} disabled={!canNext} onClick={() => setStep((value) => value + 1)}>
                Continuer
              </Button>
            ) : (
              <Button variant="primary" icon={ShieldCheck} loading={pending} onClick={submit}>
                Démarrer mon essai gratuit
              </Button>
            )}
          </div>

          <div className="auth-divider">déjà inscrit ?</div>
          <Link className="btn btn-secondary btn-block" to="/connexion">
            <Mail size={15} /> Se connecter à mon espace
          </Link>
        </div>
      </main>
    </div>
  );
}

export default Signup;
