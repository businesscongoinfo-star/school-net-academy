import { useMemo, useState } from 'react';
import {
  Building2, CalendarClock, CreditCard, Crown, DollarSign, Headphones, Mail, Megaphone,
  MessageSquare, Pencil, Plus, RefreshCw, Send, ShieldCheck, Target, Trash2, TrendingUp,
  UserPlus, Users, Wallet, XCircle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { ApiError, del, get, patch, post, qs } from '../lib/api';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Select, StatCard,
  TableSkeleton, Textarea,
} from '../components/ui';
import { Modal } from '../components/overlays';
import { useToast } from '../components/toast';
import { formatCurrency } from '../lib/countries';
import { formatDate, formatDateTime, formatNumber, relativeTime } from '../lib/format';
import type {
  NewsletterCampaign, NewsletterSubscriber, PlatformOverview, PlatformStaff, PlatformTenant,
  PlatformRole, SmsMessage, SubscriptionInvoice, TenantSummary,
} from '../lib/types';

type TabId = 'overview' | 'tenants' | 'staff' | 'subscriptions' | 'newsletter' | 'sms';

const TABS: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: 'overview', label: "Vue d'ensemble", icon: TrendingUp },
  { id: 'tenants', label: 'Établissements', icon: Building2 },
  { id: 'staff', label: 'Équipe plateforme', icon: Users },
  { id: 'subscriptions', label: 'Abonnements', icon: Wallet },
  { id: 'newsletter', label: 'Newsletter', icon: Megaphone },
  { id: 'sms', label: 'Journal SMS', icon: MessageSquare },
];

const ROLE_CAPS: Record<PlatformRole, TabId[]> = {
  owner: ['overview', 'tenants', 'staff', 'subscriptions', 'newsletter', 'sms'],
  manager: ['overview', 'tenants', 'staff', 'subscriptions', 'newsletter', 'sms'],
  support: ['overview', 'tenants', 'staff', 'sms'],
  finance: ['overview', 'tenants', 'subscriptions', 'sms'],
  marketing: ['overview', 'newsletter'],
  closer: ['overview', 'tenants'],
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  owner: 'Propriétaire',
  manager: 'Gestionnaire',
  support: 'Support',
  finance: 'Financier',
  marketing: 'Marketeur',
  closer: 'Closer',
};

const ROLE_MISSION: Record<PlatformRole, string> = {
  owner: "Accès total : établissements, équipe, finances, campagnes et journal SMS.",
  manager: "Pilote l'ensemble de la plateforme, gère l'équipe et les abonnements.",
  support: "Accompagne les établissements, prolonge les essais, suit les SMS envoyés.",
  finance: "Suit la facturation, encaisse les abonnements, analyse les revenus.",
  marketing: "Conçoit et envoie les campagnes newsletter, anime la base d'abonnés.",
  closer: "Convertit les essais en abonnements payants et relance les comptes bloqués.",
};

const ROLE_ICON: Record<PlatformRole, typeof Crown> = {
  owner: Crown, manager: ShieldCheck, support: Headphones, finance: DollarSign,
  marketing: Megaphone, closer: Target,
};

const TENANT_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  essai: { label: 'Essai', tone: 'warning' },
  actif: { label: 'Actif', tone: 'success' },
  expire: { label: 'Expiré', tone: 'danger' },
  suspendu: { label: 'Suspendu', tone: 'danger' },
};

const METHODS = [
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'carte', label: 'Carte bancaire' },
  { id: 'virement', label: 'Virement' },
  { id: 'especes', label: 'Espèces' },
];

const AUDIENCES = [
  { id: 'abonnes', label: 'Tous les abonnés actifs' },
  { id: 'essais', label: 'Établissements en essai' },
  { id: 'clients', label: 'Établissements payants' },
];

export function Platform() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const role = (user?.platformRole ?? 'support') as PlatformRole;
  const allowed = ROLE_CAPS[role] ?? ['overview'];
  const [tab, setTab] = useState<TabId>(allowed[0] ?? 'overview');

  const activeTab = allowed.includes(tab) ? tab : allowed[0];

  const overview = useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: () => get<PlatformOverview>('/platform/overview'),
    enabled: allowed.includes('overview'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['platform'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="stack gap-20">
      <PageHeader
        title="Super administration"
        subtitle={`Espace de l'équipe School Net Academy — vous êtes connecté en tant que ${PLATFORM_ROLE_LABEL[role]}.`}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => invalidate()} loading={overview.isFetching}>
            Actualiser
          </Button>
        }
      />

      <div className="role-banner">
        {(() => { const Icon = ROLE_ICON[role]; return <span className="role-banner-icon"><Icon size={18} /></span>; })()}
        <div className="grow">
          <strong>{PLATFORM_ROLE_LABEL[role]} · vos accès</strong>
          <p className="small">{ROLE_MISSION[role]}</p>
        </div>
        <div className="row gap-6 wrap">
          {allowed.map((id) => (
            <span key={id} className="pill-soft">{TABS.find((entry) => entry.id === id)?.label}</span>
          ))}
        </div>
      </div>

      <div className="tabs-row">
        {TABS.filter((entry) => allowed.includes(entry.id)).map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`tab-btn${activeTab === entry.id ? ' active' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            <entry.icon size={15} /> {entry.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          data={overview.data}
          loading={overview.isLoading}
          canConvert={allowed.includes('subscriptions')}
          onChanged={invalidate}
        />
      )}
      {activeTab === 'tenants' && <TenantsTab canManage={['manager', 'finance', 'owner'].includes(role)} onChanged={invalidate} />}
      {activeTab === 'staff' && <StaffTab canWrite={['manager', 'owner'].includes(role)} onChanged={invalidate} />}
      {activeTab === 'subscriptions' && <SubscriptionsTab onChanged={invalidate} />}
      {activeTab === 'newsletter' && (
        <NewsletterTab
          notify={(message, kind) => (kind === 'error' ? toastError(message) : success(message))}
        />
      )}
      {activeTab === 'sms' && <SmsTab />}
    </div>
  );
}

/* ------------------------------ Vue d'ensemble ---------------------------- */

function OverviewTab({
  data, loading, canConvert, onChanged,
}: {
  data?: PlatformOverview;
  loading: boolean;
  canConvert: boolean;
  onChanged: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [target, setTarget] = useState<TenantSummary | null>(null);

  const extend = useMutation({
    mutationFn: (tenant: TenantSummary) => patch(`/platform/tenants/${tenant.id}`, { trialDays: 7, status: 'essai' }),
    onSuccess: () => { success('Essai prolongé de 7 jours.'); onChanged(); },
    onError: (err) => toastError(err instanceof ApiError ? err.message : 'Action impossible.'),
  });

  if (loading || !data) {
    return <div className="grid grid-4">{[0, 1, 2, 3].map((key) => <Card key={key} className="card-pad"><TableSkeleton rows={2} cols={2} /></Card>)}</div>;
  }

  const kpis = data.kpis;

  return (
    <div className="stack gap-20">
      <div className="grid grid-4">
        <StatCard label="Établissements" value={formatNumber(kpis.tenants)} icon={Building2} foot={`${kpis.actifs} actifs · ${kpis.essais} en essai`} />
        <StatCard label="Revenu mensuel (MRR)" value={formatCurrency(kpis.mrr, 'XAF')} icon={TrendingUp} tone="primary" foot="Abonnements actifs" />
        <StatCard label="Encaissé (30 j)" value={formatCurrency(kpis.revenue30d, 'XAF')} icon={Wallet} foot={`${formatCurrency(kpis.revenue, 'XAF')} au total`} />
        <StatCard label="Abonnés newsletter" value={formatNumber(kpis.subscribers)} icon={Mail} foot={`${kpis.staff} agents plateforme`} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="card-head">
            <h3>Essais en cours</h3>
            <Badge tone="warning">{data.trials.length}</Badge>
          </div>
          <div className="card-body stack gap-10">
            {!data.trials.length && <EmptyState title="Aucun essai en cours" description="Tous les établissements ont une offre active." icon={CalendarClock} />}
            {data.trials.map((tenant) => {
              const days = tenant.access?.daysLeft ?? 0;
              return (
                <div key={tenant.id} className="trial-row">
                  <div className="grow">
                    <strong>{tenant.name}</strong>
                    <div className="tiny muted">{tenant.country} · {tenant.kind} · {tenant.currency}</div>
                  </div>
                  <Badge tone={days <= 2 ? 'danger' : 'warning'}>{days} j restants</Badge>
                  <div className="row gap-6">
                    {canConvert && (
                      <Button size="sm" variant="soft" icon={CreditCard} onClick={() => setTarget(tenant)}>Convertir</Button>
                    )}
                    <Button size="sm" variant="secondary" icon={CalendarClock} loading={extend.isPending} onClick={() => extend.mutate(tenant)}>
                      +7 j
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Derniers encaissements</h3>
            <Badge tone="neutral">{data.invoices.length}</Badge>
          </div>
          <div className="card-body stack gap-10">
            {!data.invoices.length && <EmptyState title="Pas encore d'encaissement" description="Les paiements d'abonnement apparaîtront ici." icon={CreditCard} />}
            {data.invoices.map((invoice) => (
              <div key={invoice.id} className="trial-row">
                <div className="grow">
                  <strong>{invoice.tenantName}</strong>
                  <div className="tiny muted">{invoice.reference} · {invoice.plan} · {relativeTime(invoice.createdAt)}</div>
                </div>
                <div className="right">
                  <strong>{formatCurrency(invoice.amount, invoice.currency)}</strong>
                  <div className="tiny muted">{METHODS.find((m) => m.id === invoice.method)?.label ?? invoice.method}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <h3>Équipe plateforme</h3>
          <Badge tone="neutral">{data.staff.length} agents</Badge>
        </div>
        <div className="card-body staff-chips">
          {data.staff.map((member) => {
            const memberRole = member.platformRole;
            const Icon = ROLE_ICON[memberRole] ?? Users;
            return (
              <div key={member.id} className="staff-chip">
                <span className="staff-chip-icon"><Icon size={14} /></span>
                <div>
                  <strong>{member.name}</strong>
                  <div className="tiny muted">{PLATFORM_ROLE_LABEL[memberRole] ?? memberRole}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <ConvertModal tenant={target} onClose={() => setTarget(null)} onDone={() => { onChanged(); setTarget(null); }} />
    </div>
  );
}

/* ------------------------------ Établissements ---------------------------- */

function TenantsTab({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState<TenantSummary | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'tenants', search, status],
    queryFn: () => get<{ items: PlatformTenant[] }>(`/platform/tenants${qs({ search, status })}`),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => patch(`/platform/tenants/${id}`, body),
    onSuccess: (_result, variables) => {
      success(variables.body.status === 'suspendu' ? 'Établissement suspendu.' : 'Établissement mis à jour.');
      onChanged();
    },
    onError: (err) => toastError(err instanceof ApiError ? err.message : 'Modification impossible.'),
  });

  const items = data?.items ?? [];

  return (
    <div className="stack gap-16">
      <Card className="card-pad">
        <div className="row gap-10 wrap">
          <Input
            placeholder="Rechercher un établissement, un pays, un e-mail…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ maxWidth: 340 }}
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} style={{ maxWidth: 190 }}>
            <option value="">Tous les statuts</option>
            <option value="essai">Essai</option>
            <option value="actif">Actif</option>
            <option value="expire">Expiré</option>
            <option value="suspendu">Suspendu</option>
          </Select>
          <div className="grow" />
          <Badge tone="neutral">{items.length} établissement{items.length > 1 ? 's' : ''}</Badge>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="card-body"><TableSkeleton rows={5} cols={5} /></div>
        ) : !items.length ? (
          <div className="card-body"><EmptyState title="Aucun établissement" description="Ajustez la recherche ou invitez un nouvel établissement à s'inscrire." icon={Building2} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Établissement</th>
                  <th>Pays</th>
                  <th>Statut</th>
                  <th>Offre</th>
                  <th>Utilisateurs</th>
                  <th>Créé le</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tenant) => {
                  const meta = TENANT_STATUS[tenant.status] ?? { label: tenant.status, tone: 'neutral' as const };
                  return (
                    <tr key={tenant.id}>
                      <td>
                        <div className="strong">{tenant.name}</div>
                        <div className="tiny muted">{tenant.owner?.email ?? tenant.email}</div>
                      </td>
                      <td>
                        <div>{tenant.country}</div>
                        <div className="tiny muted">{tenant.currency}</div>
                      </td>
                      <td>
                        <Badge tone={meta.tone} dot>{meta.label}</Badge>
                        {tenant.access?.status === 'essai' && (
                          <div className="tiny muted">{tenant.access.daysLeft} j restants</div>
                        )}
                      </td>
                      <td>{tenant.plan ?? '—'}</td>
                      <td>{tenant.users ?? 0}</td>
                      <td>{formatDate(tenant.createdAt)}</td>
                      <td>
                        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="soft" icon={CreditCard} onClick={() => setTarget(tenant)} disabled={!canManage}>
                            Abonner
                          </Button>
                          {tenant.status === 'suspendu' ? (
                            <Button size="sm" variant="secondary" icon={RefreshCw} disabled={!canManage} onClick={() => update.mutate({ id: tenant.id, body: { status: 'actif' } })}>
                              Réactiver
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" icon={XCircle} disabled={!canManage} onClick={() => update.mutate({ id: tenant.id, body: { status: 'suspendu' } })}>
                              Suspendre
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConvertModal tenant={target} onClose={() => setTarget(null)} onDone={() => { onChanged(); setTarget(null); }} />
    </div>
  );
}

function ConvertModal({ tenant, onClose, onDone }: { tenant: TenantSummary | null; onClose: () => void; onDone: () => void }) {
  const { success, error: toastError } = useToast();
  const [plan, setPlan] = useState('pro');
  const [method, setMethod] = useState('mobile_money');
  const [phone, setPhone] = useState('');

  const activate = useMutation({
    mutationFn: () => post(`/platform/tenants/${tenant?.id}/subscribe`, { plan, method, phone: phone || null }),
    onSuccess: () => { success(`Abonnement ${plan} activé pour ${tenant?.name}.`); onDone(); },
    onError: (err) => toastError(err instanceof ApiError ? err.message : 'Activation impossible.'),
  });

  return (
    <Modal
      open={Boolean(tenant)}
      onClose={onClose}
      title="Activer un abonnement"
      description={tenant ? `${tenant.name} · devise ${tenant.currency}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon={ShieldCheck} loading={activate.isPending} onClick={() => activate.mutate()}>
            Activer l'offre
          </Button>
        </>
      }
    >
      <div className="stack gap-14">
        <Field label="Offre">
          <Select value={plan} onChange={(event) => setPlan(event.target.value)}>
            <option value="essentiel">Essentiel — 15 000 FCFA / mois</option>
            <option value="pro">Pro — 45 000 FCFA / mois</option>
            <option value="universite">Université — 120 000 FCFA / an</option>
          </Select>
        </Field>
        <Field label="Moyen de paiement">
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </Field>
        {method === 'mobile_money' && (
          <Field label="Numéro Mobile Money" hint="Facultatif si le client a déjà communiqué son numéro.">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+242 06 000 00 00" />
          </Field>
        )}
        <p className="tiny muted">
          Le montant sera enregistré dans la devise de l'établissement (équivalent FCFA conservé pour les statistiques).
        </p>
      </div>
    </Modal>
  );
}

/* --------------------------------- Équipe -------------------------------- */

function StaffTab({ canWrite, onChanged }: { canWrite: boolean; onChanged: () => void }) {
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', platformRole: 'support' as PlatformRole, phone: '' });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'staff'],
    queryFn: () => get<{ items: PlatformStaff[] }>('/platform/staff'),
  });

  const create = useMutation({
    mutationFn: () => post<{ member: PlatformStaff; temporaryPassword?: string | null }>('/platform/staff', {
      name: form.name, email: form.email, platformRole: form.platformRole, phone: form.phone || null,
    }),
    onSuccess: (result) => {
      success(`${result.member.name} a rejoint l'équipe.`);
      setTempPassword(result.temporaryPassword ?? null);
      setForm({ name: '', email: '', platformRole: 'support', phone: '' });
      onChanged();
    },
    onError: (err) => toastError(err instanceof ApiError ? err.message : 'Création impossible.'),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, platformRole }: { id: string; platformRole: PlatformRole }) => patch(`/platform/staff/${id}`, { platformRole }),
    onSuccess: () => { success('Rôle mis à jour.'); onChanged(); },
    onError: (err) => toastError(err instanceof ApiError ? err.message : 'Modification impossible.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/platform/staff/${id}`),
    onSuccess: () => { success('Agent retiré de la plateforme.'); onChanged(); },
    onError: (err) => toastError(err instanceof ApiError ? err.message : 'Suppression impossible.'),
  });

  const items = data?.items ?? [];

  return (
    <div className="stack gap-16">
      <div className="grid grid-3">
        {(Object.keys(PLATFORM_ROLE_LABEL) as PlatformRole[]).filter((role) => role !== 'owner').map((role) => {
          const Icon = ROLE_ICON[role];
          const count = items.filter((member) => member.platformRole === role).length;
          return (
            <Card key={role} className="card-pad role-card">
              <div className="row gap-8">
                <span className="role-banner-icon"><Icon size={15} /></span>
                <strong className="grow">{PLATFORM_ROLE_LABEL[role]}</strong>
                <Badge tone="neutral">{count}</Badge>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>{ROLE_MISSION[role]}</p>
              <div className="row gap-6 wrap" style={{ marginTop: 10 }}>
                {ROLE_CAPS[role].map((id) => <span key={id} className="pill-soft">{TABS.find((t) => t.id === id)?.label}</span>)}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="card-head">
          <h3>Agents de la plateforme</h3>
          <div className="row gap-8">
            <Badge tone="neutral">{items.length}</Badge>
            <Button size="sm" variant="primary" icon={UserPlus} onClick={() => { setTempPassword(null); setOpen(true); }} disabled={!canWrite}>
              Ajouter un agent
            </Button>
          </div>
        </div>
        {isLoading ? (
          <div className="card-body"><TableSkeleton rows={4} cols={4} /></div>
        ) : !items.length ? (
          <div className="card-body"><EmptyState title="Aucun agent" description="Ajoutez les personnes qui accompagnent les établissements." icon={Users} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Rôle</th>
                  <th>Dernière connexion</th>
                  <th>Créé le</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="strong">{member.name}</div>
                      <div className="tiny muted">{member.email}</div>
                    </td>
                    <td>
                      <Select
                        value={member.platformRole}
                        disabled={!canWrite || member.platformRole === 'owner'}
                        onChange={(event) => updateRole.mutate({ id: member.id, platformRole: event.target.value as PlatformRole })}
                        style={{ maxWidth: 170 }}
                      >
                        {(Object.keys(PLATFORM_ROLE_LABEL) as PlatformRole[]).map((role) => (
                          <option key={role} value={role}>{PLATFORM_ROLE_LABEL[role]}</option>
                        ))}
                      </Select>
                    </td>
                    <td>{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : 'Jamais'}</td>
                    <td>{formatDate(member.createdAt)}</td>
                    <td>
                      <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                        <IconButton
                          icon={Trash2}
                          label="Retirer cet agent"
                          tone="danger"
                          disabled={!canWrite || member.platformRole === 'owner'}
                          onClick={() => { if (window.confirm(`Retirer ${member.name} de l'équipe ?`)) remove.mutate(member.id); }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter un agent"
        description="Chaque agent dispose de son propre espace et de ses accès selon son rôle."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
            <Button variant="primary" icon={Plus} loading={create.isPending} onClick={() => create.mutate()} disabled={!form.name || !form.email}>
              Créer le compte
            </Button>
          </>
        }
      >
        <div className="stack gap-14">
          <div className="form-grid">
            <Field label="Nom complet">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. Léa Mouyabi" />
            </Field>
            <Field label="Adresse e-mail">
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="prenom.nom@schoolnet.academy" />
            </Field>
            <Field label="Rôle">
              <Select value={form.platformRole} onChange={(event) => setForm({ ...form, platformRole: event.target.value as PlatformRole })}>
                {(Object.keys(PLATFORM_ROLE_LABEL) as PlatformRole[]).filter((role) => role !== 'owner').map((role) => (
                  <option key={role} value={role}>{PLATFORM_ROLE_LABEL[role]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Téléphone">
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+242 06 000 00 00" />
            </Field>
          </div>
          <p className="tiny muted">{ROLE_MISSION[form.platformRole]}</p>
          {tempPassword && (
            <div className="callout success">
              <ShieldCheck size={16} />
              <div>
                <strong>Mot de passe temporaire : {tempPassword}</strong>
                <p className="small">Communiquez-le à l'agent ; il pourra le changer depuis ses paramètres.</p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------- Abonnements ------------------------------ */

function SubscriptionsTab({ onChanged }: { onChanged: () => void }) {
  const { success, error: toastError } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'subscriptions'],
    queryFn: () => get<{ items: SubscriptionInvoice[]; stats: { count: number; total: number } }>('/platform/subscriptions'),
  });

  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  const items = data?.items ?? [];

  return (
    <div className="stack gap-16">
      <div className="grid grid-3">
        <StatCard label="Paiements enregistrés" value={formatNumber(data?.stats.count ?? 0)} icon={CreditCard} />
        <StatCard label="Encaissé (équivalent FCFA)" value={formatCurrency(data?.stats.total ?? 0, 'XAF')} icon={Wallet} tone="primary" />
        <StatCard label="Panier moyen" value={formatCurrency(data?.stats.count ? Math.round((data.stats.total ?? 0) / data.stats.count) : 0, 'XAF')} icon={TrendingUp} />
      </div>

      <Card>
        <div className="card-head">
          <h3>Historique des abonnements</h3>
          <Badge tone="neutral">{items.length}</Badge>
        </div>
        {isLoading ? (
          <div className="card-body"><TableSkeleton rows={5} cols={5} /></div>
        ) : !items.length ? (
          <div className="card-body"><EmptyState title="Aucun abonnement payé" description="Les conversions d'essais apparaîtront ici." icon={CreditCard} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Établissement</th>
                  <th>Offre</th>
                  <th>Montant</th>
                  <th>Période</th>
                  <th className="right">Détail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="strong">{row.reference}</td>
                    <td>
                      <div>{row.tenantName}</div>
                      <div className="tiny muted">{row.tenantCountry}</div>
                    </td>
                    <td>{row.plan}</td>
                    <td>
                      <div className="strong">{formatCurrency(row.amount, row.currency)}</div>
                      {row.amountFcfa ? <div className="tiny muted">{formatCurrency(row.amountFcfa, 'XAF')}</div> : null}
                    </td>
                    <td className="small">{formatDate(row.periodStart)} → {formatDate(row.periodEnd)}</td>
                    <td className="right">
                      <Button size="sm" variant="ghost" icon={Mail} onClick={() => setInvoice(row)}>Reçu</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(invoice)}
        onClose={() => setInvoice(null)}
        title={`Reçu ${invoice?.reference ?? ''}`}
        footer={<Button variant="primary" onClick={() => { success('Reçu envoyé par e-mail au client.'); setInvoice(null); onChanged(); }}>Envoyer au client</Button>}
      >
        {invoice && (
          <div className="receipt">
            <div className="row gap-8"><ShieldCheck size={16} /> <strong>School Net Academy</strong></div>
            <p className="small muted">Brazzaville, République du Congo · service@schoolnet.academy</p>
            <div className="sep" />
            <div className="receipt-line"><span>Client</span><strong>{invoice.tenantName}</strong></div>
            <div className="receipt-line"><span>Offre</span><strong>{invoice.plan}</strong></div>
            <div className="receipt-line"><span>Moyen</span><strong>{METHODS.find((m) => m.id === invoice.method)?.label ?? invoice.method}</strong></div>
            <div className="receipt-line"><span>Période</span><strong>{formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}</strong></div>
            <div className="receipt-line"><span>Statut</span><Badge tone="success">{invoice.status}</Badge></div>
            <div className="sep" />
            <div className="receipt-line total"><span>Total</span><strong>{formatCurrency(invoice.amount, invoice.currency)}</strong></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------- Newsletter ------------------------------- */

function NewsletterTab({ notify }: { notify: (message: string, kind?: 'error' | 'success') => void }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('abonnes');

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'newsletter'],
    queryFn: () => get<{
      subscribers: NewsletterSubscriber[]; campaigns: NewsletterCampaign[];
      stats: { actifs: number; desinscrits: number; total: number };
    }>('/platform/newsletter'),
  });

  const create = useMutation({
    mutationFn: (sendNow: boolean) => post<{ campaign: NewsletterCampaign }>('/platform/newsletter', { subject, body, audience, send: sendNow }),
    onSuccess: async (result) => {
      const campaign = result.campaign;
      if (campaign.status === 'brouillon') {
        notify('Campagne enregistrée en brouillon.');
      } else {
        await post(`/platform/newsletter/${campaign.id}/send`, {});
        queryClient.invalidateQueries({ queryKey: ['platform'] });
        notify(`Campagne envoyée à ${campaign.recipients} abonnés.`);
      }
      setSubject('');
      setBody('');
    },
    onError: (err) => notify(err instanceof ApiError ? err.message : 'Envoi impossible.', 'error'),
  });

  const send = useMutation({
    mutationFn: (id: string) => post(`/platform/newsletter/${id}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      notify('Campagne envoyée.');
    },
    onError: (err) => notify(err instanceof ApiError ? err.message : 'Envoi impossible.', 'error'),
  });

  const campaigns = data?.campaigns ?? [];
  const subscribers = data?.subscribers ?? [];
  const stats = data?.stats ?? { actifs: 0, desinscrits: 0, total: 0 };

  return (
    <div className="stack gap-16">
      <div className="grid grid-4">
        <StatCard label="Abonnés actifs" value={formatNumber(stats.actifs)} icon={Mail} tone="primary" />
        <StatCard label="Désinscrits" value={formatNumber(stats.desinscrits)} icon={XCircle} />
        <StatCard label="Campagnes envoyées" value={formatNumber(campaigns.filter((c) => c.status === 'envoyee').length)} icon={Send} />
        <StatCard label="Brouillons" value={formatNumber(campaigns.filter((c) => c.status !== 'envoyee').length)} icon={Pencil} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card className="card-pad">
          <h3 className="card-title">Nouvelle campagne</h3>
          <p className="card-sub">Rédigez votre message, choisissez l'audience et envoyez.</p>
          <div className="stack gap-14" style={{ marginTop: 12 }}>
            <Field label="Objet">
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex. Rentrée : découvrez les cartes scolaires NFC" />
            </Field>
            <Field label="Message" hint="Le prénom de l'établissement peut être inséré avec {{ecole}}.">
              <Textarea rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder={"Bonjour,\n\nCette rentrée, ..."} />
            </Field>
            <Field label="Audience">
              <Select value={audience} onChange={(event) => setAudience(event.target.value)}>
                {AUDIENCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>
            </Field>
            <div className="row gap-8">
              <Button
                variant="secondary"
                icon={Pencil}
                loading={create.isPending}
                disabled={subject.trim().length < 3 || body.trim().length < 10}
                onClick={() => create.mutate(false)}
              >
                Enregistrer en brouillon
              </Button>
              <Button
                variant="primary"
                icon={Send}
                loading={create.isPending}
                disabled={subject.trim().length < 3 || body.trim().length < 10}
                onClick={() => create.mutate(true)}
              >
                Envoyer maintenant
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Campagnes</h3>
            <Badge tone="neutral">{campaigns.length}</Badge>
          </div>
          {isLoading ? (
            <div className="card-body"><TableSkeleton rows={4} cols={3} /></div>
          ) : !campaigns.length ? (
            <div className="card-body"><EmptyState title="Aucune campagne" description="Créez votre première newsletter pour animer votre base." icon={Megaphone} /></div>
          ) : (
            <div className="card-body stack gap-10">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="campaign-row">
                  <div className="grow">
                    <strong>{campaign.subject}</strong>
                    <div className="tiny muted">
                      {campaign.status === 'envoyee'
                        ? `Envoyée ${relativeTime(campaign.sentAt)} · ${campaign.recipients} destinataires`
                        : 'Brouillon'}
                      {' · '}{AUDIENCES.find((a) => a.id === campaign.audience)?.label ?? campaign.audience}
                    </div>
                  </div>
                  {campaign.status === 'envoyee' ? (
                    <Badge tone="success">Envoyée</Badge>
                  ) : (
                    <Button size="sm" variant="soft" icon={Send} loading={send.isPending} onClick={() => send.mutate(campaign.id)}>
                      Envoyer
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <h3>Abonnés</h3>
          <Badge tone="neutral">{subscribers.length}</Badge>
        </div>
        {!subscribers.length ? (
          <div className="card-body"><EmptyState title="Pas encore d'abonné" description="Le formulaire du site alimente cette liste automatiquement." icon={Mail} /></div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>E-mail</th><th>Nom</th><th>Pays</th><th>Source</th><th>Statut</th><th>Inscrit le</th></tr>
              </thead>
              <tbody>
                {subscribers.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="strong">{subscriber.email}</td>
                    <td>{subscriber.name ?? '—'}</td>
                    <td>{subscriber.countryCode ?? '—'}</td>
                    <td className="small muted">{subscriber.source ?? '—'}</td>
                    <td>
                      <Badge tone={subscriber.status === 'actif' ? 'success' : 'neutral'}>{subscriber.status}</Badge>
                    </td>
                    <td className="small">{formatDate(subscriber.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------- SMS ---------------------------------- */

function SmsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'sms'],
    queryFn: () => get<{ items: SmsMessage[]; stats: { total: number; envoyes: number; simules: number }; configured: boolean }>('/platform/sms'),
  });

  const items = data?.items ?? [];

  return (
    <div className="stack gap-16">
      <div className="grid grid-3">
        <StatCard label="SMS journalisés" value={formatNumber(data?.stats.total ?? 0)} icon={MessageSquare} />
        <StatCard label="Envoyés (opérateur)" value={formatNumber(data?.stats.envoyes ?? 0)} icon={Send} tone="primary" />
        <StatCard label="Simulés" value={formatNumber(data?.stats.simules ?? 0)} icon={Headphones} foot="Aucun opérateur configuré" />
      </div>

      <div className="callout">
        <MessageSquare size={16} />
        <div>
          <strong>{data?.configured ? 'Passerelle SMS connectée' : 'Mode simulation'}</strong>
          <p className="small">
            {data?.configured
              ? "Les SMS sont transmis à l'opérateur configuré (SMS_API_URL / SMS_API_KEY)."
              : "Renseignez SMS_API_URL et SMS_API_KEY pour envoyer réellement les SMS. En attendant, chaque message est journalisé ici."}
          </p>
        </div>
      </div>

      <Card>
        <div className="card-head">
          <h3>Derniers messages</h3>
          <Badge tone="neutral">{items.length}</Badge>
        </div>
        {isLoading ? (
          <div className="card-body"><TableSkeleton rows={5} cols={4} /></div>
        ) : !items.length ? (
          <div className="card-body"><EmptyState title="Aucun SMS" description="Les alertes envoyées aux parents apparaîtront ici." icon={MessageSquare} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Destinataire</th><th>Message</th><th>Statut</th><th>Date</th></tr>
              </thead>
              <tbody>
                {items.map((message) => (
                  <tr key={message.id}>
                    <td className="strong nowrap">{message.to}</td>
                    <td className="small">{message.body}</td>
                    <td>
                      <Badge tone={message.status === 'envoye' ? 'success' : message.status === 'echec' ? 'danger' : 'neutral'}>
                        {message.status}
                      </Badge>
                    </td>
                    <td className="small nowrap">{formatDateTime(message.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Platform;
