import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Banknote, CheckCircle2, CreditCard, Landmark, LockKeyhole, Receipt,
  ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { ApiError, get, post } from '../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, SkeletonLine, TableSkeleton } from '../components/ui';
import { useToast } from '../components/toast';
import { formatCurrency } from '../lib/countries';
import { formatDate, formatNumber } from '../lib/format';
import type { BillingResponse, Plan } from '../lib/types';

const METHODS = [
  { id: 'mobile_money', label: 'Mobile Money', hint: 'MTN, Airtel, Orange, Moov, Wave', icon: Smartphone },
  { id: 'carte', label: 'Carte bancaire', hint: 'Visa, Mastercard — 3D Secure', icon: CreditCard },
  { id: 'virement', label: 'Virement bancaire', hint: 'Coordonnées envoyées par e-mail', icon: Landmark },
  { id: 'especes', label: 'Espèces / agence', hint: 'Paiement au guichet partenaire', icon: Banknote },
] as const;

const STATUS_LABEL: Record<string, string> = {
  essai: 'Essai gratuit',
  actif: 'Actif',
  essai_expire: 'Essai terminé',
  expire: 'Abonnement expiré',
  suspendu: 'Suspendu',
};

export function Billing() {
  const { user, refresh } = useAuth();
  const { success: toastSuccess } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => get<BillingResponse>('/platform/billing'),
  });

  const [planId, setPlanId] = useState('pro');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('mobile_money');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [card, setCard] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const access = data?.access ?? user?.access ?? null;
  const blocked = Boolean(access?.blocked);
  const currency = data?.currency ?? data?.tenant?.currency ?? 'XAF';

  useEffect(() => {
    if (!data) return;
    const preferred = data.plans.find((plan) => plan.popular) ?? data.plans[0];
    setPlanId((current) => (preferred && !data.plans.some((plan) => plan.id === current) ? preferred.id : current));
  }, [data]);

  const selected = useMemo<Plan | null>(
    () => data?.plans.find((plan) => plan.id === planId) ?? null,
    [data, planId],
  );

  const priceOf = (plan: Plan) => formatCurrency(
    plan.localPrice ?? plan.priceFcfa,
    plan.localCurrency ?? currency,
  );

  async function pay() {
    setError(null);
    if (method === 'mobile_money' && phone.trim().length < 6) {
      setError('Indiquez le numéro Mobile Money à débiter.');
      return;
    }
    if (method === 'carte' && card.replace(/\s/g, '').length < 12) {
      setError('Numéro de carte incomplet (démonstration : toute suite de 12 à 19 chiffres).');
      return;
    }
    setPending(true);
    try {
      const result = await post<{ subscription: { reference: string; amount: number; currency: string } }>(
        '/platform/billing/pay',
        { plan: planId, method, phone: phone.trim() || null },
      );
      setDone(result.subscription.reference);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toastSuccess(`Paiement confirmé — référence ${result.subscription.reference}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Paiement impossible pour le moment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack gap-20">
      <PageHeader
        title="Abonnement & facturation"
        subtitle="Gérez votre offre, réglez par Mobile Money ou carte et retrouvez vos reçus."
        actions={
          access && (
            <Badge tone={blocked ? 'danger' : access.status === 'essai' ? 'warning' : 'success'} dot>
              {STATUS_LABEL[access.status] ?? access.status}
              {access.status === 'essai' && access.daysLeft !== null ? ` · ${access.daysLeft} j restants` : ''}
            </Badge>
          )
        }
      />

      {blocked && (
        <div className="paywall">
          <div className="paywall-icon"><LockKeyhole size={20} /></div>
          <div className="grow">
            <strong>Votre accès est suspendu</strong>
            <p className="small">
              {access?.status === 'essai_expire'
                ? "Votre essai gratuit de 7 jours est terminé. Choisissez une offre ci-dessous pour retrouver immédiatement l'accès à toutes les données de votre établissement."
                : "Votre abonnement n'est plus actif. Régularisez votre situation pour rouvrir l'espace de votre établissement."}
            </p>
          </div>
        </div>
      )}

      {done && (
        <div className="callout success">
          <CheckCircle2 size={17} />
          <div>
            <strong>Paiement enregistré — {done}</strong>
            <p className="small">Votre établissement est actif pour 30 jours (12 mois pour l'offre Université). Une notification et un reçu sont disponibles ci-dessous.</p>
          </div>
        </div>
      )}

      <div className="grid grid-3">
        {isLoading && [0, 1, 2].map((key) => (
          <Card key={key} className="card-pad"><SkeletonLine width="60%" /><SkeletonLine width="40%" /></Card>
        ))}
        {(data?.plans ?? []).map((plan) => {
          const active = plan.id === planId;
          return (
            <button
              key={plan.id}
              type="button"
              className={`plan-tile${active ? ' active' : ''}`}
              onClick={() => setPlanId(plan.id)}
              aria-pressed={active}
            >
              {plan.popular && <span className="plan-flag">Le plus choisi</span>}
              <div className="row gap-8">
                <strong className="plan-name">{plan.name}</strong>
                {plan.id === data?.tenant?.plan && <Badge tone="success">Offre actuelle</Badge>}
              </div>
              <p className="small muted" style={{ minHeight: 34 }}>{plan.tagline}</p>
              <div className="plan-amount">{priceOf(plan)}</div>
              <p className="tiny muted">
                par {plan.period} · {plan.priceFcfa.toLocaleString('fr-FR')} FCFA
                {plan.id === 'universite' ? ' · engagement 12 mois' : ''}
              </p>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}><CheckCircle2 size={13} /> {feature}</li>
                ))}
              </ul>
              <span className={`plan-select${active ? ' active' : ''}`}>{active ? 'Offre sélectionnée' : 'Choisir cette offre'}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card className="card-pad">
          <h3 className="card-title">Moyen de paiement</h3>
          <p className="card-sub">Paiement sécurisé — aucune donnée bancaire n'est stockée.</p>
          <div className="method-grid">
            {METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`method-card${method === option.id ? ' active' : ''}`}
                onClick={() => setMethod(option.id)}
              >
                <option.icon size={17} />
                <div>
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </div>
              </button>
            ))}
          </div>

          {method === 'mobile_money' && (
            <Field label="Numéro Mobile Money" hint="Le montant sera prélevé dans votre devise locale.">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+242 06 000 00 00" />
            </Field>
          )}
          {method === 'carte' && (
            <Field label="Numéro de carte" hint="Démonstration : aucun débit réel n'est effectué.">
              <Input inputMode="numeric" value={card} onChange={(event) => setCard(event.target.value)} placeholder="4242 4242 4242 4242" />
            </Field>
          )}
          {method === 'virement' && (
            <div className="callout">
              <Landmark size={16} />
              <div>
                <strong>Coordonnées bancaires</strong>
                <p className="small">Banque : UBA Congo · IBAN : CG39 3000 1000 2000 3000 4000 555<br />Référence à rappeler : {data?.tenant?.name ?? 'votre établissement'}. Le compte est activé dès réception.</p>
              </div>
            </div>
          )}
          {method === 'especes' && (
            <div className="callout">
              <Banknote size={16} />
              <div>
                <strong>Paiement au guichet</strong>
                <p className="small">Présentez la référence de votre établissement dans l'agence partenaire ; l'accès est ouvert dès validation par le financier.</p>
              </div>
            </div>
          )}

          {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}

          <div className="row gap-10" style={{ marginTop: 16, alignItems: 'center' }}>
            <Button variant="primary" icon={ShieldCheck} loading={pending} onClick={pay} disabled={!selected}>
              Payer {selected ? priceOf(selected) : ''}
            </Button>
            <span className="tiny muted"><LockKeyhole size={12} /> transaction chiffrée</span>
          </div>
        </Card>

        <Card className="card-pad">
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <Receipt size={17} />
            <h3 className="card-title">Mes reçus</h3>
          </div>
          {isLoading && <TableSkeleton rows={3} cols={3} />}
          {!isLoading && !(data?.invoices.length) && (
            <EmptyState
              title="Aucun paiement pour l'instant"
              description="Votre essai gratuit est en cours. Les reçus apparaîtront ici dès le premier règlement."
              icon={Receipt}
            />
          )}
          {!!data?.invoices.length && (
            <div className="stack gap-10">
              {data.invoices.map((invoice) => (
                <div key={invoice.id} className="invoice-row">
                  <div className="grow">
                    <strong>{invoice.reference}</strong>
                    <div className="tiny muted">
                      {invoice.plan} · {formatDate(invoice.createdAt)} · {METHODS.find((m) => m.id === invoice.method)?.label ?? invoice.method}
                    </div>
                  </div>
                  <div className="right">
                    <strong>{formatCurrency(invoice.amount, invoice.currency)}</strong>
                    <div className="tiny muted">
                      {invoice.periodEnd ? `jusqu'au ${formatDate(invoice.periodEnd)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="card-pad">
        <div className="row gap-12 wrap">
          <Sparkles size={17} />
          <div className="grow">
            <strong>Besoin d'une facture ou d'un devis ?</strong>
            <p className="small muted">
              Écrivez à <a href="mailto:businesscongo.inf@gmail.com">businesscongo.inf@gmail.com</a> — réponse sous 24 h ouvrées.
              {data?.tenant ? ` Devise de facturation : ${data.tenant.currency}.` : ''}
              {data?.tenant ? ` Utilisateurs inclus : ${formatNumber(data.tenant.seats ?? 0)}.` : ''}
            </p>
          </div>
          <Badge tone="neutral"><AlertTriangle size={12} /> Aucun engagement caché</Badge>
        </div>
      </Card>
    </div>
  );
}

export default Billing;
