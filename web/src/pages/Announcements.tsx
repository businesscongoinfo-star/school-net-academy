import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Megaphone, Send, EyeOff, SearchX, AlertTriangle, Bell, Users,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Announcement } from '../lib/types';
import { AUDIENCE, labelOf, toneOf } from '../lib/labels';
import { formatDate, relativeTime } from '../lib/format';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SearchInput, Select,
  StatCard, TableSkeleton, Tabs, Textarea,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';
import { useAuth } from '../lib/auth';

type FormState = { title: string; body: string; audience: string; status: string };
const emptyForm: FormState = { title: '', body: '', audience: 'tous', status: 'publie' };

export function Announcements() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'toutes' | 'publie' | 'brouillon'>('toutes');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['announcements', { search }],
    queryFn: () => get<{ items: Announcement[]; canManage: boolean; stats: Record<string, number> }>(`/announcements${qs({ search })}`),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(() => (
    filter === 'toutes' ? items : items.filter((item) => item.status === filter)
  ), [items, filter]);
  const stats = data?.stats ?? {};

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(announcement: Announcement) {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      status: announcement.status,
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/announcements/${editing.id}`, payload) : post('/announcements', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Annonce mise à jour' : 'Annonce publiée', form.title);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'publie' | 'brouillon' }) => patch(`/announcements/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['announcements'] });
      const snapshot = queryClient.getQueriesData<{ items: Announcement[] }>({ queryKey: ['announcements'] });
      queryClient.setQueriesData<{ items: Announcement[] }>({ queryKey: ['announcements'] }, (old) => old ? {
        ...old, items: old.items.map((item) => item.id === id ? { ...item, status } : item),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _vars, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Mise à jour impossible', error.message);
    },
    onSuccess: (_data, vars) => toast.success(vars.status === 'publie' ? 'Annonce publiée' : 'Annonce repassée en brouillon'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/announcements/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['announcements'] });
      const snapshot = queryClient.getQueriesData<{ items: Announcement[] }>({ queryKey: ['announcements'] });
      queryClient.setQueriesData<{ items: Announcement[] }>({ queryKey: ['announcements'] }, (old) => old ? {
        ...old, items: old.items.filter((item) => item.id !== id),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _id, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Suppression impossible', error.message);
    },
    onSuccess: () => toast.success('Annonce supprimée'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setToDelete(null);
    },
  });

  function submit() {
    if (form.title.trim().length < 4) { setFormError("Le titre doit contenir au moins 4 caractères."); return; }
    if (form.body.trim().length < 10) { setFormError('Le message doit contenir au moins 10 caractères.'); return; }
    saveMutation.mutate(form);
  }

  return (
    <>
      <PageHeader
        title="Annonces"
        subtitle={isAdmin ? 'Communiquez avec les parents, les enseignants et les élèves.' : 'Les communications de l’école qui vous concernent.'}
        actions={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvelle annonce</Button> : undefined}
      />

      {isAdmin && (
        <div className="grid grid-3">
          <StatCard label="Annonces" value={stats.total ?? 0} icon={Megaphone} loading={isLoading} foot={<span>Toutes audiences</span>} />
          <StatCard label="Publiées" value={stats.publies ?? 0} icon={Send} tone="info" loading={isLoading} foot={<span>Visibles par les destinataires</span>} />
          <StatCard label="Brouillons" value={stats.brouillons ?? 0} icon={EyeOff} tone="amber" loading={isLoading} foot={<span>À finaliser</span>} />
        </div>
      )}

      <div className="row gap-10 wrap mt-16">
        {isAdmin && (
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'toutes', label: 'Toutes', count: items.length },
              { value: 'publie', label: 'Publiées', count: stats.publies ?? 0 },
              { value: 'brouillon', label: 'Brouillons', count: stats.brouillons ?? 0 },
            ]}
          />
        )}
        <div style={{ marginLeft: 'auto' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une annonce…" />
        </div>
      </div>

      {isLoading && <Card className="mt-16"><TableSkeleton rows={4} cols={3} /></Card>}

      {isError && <Card className="mt-16"><EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} /></Card>}

      {!isLoading && !isError && filtered.length === 0 && (
        <Card className="mt-16">
          <EmptyState
            icon={search || filter !== 'toutes' ? SearchX : Megaphone}
            title={search || filter !== 'toutes' ? 'Aucune annonce trouvée' : 'Aucune annonce'}
            description={search || filter !== 'toutes' ? 'Essayez un autre mot-clé ou un autre onglet.' : isAdmin ? 'Publiez une première annonce pour informer les familles.' : 'Les communications de l’école apparaîtront ici.'}
            action={isAdmin && !search && filter === 'toutes' ? <Button variant="primary" icon={Plus} onClick={openCreate}>Écrire une annonce</Button> : undefined}
          />
        </Card>
      )}

      <div className="stack gap-16 mt-16">
        {filtered.map((announcement) => (
          <Card key={announcement.id} className="card-pad">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
                <span className="stat-icon" style={{ width: 34, height: 34, borderRadius: 10, flex: 'none' }}>
                  <Bell size={16} />
                </span>
                <div>
                  <h3 style={{ fontSize: 14.5 }}>{announcement.title}</h3>
                  <div className="row gap-8 wrap mt-4">
                    <Badge tone={toneOf(AUDIENCE, announcement.audience)}><Users size={11} /> {labelOf(AUDIENCE, announcement.audience)}</Badge>
                    <Badge tone={announcement.status === 'publie' ? 'success' : 'warning'}>
                      {announcement.status === 'publie' ? 'Publiée' : 'Brouillon'}
                    </Badge>
                    <span className="tiny muted">
                      {announcement.status === 'publie'
                        ? `Publiée ${relativeTime(announcement.publishedAt)}`
                        : `Créée ${relativeTime(announcement.createdAt)}`}
                      {announcement.authorName ? ` · ${announcement.authorName}` : ''}
                    </span>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="row gap-4">
                  <IconButton
                    icon={announcement.status === 'publie' ? EyeOff : Send}
                    label={announcement.status === 'publie' ? 'Dépublier' : 'Publier'}
                    onClick={() => statusMutation.mutate({ id: announcement.id, status: announcement.status === 'publie' ? 'brouillon' : 'publie' })}
                  />
                  <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(announcement)} />
                  <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(announcement)} />
                </div>
              )}
            </div>
            <p className="small" style={{ marginTop: 12, color: 'var(--ink-500)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
              {announcement.body}
            </p>
            {announcement.status === 'publie' && announcement.publishedAt && (
              <div className="tiny muted mt-8">Publiée le {formatDate(announcement.publishedAt, true)}</div>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Modifier l'annonce" : 'Nouvelle annonce'}
        description="Choisissez l'audience et publiez immédiatement ou enregistrez en brouillon."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {form.status === 'brouillon' ? 'Enregistrer le brouillon' : 'Publier l’annonce'}
            </Button>
          </>
        )}
      >
        <div className="stack gap-16">
          {formError && (
            <div style={{ background: 'var(--danger-soft)', color: '#a52f23', padding: '9px 12px', borderRadius: 9, fontSize: 12.5 }}>
              {formError}
            </div>
          )}
          <Field label="Titre" htmlFor="anTitle">
            <Input id="anTitle" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Réunion parents — Trimestre 2" />
          </Field>
          <Field label="Message" htmlFor="anBody">
            <Textarea id="anBody" rows={6} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Détaillez l'information à communiquer…" />
          </Field>
          <div className="form-grid">
            <Field label="Audience" htmlFor="anAudience">
              <Select id="anAudience" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
                {Object.entries(AUDIENCE).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </Select>
            </Field>
            <Field label="Statut" htmlFor="anStatus">
              <Select id="anStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="publie">Publier maintenant</option>
                <option value="brouillon">Enregistrer en brouillon</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer l'annonce"
        description={toDelete ? `« ${toDelete.title} » sera définitivement supprimée.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
