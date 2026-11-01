import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, ClipboardList, CheckCircle2, XCircle, ArrowRightLeft, SearchX,
  Phone, Mail, School, Clock, AlertTriangle, UserPlus, Eye,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Admission, Meta } from '../lib/types';
import { ADMISSION_STATUS, labelOf, toneOf } from '../lib/labels';
import { colorFor, formatDate, relativeTime, toDateInput } from '../lib/format';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Pagination,
  SearchInput, Select, StatCard, TableSkeleton, Tabs, Textarea,
} from '../components/ui';
import { ConfirmDialog, Drawer, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

const PAGE_SIZE = 10;
const TABS = ['tous', 'en_attente', 'en_revue', 'acceptee', 'refusee', 'inscrite'] as const;
type Tab = typeof TABS[number];

type FormState = {
  studentName: string; birthDate: string; gender: 'F' | 'M'; level: string;
  guardianName: string; guardianPhone: string; guardianEmail: string;
  previousSchool: string; status: string; source: string; notes: string;
};

const emptyForm: FormState = {
  studentName: '', birthDate: '', gender: 'F', level: '6ème', guardianName: '',
  guardianPhone: '', guardianEmail: '', previousSchool: '', status: 'en_attente', source: 'Site web', notes: '',
};

export function Admissions() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('tous');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Admission | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Admission | null>(null);
  const [toEnroll, setToEnroll] = useState<Admission | null>(null);
  const [enrollClass, setEnrollClass] = useState('');
  const [detail, setDetail] = useState<Admission | null>(null);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admissions', { search }],
    queryFn: () => get<{ items: Admission[]; stats: Record<string, number> }>(`/admissions${qs({ search })}`),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { tous: items.length };
    items.forEach((item) => { result[item.status] = (result[item.status] ?? 0) + 1; });
    return result;
  }, [items]);

  const filtered = useMemo(() => tab === 'tous' ? items : items.filter((item) => item.status === tab), [items, tab]);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [tab, search]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate();
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(admission: Admission) {
    setEditing(admission);
    setForm({
      studentName: admission.studentName,
      birthDate: toDateInput(admission.birthDate),
      gender: admission.gender,
      level: admission.level,
      guardianName: admission.guardianName,
      guardianPhone: admission.guardianPhone ?? '',
      guardianEmail: admission.guardianEmail ?? '',
      previousSchool: admission.previousSchool ?? '',
      status: admission.status,
      source: admission.source ?? 'Site web',
      notes: admission.notes ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/admissions/${editing.id}`, payload) : post('/admissions', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Dossier mis à jour' : 'Demande enregistrée', `${form.studentName} · ${form.level}`);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/admissions/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admissions'] });
      const snapshot = queryClient.getQueriesData<{ items: Admission[] }>({ queryKey: ['admissions'] });
      queryClient.setQueriesData<{ items: Admission[] }>({ queryKey: ['admissions'] }, (old) => old ? {
        ...old,
        items: old.items.map((item) => item.id === id ? { ...item, status: status as Admission['status'], decisionAt: new Date().toISOString() } : item),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _vars, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Mise à jour impossible', error.message);
    },
    onSuccess: (_data, vars) => {
      toast.success('Statut mis à jour', `Le dossier est désormais « ${labelOf(ADMISSION_STATUS, vars.status)} ».`);
      setDetail(null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admissions'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/admissions/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['admissions'] });
      const snapshot = queryClient.getQueriesData<{ items: Admission[] }>({ queryKey: ['admissions'] });
      queryClient.setQueriesData<{ items: Admission[] }>({ queryKey: ['admissions'] }, (old) => old ? {
        ...old, items: old.items.filter((item) => item.id !== id),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _id, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Suppression impossible', error.message);
    },
    onSuccess: () => toast.success('Dossier supprimé'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      setToDelete(null);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: ({ id, classId }: { id: string; classId: string }) => post<{ student: { id: string; firstName: string; lastName: string } }>(`/admissions/${id}/enroll`, { classId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Élève inscrit', `${result.student.firstName} ${result.student.lastName} dispose désormais d'une fiche et d'une échéance d'inscription.`);
      setToEnroll(null);
      setEnrollClass('');
    },
    onError: (error: ApiError) => toast.error('Conversion impossible', error.message),
  });

  function submit() {
    if (!form.studentName.trim() || !form.guardianName.trim()) {
      setFormError("Le nom de l'élève et du tuteur sont obligatoires.");
      return;
    }
    saveMutation.mutate(form);
  }

  function quickStatus(admission: Admission, status: 'acceptee' | 'refusee') {
    statusMutation.mutate({ id: admission.id, status });
  }

  const selectedClass = meta.data?.classes.find((cls) => cls.id === enrollClass);

  return (
    <>
      <PageHeader
        title="Inscriptions"
        subtitle="Suivez les demandes d'admission et convertissez les dossiers acceptés."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>Nouvelle demande</Button>}
      />

      <div className="grid grid-4">
        <StatCard label="Demandes reçues" value={counts.tous ?? 0} icon={ClipboardList} loading={isLoading} foot={<span>Toutes périodes</span>} />
        <StatCard label="En cours d'examen" value={(counts.en_attente ?? 0) + (counts.en_revue ?? 0)} icon={Clock} tone="amber" loading={isLoading} foot={<span>À traiter par le secrétariat</span>} />
        <StatCard label="Acceptées" value={counts.acceptee ?? 0} icon={CheckCircle2} tone="info" loading={isLoading} foot={<span>En attente d'inscription</span>} />
        <StatCard label="Élèves inscrits" value={counts.inscrite ?? 0} icon={UserPlus} tone="violet" loading={isLoading} foot={<span>Convertis en fiches élèves</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as Tab)}
            options={TABS.map((key) => ({
              value: key,
              label: key === 'tous' ? 'Tous' : labelOf(ADMISSION_STATUS, key),
              count: counts[key] ?? 0,
            }))}
          />
          <div style={{ marginLeft: 'auto' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Candidat, référence ou tuteur…" />
          </div>
        </div>

        {isLoading && <TableSkeleton rows={6} cols={6} />}

        {isError && <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />}

        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState
            icon={tab === 'tous' ? ClipboardList : SearchX}
            title={tab === 'tous' ? 'Aucune demande' : 'Aucun dossier dans cette étape'}
            description={tab === 'tous' ? 'Les demandes d’inscription déposées apparaîtront ici.' : 'Changez d’onglet ou créez une nouvelle demande.'}
            action={tab === 'tous' ? <Button variant="primary" icon={Plus} onClick={openCreate}>Créer une demande</Button> : undefined}
          />
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Candidat</th>
                    <th>Niveau</th>
                    <th className="hide-sm">Tuteur</th>
                    <th className="hide-sm">Déposé</th>
                    <th>Statut</th>
                    <th>Décision</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((admission) => (
                    <tr key={admission.id}>
                      <td onClick={() => setDetail(admission)} style={{ cursor: 'pointer' }}>
                        <div className="row-avatar">
                          <Avatar name={admission.studentName} color={colorFor(admission.id)} />
                          <div>
                            <div className="cell-main">{admission.studentName}</div>
                            <div className="cell-sub">{admission.reference} · {admission.source}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone="primary">{admission.level}</Badge></td>
                      <td className="hide-sm">
                        <div className="small">{admission.guardianName}</div>
                        <div className="cell-sub">{admission.guardianPhone ?? '—'}</div>
                      </td>
                      <td className="hide-sm">
                        <div className="small">{formatDate(admission.submittedAt)}</div>
                        <div className="cell-sub">{relativeTime(admission.submittedAt)}</div>
                      </td>
                      <td>
                        <Badge tone={toneOf(ADMISSION_STATUS, admission.status)} dot>{labelOf(ADMISSION_STATUS, admission.status)}</Badge>
                      </td>
                      <td>
                        <div className="row gap-4">
                          {['en_attente', 'en_revue'].includes(admission.status) && (
                            <>
                              <IconButton icon={CheckCircle2} label="Accepter" onClick={() => quickStatus(admission, 'acceptee')} />
                              <IconButton icon={XCircle} label="Refuser" tone="danger" onClick={() => quickStatus(admission, 'refusee')} />
                            </>
                          )}
                          {admission.status === 'acceptee' && (
                            <Button size="sm" variant="soft" icon={ArrowRightLeft} onClick={() => { setToEnroll(admission); setEnrollClass(''); }}>
                              Inscrire
                            </Button>
                          )}
                          {admission.status === 'inscrite' && (
                            <Badge tone="violet"><CheckCircle2 size={11} /> Converti</Badge>
                          )}
                          <IconButton icon={Eye} label="Voir le dossier" onClick={() => setDetail(admission)} />
                          <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(admission)} />
                          <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(admission)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le dossier' : 'Nouvelle demande d’inscription'}
        description="Chaque dossier reçoit une référence unique."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Enregistrer la demande'}
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
          <Field label="Nom complet de l'élève" htmlFor="aName">
            <Input id="aName" value={form.studentName} onChange={(event) => setForm({ ...form, studentName: event.target.value })} placeholder="Prince Okemba" />
          </Field>
          <Field label="Niveau souhaité" htmlFor="aLevel">
            <Select id="aLevel" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
              {(meta.data?.levels ?? []).map((level) => <option key={level} value={level}>{level}</option>)}
            </Select>
          </Field>
          <Field label="Date de naissance" htmlFor="aBirth">
            <Input id="aBirth" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
          </Field>
          <Field label="Sexe" htmlFor="aGender">
            <Select id="aGender" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as 'F' | 'M' })}>
              <option value="F">Fille</option>
              <option value="M">Garçon</option>
            </Select>
          </Field>
          <Field label="Nom du parent / tuteur" htmlFor="aGuardian">
            <Input id="aGuardian" value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} />
          </Field>
          <Field label="Téléphone" htmlFor="aPhone">
            <Input id="aPhone" value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} placeholder="+242 06 000 00 00" />
          </Field>
          <Field label="E-mail" htmlFor="aEmail">
            <Input id="aEmail" type="email" value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} />
          </Field>
          <Field label="École précédente" htmlFor="aSchool">
            <Input id="aSchool" value={form.previousSchool} onChange={(event) => setForm({ ...form, previousSchool: event.target.value })} />
          </Field>
          <Field label="Source" htmlFor="aSource">
            <Select id="aSource" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
              {(meta.data?.admissionSources ?? []).map((source) => <option key={source} value={source}>{source}</option>)}
            </Select>
          </Field>
          <Field label="Statut du dossier" htmlFor="aStatus">
            <Select id="aStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {Object.entries(ADMISSION_STATUS).filter(([key]) => key !== 'refuse').map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Observations" htmlFor="aNotes" className="span-2">
            <Textarea id="aNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Pièces manquantes, entretien à planifier…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(toEnroll)}
        onClose={() => { setToEnroll(null); setEnrollClass(''); }}
        title="Convertir en élève inscrit"
        description={toEnroll ? `${toEnroll.studentName} · niveau ${toEnroll.level}` : ''}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setToEnroll(null)}>Annuler</Button>
            <Button
              variant="primary"
              icon={UserPlus}
              disabled={!enrollClass}
              loading={enrollMutation.isPending}
              onClick={() => toEnroll && enrollMutation.mutate({ id: toEnroll.id, classId: enrollClass })}
            >
              Inscrire l'élève
            </Button>
          </>
        )}
      >
        <Field label="Classe d'affectation" hint="Le matricule et les frais d'inscription seront générés automatiquement.">
          <Select value={enrollClass} onChange={(event) => setEnrollClass(event.target.value)}>
            <option value="">Choisir une classe…</option>
            {(meta.data?.classes ?? []).map((cls) => (
              <option key={cls.id} value={cls.id} disabled={cls.studentCount >= cls.capacity}>
                {cls.name} — {cls.studentCount}/{cls.capacity} places
              </option>
            ))}
          </Select>
        </Field>
        {selectedClass && (
          <div className="mt-16" style={{ background: 'var(--primary-softer)', border: '1px solid #cfe8e2', borderRadius: 10, padding: 12 }}>
            <div className="row gap-8 small">
              <School size={14} style={{ color: 'var(--primary)' }} />
              <strong>{selectedClass.name}</strong>
              <span className="muted">· {selectedClass.capacity - selectedClass.studentCount} place(s) restante(s)</span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer le dossier"
        description={toDelete ? `La demande ${toDelete.reference} (${toDelete.studentName}) sera définitivement supprimée.` : ''}
        confirmLabel="Supprimer"
      />

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} label="Dossier d'inscription">
        {detail && (
          <>
            <div className="drawer-head">
              <Avatar name={detail.studentName} color={colorFor(detail.id)} size="lg" />
              <div className="grow">
                <div className="row gap-8 wrap">
                  <h2 style={{ fontSize: 17 }}>{detail.studentName}</h2>
                  <Badge tone={toneOf(ADMISSION_STATUS, detail.status)} dot>{labelOf(ADMISSION_STATUS, detail.status)}</Badge>
                </div>
                <div className="small muted mt-4">{detail.reference} · déposé {relativeTime(detail.submittedAt)}</div>
              </div>
              <button className="icon-btn" onClick={() => setDetail(null)} aria-label="Fermer"><span style={{ fontSize: 18 }}>×</span></button>
            </div>
            <div className="drawer-body">
              <Card className="card-pad">
                <div className="label" style={{ marginBottom: 10 }}>Candidat</div>
                <div className="stack gap-10 small">
                  <div className="row"><span className="muted" style={{ width: 110 }}>Niveau</span><strong>{detail.level}</strong></div>
                  <div className="row"><span className="muted" style={{ width: 110 }}>Naissance</span><span>{formatDate(detail.birthDate)}</span></div>
                  <div className="row"><span className="muted" style={{ width: 110 }}>Sexe</span><span>{detail.gender === 'F' ? 'Fille' : 'Garçon'}</span></div>
                  <div className="row"><span className="muted" style={{ width: 110 }}>École précédente</span><span>{detail.previousSchool ?? '—'}</span></div>
                  <div className="row"><span className="muted" style={{ width: 110 }}>Source</span><span>{detail.source ?? '—'}</span></div>
                </div>
              </Card>
              <Card className="card-pad">
                <div className="label" style={{ marginBottom: 10 }}>Parent / tuteur</div>
                <div className="stack gap-10 small">
                  <div className="row gap-8"><strong>{detail.guardianName}</strong></div>
                  <div className="row gap-8"><Phone size={13} style={{ color: 'var(--ink-300)' }} /> {detail.guardianPhone ?? '—'}</div>
                  <div className="row gap-8"><Mail size={13} style={{ color: 'var(--ink-300)' }} /> {detail.guardianEmail ?? '—'}</div>
                </div>
              </Card>
              {detail.notes && (
                <Card className="card-pad">
                  <div className="label" style={{ marginBottom: 6 }}>Observations</div>
                  <p className="small muted">{detail.notes}</p>
                </Card>
              )}
              <div className="stack gap-8">
                {['en_attente', 'en_revue'].includes(detail.status) && (
                  <div className="row gap-8">
                    <Button variant="primary" icon={CheckCircle2} className="grow" onClick={() => statusMutation.mutate({ id: detail.id, status: 'acceptee' })}>
                      Accepter le dossier
                    </Button>
                    <Button variant="soft-danger" icon={XCircle} onClick={() => statusMutation.mutate({ id: detail.id, status: 'refusee' })}>
                      Refuser
                    </Button>
                  </div>
                )}
                {detail.status === 'acceptee' && (
                  <Button variant="primary" icon={UserPlus} block onClick={() => { setToEnroll(detail); setDetail(null); setEnrollClass(''); }}>
                    Convertir en inscription
                  </Button>
                )}
                <Button icon={Pencil} block onClick={() => { setDetail(null); openEdit(detail); }}>Modifier le dossier</Button>
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
