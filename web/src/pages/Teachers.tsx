import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, GraduationCap, Users, BookOpen, SearchX, Mail, Phone, AlertTriangle, Download,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Teacher } from '../lib/types';
import { useAuth } from '../lib/auth';
import { TEACHER_STATUS, labelOf, toneOf } from '../lib/labels';
import { colorFor, formatDate } from '../lib/format';
import { datedFilename, downloadCsv } from '../lib/csv';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Pagination,
  SearchInput, Select, StatCard, TableSkeleton, Textarea,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

const PAGE_SIZE = 10;

type FormState = {
  firstName: string; lastName: string; email: string; phone: string;
  subject: string; status: string; hiredAt: string; notes: string;
};

const emptyForm: FormState = {
  firstName: '', lastName: '', email: '', phone: '', subject: 'Mathématiques',
  status: 'actif', hiredAt: new Date().toISOString().slice(0, 10), notes: '',
};

export function Teachers() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Teacher | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teachers', { search, statusFilter }],
    queryFn: () => get<{ items: Teacher[]; stats: Record<string, number> }>(`/teachers${qs({ search, status: statusFilter })}`),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(teacher: Teacher) {
    setEditing(teacher);
    setForm({
      firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email,
      phone: teacher.phone ?? '', subject: teacher.subject, status: teacher.status,
      hiredAt: teacher.hiredAt ?? '', notes: teacher.notes ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/teachers/${editing.id}`, payload) : post('/teachers', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Enseignant mis à jour' : 'Enseignant ajouté', `${form.firstName} ${form.lastName} · ${form.subject}`);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/teachers/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['teachers'] });
      const snapshot = queryClient.getQueriesData<{ items: Teacher[] }>({ queryKey: ['teachers'] });
      queryClient.setQueriesData<{ items: Teacher[] }>({ queryKey: ['teachers'] }, (old) => old ? {
        ...old, items: old.items.filter((teacher) => teacher.id !== id),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _id, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Suppression impossible', error.message);
    },
    onSuccess: () => toast.success('Enseignant retiré'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setToDelete(null);
    },
  });

  function submit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setFormError('Prénom, nom et e-mail sont obligatoires.');
      return;
    }
    saveMutation.mutate(form);
  }

  function exportCsv() {
    const count = downloadCsv(datedFilename('enseignants'), items, [
      { header: 'Nom', value: (t) => t.lastName },
      { header: 'Prénom', value: (t) => t.firstName },
      { header: 'Matière', value: (t) => t.subject },
      { header: 'Statut', value: (t) => labelOf(TEACHER_STATUS, t.status) },
      { header: 'E-mail', value: (t) => t.email },
      { header: 'Téléphone', value: (t) => t.phone ?? '' },
      { header: 'Embauche', value: (t) => t.hiredAt ?? '' },
      { header: 'Classes', value: (t) => t.classCount ?? 0 },
      { header: 'Cours', value: (t) => t.courseCount ?? 0 },
    ]);
    toast.success('Export CSV prêt', `${count} enseignant(s) exporté(s).`);
  }

  return (
    <>
      <PageHeader
        title="Enseignants"
        subtitle="Équipe pédagogique, matières et affectations aux classes."
        actions={isAdmin ? (
          <>
            <Button icon={Download} onClick={exportCsv} disabled={!items.length}>Exporter</Button>
            <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvel enseignant</Button>
          </>
        ) : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Enseignants" value={data?.stats.total ?? 0} icon={GraduationCap} loading={isLoading} foot={<span>{data?.stats.actifs ?? 0} en poste</span>} />
        <StatCard label="En congé" value={data?.stats.conge ?? 0} icon={Users} tone="amber" loading={isLoading} foot={<span>À remplacer si besoin</span>} />
        <StatCard label="Matières couvertes" value={data?.stats.matieres ?? 0} icon={BookOpen} tone="info" loading={isLoading} foot={<span>Sur le programme</span>} />
        <StatCard label="Classes titulaires" value={items.reduce((sum, teacher) => sum + (teacher.classCount ?? 0), 0)} icon={Users} tone="violet" loading={isLoading} foot={<span>Affectations actives</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Nom, e-mail ou matière…" />
          <div className="filter-bar" style={{ marginLeft: 'auto' }}>
            <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {Object.entries(TEACHER_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </div>
        </div>

        {isLoading && <TableSkeleton rows={6} cols={5} />}

        {isError && (
          <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState
            icon={search || statusFilter ? SearchX : GraduationCap}
            title={search || statusFilter ? 'Aucun enseignant trouvé' : 'Aucun enseignant enregistré'}
            description={search || statusFilter ? 'Ajustez la recherche ou le filtre de statut.' : "Ajoutez l'équipe pédagogique pour affecter des titulaires aux classes."}
            action={isAdmin && !search && !statusFilter ? <Button variant="primary" icon={Plus} onClick={openCreate}>Ajouter un enseignant</Button> : undefined}
          />
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Enseignant</th>
                    <th>Matière</th>
                    <th className="hide-sm">Contact</th>
                    <th className="hide-sm">Affectations</th>
                    <th>Statut</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <div className="row-avatar">
                          <Avatar name={`${teacher.firstName} ${teacher.lastName}`} color={colorFor(teacher.id)} />
                          <div>
                            <div className="cell-main">{teacher.firstName} {teacher.lastName}</div>
                            <div className="cell-sub">Depuis {formatDate(teacher.hiredAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone="primary">{teacher.subject}</Badge></td>
                      <td className="hide-sm">
                        <div className="row gap-6 small"><Mail size={12} style={{ color: 'var(--ink-300)' }} /> {teacher.email}</div>
                        <div className="row gap-6 cell-sub mt-4"><Phone size={11} /> {teacher.phone ?? '—'}</div>
                      </td>
                      <td className="hide-sm">
                        <div className="small">{teacher.classCount ?? 0} classe(s)</div>
                        <div className="cell-sub">{teacher.courseCount ?? 0} cours en ligne</div>
                      </td>
                      <td>
                        <Badge tone={toneOf(TEACHER_STATUS, teacher.status)} dot>{labelOf(TEACHER_STATUS, teacher.status)}</Badge>
                      </td>
                      <td>
                        <div className="actions">
                          {isAdmin && <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(teacher)} />}
                          {isAdmin && <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(teacher)} />}
                        </div>
                      </td>
                    </tr>
                  ))}
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
        title={editing ? 'Modifier un enseignant' : 'Ajouter un enseignant'}
        description="Un enseignant peut être désigné titulaire d'une ou plusieurs classes."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Ajouter'}
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
          <Field label="Prénom" htmlFor="tFirstName">
            <Input id="tFirstName" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          </Field>
          <Field label="Nom" htmlFor="tLastName">
            <Input id="tLastName" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </Field>
          <Field label="Adresse e-mail" htmlFor="tEmail">
            <Input id="tEmail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="prenom.nom@schoolnet.academy" />
          </Field>
          <Field label="Téléphone" htmlFor="tPhone">
            <Input id="tPhone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+242 06 000 00 00" />
          </Field>
          <Field label="Matière principale" htmlFor="tSubject">
            <Input id="tSubject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Mathématiques" />
          </Field>
          <Field label="Statut" htmlFor="tStatus">
            <Select id="tStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {Object.entries(TEACHER_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </Field>
          <Field label="Date d'embauche" htmlFor="tHired">
            <Input id="tHired" type="date" value={form.hiredAt} onChange={(event) => setForm({ ...form, hiredAt: event.target.value })} />
          </Field>
          <Field label="Notes" htmlFor="tNotes" className="span-2">
            <Textarea id="tNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Diplômes, disponibilités, remarques…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Retirer l'enseignant"
        description={toDelete ? `${toDelete.firstName} ${toDelete.lastName} sera supprimé. Les enseignants titulaires d'une classe ne peuvent pas être retirés.` : ''}
        confirmLabel="Retirer"
      />
    </>
  );
}
