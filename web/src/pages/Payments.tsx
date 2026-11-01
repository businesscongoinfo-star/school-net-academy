import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Wallet, Clock, AlertCircle, CheckCircle2, SearchX, AlertTriangle,
  Banknote, Receipt, ArrowUpRight, TrendingUp,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Meta, Payment } from '../lib/types';
import { useAuth } from '../lib/auth';
import { PAYMENT_STATUS, labelOf, toneOf } from '../lib/labels';
import { colorFor, formatDate, formatMoney, relativeTime, toDateInput } from '../lib/format';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Pagination,
  SearchInput, Select, StatCard, TableSkeleton, Textarea,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

const PAGE_SIZE = 12;

type FormState = {
  studentId: string; amount: string; type: string; method: string;
  status: string; paidAt: string; dueDate: string; term: string; note: string;
};

export function Payments() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Payment | null>(null);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  function blankForm(): FormState {
    return {
      studentId: '', amount: '', type: 'Scolarité', method: 'Mobile Money', status: 'paye',
      paidAt: new Date().toISOString().slice(0, 10), dueDate: '', term: '',
      note: '',
    };
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['payments', { search, statusFilter, methodFilter, typeFilter }],
    queryFn: () => get<{ items: Payment[]; stats: Record<string, number> }>(
      `/payments${qs({ search, status: statusFilter, method: methodFilter, type: typeFilter })}`,
    ),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = data?.stats ?? {};

  useEffect(() => { setPage(1); }, [search, statusFilter, methodFilter, typeFilter]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isAdmin) {
      openCreate(searchParams.get('studentId') ?? '');
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      next.delete('studentId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate(studentId = '') {
    setEditing(null);
    setForm({ ...blankForm(), studentId });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(payment: Payment) {
    setEditing(payment);
    setForm({
      studentId: payment.studentId ?? '',
      amount: String(payment.amount),
      type: payment.type,
      method: payment.method,
      status: payment.status,
      paidAt: toDateInput(payment.paidAt),
      dueDate: toDateInput(payment.dueDate),
      term: payment.term ?? '',
      note: payment.note ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/payments/${editing.id}`, payload) : post('/payments', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Paiement mis à jour' : 'Paiement enregistré', `${formatMoney(Number(form.amount) || 0)} · ${form.type}`);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/payments/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['payments'] });
      const snapshot = queryClient.getQueriesData<{ items: Payment[] }>({ queryKey: ['payments'] });
      queryClient.setQueriesData<{ items: Payment[] }>({ queryKey: ['payments'] }, (old) => old ? {
        ...old,
        items: old.items.map((payment) => payment.id === id
          ? { ...payment, status: status as Payment['status'], paidAt: status === 'paye' ? new Date().toISOString() : null }
          : payment),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _vars, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Mise à jour impossible', error.message);
    },
    onSuccess: (_data, vars) => toast.success('Statut enregistré', `Paiement marqué « ${labelOf(PAYMENT_STATUS, vars.status)} ».`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/payments/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['payments'] });
      const snapshot = queryClient.getQueriesData<{ items: Payment[] }>({ queryKey: ['payments'] });
      queryClient.setQueriesData<{ items: Payment[] }>({ queryKey: ['payments'] }, (old) => old ? {
        ...old, items: old.items.filter((payment) => payment.id !== id),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _id, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Suppression impossible', error.message);
    },
    onSuccess: () => toast.success('Paiement supprimé'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setToDelete(null);
    },
  });

  function submit() {
    if (!form.studentId) { setFormError('Sélectionnez un élève.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError('Saisissez un montant valide.'); return; }
    saveMutation.mutate(form);
  }

  const hasFilters = Boolean(search || statusFilter || methodFilter || typeFilter);

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Paiements' : 'Mes paiements'}
        subtitle={isAdmin ? 'Encaissements, échéances et relances de scolarité.' : 'Historique des frais de scolarité de vos enfants.'}
        actions={isAdmin ? <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Enregistrer un paiement</Button> : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Total encaissé" value={formatMoney(stats.encaisse, true)} icon={Wallet} loading={isLoading} foot={<span>{stats.transactions ?? 0} transactions</span>} />
        <StatCard label="30 derniers jours" value={formatMoney(stats.recent, true)} icon={TrendingUp} tone="violet" loading={isLoading} foot={<><span className="trend up"><ArrowUpRight size={12} /></span><span>activité récente</span></>} />
        <StatCard label="En attente" value={formatMoney(stats.enAttente, true)} icon={Clock} tone="amber" loading={isLoading} foot={<span>Échéances à venir</span>} />
        <StatCard label="En retard" value={formatMoney(stats.retard, true)} icon={AlertCircle} tone="danger" loading={isLoading} foot={<span>Relances à effectuer</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Élève ou référence…" />
          <div className="filter-bar" style={{ marginLeft: 'auto' }}>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Statut">
              <option value="">Tous les statuts</option>
              {Object.entries(PAYMENT_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
            <Select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} aria-label="Moyen de paiement">
              <option value="">Tous les moyens</option>
              {(meta.data?.paymentMethods ?? []).map((method) => <option key={method} value={method}>{method}</option>)}
            </Select>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Type de frais">
              <option value="">Tous les frais</option>
              {(meta.data?.paymentTypes ?? []).map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
          </div>
        </div>

        {isLoading && <TableSkeleton rows={7} cols={6} />}

        {isError && <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />}

        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState
            icon={hasFilters ? SearchX : Receipt}
            title={hasFilters ? 'Aucun paiement ne correspond' : isAdmin ? 'Aucun paiement enregistré' : 'Aucun paiement'}
            description={hasFilters ? 'Réinitialisez les filtres pour retrouver l’ensemble des transactions.' : isAdmin ? 'Enregistrez un premier encaissement pour suivre la scolarité.' : 'Les frais réglés apparaîtront ici.'}
            action={hasFilters ? (
              <Button onClick={() => { setSearch(''); setStatusFilter(''); setMethodFilter(''); setTypeFilter(''); }}>Réinitialiser</Button>
            ) : isAdmin ? (
              <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Enregistrer un paiement</Button>
            ) : undefined}
          />
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th className="hide-sm">Référence</th>
                    <th>Frais</th>
                    <th className="hide-sm">Moyen</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((payment) => {
                    const pending = payment.status === 'en_attente' || payment.status === 'retard';
                    return (
                      <tr key={payment.id}>
                        <td>
                          <div className="row-avatar">
                            <Avatar
                              name={`${payment.firstName ?? ''} ${payment.lastName ?? ''}`}
                              color={colorFor(payment.studentId ?? payment.id)}
                              size="sm"
                            />
                            <div>
                              <div className="cell-main">{payment.studentName}</div>
                              <div className="cell-sub">{payment.className ?? '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hide-sm">
                          <div className="small">{payment.reference}</div>
                          <div className="cell-sub">{payment.term ?? '—'}</div>
                        </td>
                        <td>
                          <div className="small strong" style={{ fontWeight: 500 }}>{payment.type}</div>
                          <div className="cell-sub">
                            {payment.status === 'paye' ? `Payé ${relativeTime(payment.paidAt)}` : payment.dueDate ? `Échéance ${formatDate(payment.dueDate)}` : '—'}
                          </div>
                        </td>
                        <td className="hide-sm"><span className="tag">{payment.method}</span></td>
                        <td><span className="strong nowrap">{formatMoney(payment.amount)}</span></td>
                        <td><Badge tone={toneOf(PAYMENT_STATUS, payment.status)} dot>{labelOf(PAYMENT_STATUS, payment.status)}</Badge></td>
                        <td>
                          <div className="actions">
                            {isAdmin && pending && (
                              <IconButton
                                icon={CheckCircle2}
                                label="Marquer comme payé"
                                onClick={() => statusMutation.mutate({ id: payment.id, status: 'paye' })}
                              />
                            )}
                            {isAdmin && payment.status === 'paye' && (
                              <IconButton
                                icon={Banknote}
                                label="Repasser en attente"
                                onClick={() => statusMutation.mutate({ id: payment.id, status: 'en_attente' })}
                              />
                            )}
                            {isAdmin && <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(payment)} />}
                            {isAdmin && <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(payment)} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le paiement' : 'Enregistrer un paiement'}
        description="Montants en francs CFA (XAF)."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Encaisser'}
            </Button>
          </>
        )}
      >
        <div className="form-grid">
          {formError && (
            <div className="span-2" style={{ background: 'var(--danger-soft)', color: '#a52f23', padding: '9px 12px', borderRadius: 9, fontSize: 12.5 }}>
              {formError}
            </div>
          )}
          <Field label="Élève" htmlFor="pStudent" className="span-2">
            <Select id="pStudent" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
              <option value="">Sélectionner un élève…</option>
              {(meta.data?.students ?? []).map((student) => (
                <option key={student.id} value={student.id}>{student.name} · {student.className ?? 'Non affecté'}</option>
              ))}
            </Select>
          </Field>
          <Field label="Montant (FCFA)" htmlFor="pAmount">
            <Input id="pAmount" type="number" min={0} step={500} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="150000" />
          </Field>
          <Field label="Type de frais" htmlFor="pType">
            <Select id="pType" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {(meta.data?.paymentTypes ?? []).map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
          </Field>
          <Field label="Moyen de paiement" htmlFor="pMethod">
            <Select id="pMethod" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
              {(meta.data?.paymentMethods ?? []).map((method) => <option key={method} value={method}>{method}</option>)}
            </Select>
          </Field>
          <Field label="Statut" htmlFor="pStatus">
            <Select id="pStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {Object.entries(PAYMENT_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </Field>
          <Field label="Date de paiement" htmlFor="pPaid" hint="Utilisée pour les encaissements.">
            <Input id="pPaid" type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} />
          </Field>
          <Field label="Date d'échéance" htmlFor="pDue">
            <Input id="pDue" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </Field>
          <Field label="Trimestre" htmlFor="pTerm">
            <Select id="pTerm" value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}>
              <option value="">Non précisé</option>
              {(meta.data?.terms ?? []).map((term) => <option key={term} value={term}>{term}</option>)}
            </Select>
          </Field>
          <Field label="Note" htmlFor="pNote" className="span-2">
            <Textarea id="pNote" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Référence Mobile Money, reçu, remarque…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer le paiement"
        description={toDelete ? `${toDelete.reference} · ${formatMoney(toDelete.amount)} sera définitivement supprimé de l'historique.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
