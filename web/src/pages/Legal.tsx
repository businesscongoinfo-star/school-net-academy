import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MailX } from 'lucide-react';
import { ApiError, post } from '../lib/api';
import { Logo } from '../components/logo';
import { Button, Field, Input } from '../components/ui';

/** Page publique de désabonnement (lien présent dans chaque campagne). */
export function Unsubscribe() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await post('/newsletter/unsubscribe', { email: email.trim() });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Désabonnement impossible.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-art">
        <Link to="/" className="row gap-10"><Logo /></Link>
        <h1>Vous restez maître de votre boîte mail.</h1>
        <p className="lead">
          Un seul clic suffit : votre adresse est retirée de nos campagnes immédiatement et
          définitivement. Aucune relance, aucune revente de données.
        </p>
      </aside>
      <main className="auth-form-side">
        <div className="auth-form">
          <Link to="/" className="row gap-6 small muted" style={{ marginBottom: 18 }}>
            <ArrowLeft size={14} /> Retour au site
          </Link>
          <h2>Se désabonner de la lettre</h2>
          <p className="sub">Plus de newsletters, plus d'annonces produit : votre choix est immédiat.</p>

          {done ? (
            <div className="callout success" style={{ marginTop: 22 }}>
              <CheckCircle2 size={17} />
              <div>
                <strong>Désabonnement confirmé</strong>
                <p className="small">{email} a été retiré de la liste.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="stack gap-16" style={{ marginTop: 22 }}>
              <Field label="Adresse e-mail concernée">
                <div className="input-with-icon">
                  <MailX size={16} />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="vous@exemple.com"
                  />
                </div>
              </Field>
              {error && <p className="error-text">{error}</p>}
              <Button type="submit" variant="primary" block loading={pending}>
                Confirmer le désabonnement
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px 80px' }}>
      <Link to="/" className="row gap-8" style={{ marginBottom: 28 }}><Logo /></Link>
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>{title}</h1>
      <p className="small muted" style={{ marginBottom: 28 }}>Dernière mise à jour : {updated}</p>
      <div className="card card-pad stack gap-18" style={{ lineHeight: 1.75, fontSize: 14.5 }}>
        {children}
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>
        Une question ? Écrivez à <a href="mailto:businesscongo.inf@gmail.com">businesscongo.inf@gmail.com</a>.
      </p>
    </div>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Conditions d'utilisation" updated="2 novembre 2026">
      <p>
        School Net Academy est une plateforme de gestion scolaire et universitaire éditée à Brazzaville
        (République du Congo). En créant un compte, vous acceptez les présentes conditions.
      </p>
      <h3>1. Compte et accès</h3>
      <p>
        Chaque établissement dispose d'un espace propre. Le responsable du compte est chargé de créer les
        accès de son personnel et de ses enseignants, et de veiller à la confidentialité des mots de passe.
      </p>
      <h3>2. Essai gratuit et abonnement</h3>
      <p>
        Tout nouvel établissement bénéficie de 7 jours d'essai gratuit, sans engagement. À l'issue de
        l'essai, l'accès aux modules est suspendu jusqu'au règlement d'un abonnement (mobile money, carte
        bancaire, virement ou espèces). Les données restent conservées pendant la suspension.
      </p>
      <h3>3. Utilisation acceptable</h3>
      <p>
        Vous vous engagez à ne saisir que des données dont vous êtes responsable (élèves, familles,
        notes, paiements) et à respecter la réglementation applicable en matière de protection des
        données personnelles, notamment le consentement des tuteurs pour les mineurs.
      </p>
      <h3>4. Disponibilité</h3>
      <p>
        Nous visons une disponibilité continue. Des interruptions planifiées peuvent survenir pour
        maintenance ; elles sont annoncées dans l'application lorsque c'est possible.
      </p>
      <h3>5. Résiliation</h3>
      <p>
        Vous pouvez cesser d'utiliser le service à tout moment. Sur demande écrite, les données de votre
        établissement sont exportées puis supprimées dans un délai de 30 jours.
      </p>
      <h3>6. Contact</h3>
      <p>Support : <a href="mailto:businesscongo.inf@gmail.com">businesscongo.inf@gmail.com</a> — du lundi au samedi.</p>
    </LegalLayout>
  );
}

export function Privacy() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="2 novembre 2026">
      <p>
        Cette politique explique quelles données sont traitées par School Net Academy, pourquoi et comment
        elles sont protégées.
      </p>
      <h3>1. Données traitées</h3>
      <p>
        Données de compte (nom, adresse e-mail, téléphone, rôle), données scolaires (élèves, classes, notes,
        présences, paiements) et données de contact des tuteurs. Les mots de passe sont stockés sous forme
        d'empreinte scrypt ; ils ne sont jamais lisibles par nos équipes.
      </p>
      <h3>2. Finalités</h3>
      <p>
        Fournir le service de gestion scolaire, éditer les reçus et bulletins, prévenir les tuteurs en cas
        d'inscription ou de paiement, assurer le support et — uniquement si vous y avez consenti — vous
        envoyer notre lettre d'information.
      </p>
      <h3>3. Hébergement et sous-traitants</h3>
      <p>
        L'application est hébergée par Vercel (États-Unis / Union européenne) et les données persistantes
        ainsi que les e-mails transactionnels sont gérés par Supabase (région Europe de l'Ouest). Aucune
        donnée n'est revendue.
      </p>
      <h3>4. Durée de conservation</h3>
      <p>
        Les données sont conservées pendant la durée de l'abonnement, puis 30 jours après la résiliation
        afin de permettre l'export, avant suppression définitive.
      </p>
      <h3>5. Vos droits</h3>
      <p>
        Vous pouvez demander l'accès, la rectification, l'export ou la suppression des données de votre
        établissement en écrivant à <a href="mailto:businesscongo.inf@gmail.com">businesscongo.inf@gmail.com</a>.
        Chaque e-mail de newsletter contient un lien de désabonnement immédiat.
      </p>
      <h3>6. Sécurité</h3>
      <p>
        Sessions signées (HMAC), mots de passe hachés, accès aux modules contrôlés par rôle, journal des
        connexions et sauvegardes chiffrées en transit (TLS).
      </p>
    </LegalLayout>
  );
}
