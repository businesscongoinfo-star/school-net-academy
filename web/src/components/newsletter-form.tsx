import { useState } from 'react';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { ApiError, post } from '../lib/api';
import { Button, Input } from './ui';
import { DEFAULT_COUNTRY } from '../lib/countries';

export function NewsletterForm({ source = 'accueil', compact = false }: { source?: string; compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Adresse e-mail invalide.');
      return;
    }
    setState('pending');
    try {
      const data = await post<{ message: string }>('/newsletter/subscribe', {
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        countryCode: DEFAULT_COUNTRY,
        source,
      });
      setMessage(data.message);
      setState('done');
    } catch (err) {
      setState('idle');
      setError(err instanceof ApiError ? err.message : 'Inscription impossible. Réessayez.');
    }
  }

  if (state === 'done') {
    return (
      <div className="newsletter-done">
        <CheckCircle2 size={17} />
        <div>
          <strong>Inscription confirmée</strong>
          <p className="small">{message ?? 'Merci ! Vous recevrez nos nouveautés une fois par mois.'}</p>
        </div>
      </div>
    );
  }

  return (
    <form className={`newsletter-form${compact ? ' compact' : ''}`} onSubmit={submit}>
      {!compact && (
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Votre nom (facultatif)"
          aria-label="Votre nom"
        />
      )}
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="vous@mon-ecole.cg"
        aria-label="Votre adresse e-mail"
        required
      />
      <Button type="submit" variant="primary" icon={state === 'pending' ? undefined : Send} loading={state === 'pending'}>
        {compact ? "S'inscrire" : "Recevoir la newsletter"}
      </Button>
      {error && <p className="error-text">{error}</p>}
      <p className="tiny muted newsletter-note">
        <Mail size={12} /> 1 e-mail par mois · désinscription en un clic · aucune revente de données.
      </p>
    </form>
  );
}
