import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Users, UserPlus, Wallet, GraduationCap, Phone, Mail, MapPin,
  CalendarDays, FileText, ArrowRight, SearchX, Eye, Award, AlertTriangle, Download,
  CreditCard, Printer,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { ListResponse, Meta, SchoolCard, Student, StudentDetail } from '../lib/types';
import { useAuth } from '../lib/auth';
import { PAYMENT_STATUS, STUDENT_STATUS, appreciationOf, labelOf, toneOf } from '../lib/labels';
import { ageFrom, colorFor, formatAverage, formatDate, formatMoney, relativeTime, toDateInput } from '../lib/format';
import { datedFilename, downloadCsv } from '../lib/csv';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Pagination,
  ProgressBar, ScorePill, SearchInput, Select, StatCard, TableSkeleton, Tabs, Textarea,
} from '../components/ui';
import { Drawer, Modal, ConfirmDialog } from '../components/overlays';
import { useToast } from '../components/toast';
import { StudentIdCard } from '../components/student-card';

const PAGE_SIZE = 12;

type FormState = {
  firstName: string; lastName: string; gender: 'F' | 'M'; birthDate: string; classId: string;
  guardianName: string; guardianPhone: string; guardianEmail: string; address: string;
  status: string; notes: string; studentType: 'eleve' | 'etudiant'; programId: string; academicLevel: string;
};

const emptyForm: FormState = {
  firstName: '', lastName: '', gender: 'F', birthDate: '', classId: '',
  guardianName: '', guardianPhone: '', guardianEmail: '', address: '', status: 'actif', notes: '',
  studentType: 'eleve', programId: '', academicLevel: '',
};

export function Students() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const isParent = user?.role === 'parent';

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Student | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cardPreview, setCardPreview] = useState<SchoolCard | null>(null);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const queryKey = ['students', { search, classFilter, statusFilter, typeFilter }] as const;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => get<ListResponse<Student> & { stats: Record<string, number>; term: string }>(
      `/students${qs({ search, classId: classFilter, status: statusFilter, type: typeFilter })}`,
    ),
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => items, [items]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, classFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isAdmin) {
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

  function openEdit(student: Student) {
    setEditing(student);
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      birthDate: toDateInput(student.birthDate),
      classId: student.classId ?? '',
      guardianName: student.guardianName ?? '',
      guardianPhone: student.guardianPhone ?? '',
      guardianEmail: student.guardianEmail ?? '',
      address: student.address ?? '',
      status: student.status,
      notes: student.notes ?? '',
      studentType: student.studentType === 'etudiant' ? 'etudiant' : 'eleve',
      programId: student.programId ?? '',
      academicLevel: student.academicLevel ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function openCard(studentId: string) {
    try {
      const { card } = await get<{ card: SchoolCard }>(`/cards/${studentId}`);
      setCardPreview(card);
    } catch (error) {
      toast.error('Carte indisponible', error instanceof ApiError ? error.message : 'Réessayez.');
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch<{ student: Student }>(`/students/${editing.id}`, payload) : post<{ student: Student }>('/students', payload)
    ),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setFormOpen(false);
      if (editing) {
        toast.success('Fiche mise à jour', `${form.firstName} ${form.lastName} a été modifié.`);
        return;
      }
      toast.success('Élève inscrit', `${form.firstName} ${form.lastName} rejoint la scolarité.`);
      // La carte scolaire est émise automatiquement : on l'affiche tout de suite.
      try {
        const { card } = await get<{ card: SchoolCard }>(`/cards/${result.student.id}`);
        setCardPreview(card);
      } catch {
        /* la carte reste consultable depuis la page Cartes scolaires */
      }
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/students/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['students'] });
      const snapshot = queryClient.getQueriesData<ListResponse<Student>>({ queryKey: ['students'] });
      queryClient.setQueriesData<ListResponse<Student>>({ queryKey: ['students'] }, (old) => old ? {
        ...old,
        items: old.items.filter((student) => student.id !== id),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _id, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Suppression impossible', error.message);
    },
    onSuccess: () => toast.success('Fiche supprimée', 'L’élève et son historique ont été retirés.'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setToDelete(null);
    },
  });

  const stats = data?.stats ?? {};
  const hasFilters = Boolean(search || classFilter || statusFilter || typeFilter);
  const scored = items.filter((student) => student.average !== null && student.average !== undefined);
  const classAverage = scored.length
    ? scored.reduce((sum, student) => sum + (student.average ?? 0), 0) / scored.length
    : null;

  function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Le prénom et le nom sont obligatoires.');
      return;
    }
    setFormError(null);
    saveMutation.mutate({
      ...form,
      birthDate: form.birthDate || '',
      classId: form.studentType === 'etudiant' ? '' : form.classId || '',
      programId: form.studentType === 'etudiant' ? form.programId || '' : '',
      academicLevel: form.studentType === 'etudiant' ? form.academicLevel || '' : '',
    });
  }

  function exportCsv() {
    const count = downloadCsv(datedFilename('eleves'), filtered, [
      { header: 'Matricule', value: (s) => s.matricule },
      { header: 'Nom', value: (s) => s.lastName },
      { header: 'Prénom', value: (s) => s.firstName },
      { header: 'Sexe', value: (s) => s.gender },
      { header: 'Naissance', value: (s) => s.birthDate ?? '' },
      { header: 'Profil', value: (s) => (s.studentType === 'etudiant' ? 'Étudiant' : 'Élève') },
      { header: 'Classe / Filière', value: (s) => s.className ?? s.programName ?? '' },
      { header: 'Niveau', value: (s) => s.level ?? s.academicLevel ?? '' },
      { header: 'Statut', value: (s) => labelOf(STUDENT_STATUS, s.status) },
      { header: 'Tuteur', value: (s) => s.guardianName ?? '' },
      { header: 'Téléphone tuteur', value: (s) => s.guardianPhone ?? '' },
      { header: 'E-mail tuteur', value: (s) => s.guardianEmail ?? '' },
      { header: 'Payé (FCFA)', value: (s) => s.paidTotal ?? 0 },
      { header: 'Moyenne /20', value: (s) => (s.average === null || s.average === undefined ? '' : s.average) },
    ]);
    toast.success('Export CSV prêt', `${count} dossier(s) exporté(s).`);
  }

  return (
    <>
      <PageHeader
        title={isParent ? 'Mes enfants' : 'Élèves'}
        subtitle={isParent ? 'Suivez la scolarité de vos enfants.' : 'Dossiers, affectations et situation financière des élèves.'}
        actions={isParent ? undefined : (
          <>
            <Button icon={Download} onClick={exportCsv} disabled={!filtered.length}>Exporter</Button>
            {isAdmin && <Button icon={Users} onClick={() => setSearch('')}>Tout afficher</Button>}
            {isAdmin && <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvel élève</Button>}
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard label={isParent ? 'Enfants inscrits' : 'Élèves au total'} value={stats.total ?? 0} icon={Users} loading={isLoading} foot={<span>{stats.actifs ?? 0} actifs</span>} />
        <StatCard label="Nouvelles inscriptions" value={stats.nouveaux ?? 0} icon={UserPlus} tone="violet" loading={isLoading} foot={<span>30 derniers jours</span>} />
        <StatCard label="Solde à recouvrer" value={formatMoney(stats.soldeDu, true)} icon={Wallet} tone="amber" loading={isLoading} foot={<span>Frais annuels restants</span>} />
        <StatCard label="Moyenne générale" value={`${formatAverage(classAverage)}/20`} icon={Award} tone="info" loading={isLoading} foot={<span>{data?.term ?? 'Période en cours'}</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Nom, matricule ou tuteur…" />
          <div className="filter-bar" style={{ marginLeft: 'auto' }}>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrer par profil">
              <option value="">Élèves & étudiants</option>
              <option value="eleve">Élèves (école)</option>
              <option value="etudiant">Étudiants (université)</option>
            </Select>
            <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filtrer par classe">
              <option value="">Toutes les classes</option>
              {(meta.data?.classes ?? []).map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {Object.entries(STUDENT_STATUS).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {isLoading && <TableSkeleton rows={7} cols={6} />}

        {isError && (
          <EmptyState
            icon={AlertTriangle}
            title="Chargement impossible"
            description="Une erreur est survenue lors de la récupération des élèves."
            action={<Button variant="primary" onClick={() => refetch()}>Réessayer</Button>}
          />
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState
            icon={hasFilters ? SearchX : Users}
            title={hasFilters ? 'Aucun élève ne correspond' : isParent ? 'Aucun enfant rattaché' : 'Aucun élève inscrit'}
            description={hasFilters ? 'Essayez un autre nom, une autre classe ou réinitialisez les filtres.' : isParent ? 'Contactez le secrétariat pour associer votre compte à une fiche élève.' : 'Commencez par inscrire un premier élève pour alimenter la scolarité.'}
            action={hasFilters ? (
              <Button onClick={() => { setSearch(''); setClassFilter(''); setStatusFilter(''); setTypeFilter(''); }}>Réinitialiser les filtres</Button>
            ) : isAdmin ? (
              <Button variant="primary" icon={Plus} onClick={openCreate}>Inscrire un élève</Button>
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
                    <th>Classe</th>
                    <th className="hide-sm">Tuteur</th>
                    <th>Moyenne</th>
                    <th className="hide-sm">Scolarité</th>
                    <th>Statut</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((student) => {
                    const annualFee = (student.tuitionFee ?? 0) + 25000;
                    const progress = annualFee ? Math.min(100, Math.round((student.paidTotal / annualFee) * 100)) : 0;
                    const status = STUDENT_STATUS[student.status];
                    return (
                      <tr key={student.id} onClick={() => setDetailId(student.id)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="row-avatar">
                            <Avatar name={`${student.firstName} ${student.lastName}`} color={colorFor(student.id)} />
                            <div>
                              <div className="cell-main">{student.firstName} {student.lastName}</div>
                              <div className="cell-sub">{student.matricule} · {student.gender === 'F' ? 'Fille' : 'Garçon'}{ageFrom(student.birthDate) !== null ? ` · ${ageFrom(student.birthDate)} ans` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {student.studentType === 'etudiant' ? (
                            <>
                              <div className="cell-main" style={{ fontWeight: 500 }}>{student.programName ?? 'Filière non définie'}</div>
                              <div className="cell-sub">{student.academicLevel ?? 'Niveau ?'} · Université</div>
                            </>
                          ) : (
                            <>
                              <div className="cell-main" style={{ fontWeight: 500 }}>{student.className ?? 'Non affecté'}</div>
                              <div className="cell-sub">{student.level ?? '—'}</div>
                            </>
                          )}
                        </td>
                        <td className="hide-sm">
                          <div style={{ fontSize: 13 }}>{student.guardianName ?? '—'}</div>
                          <div className="cell-sub">{student.guardianPhone ?? ''}</div>
                        </td>
                        <td>
                          <ScorePill value={student.average ?? null} />
                        </td>
                        <td className="hide-sm" style={{ minWidth: 130 }}>
                          <ProgressBar value={progress} tone={progress >= 66 ? 'primary' : progress >= 33 ? 'amber' : 'danger'} />
                          <div className="cell-sub mt-4">{progress}% · {formatMoney(student.paidTotal, true)}</div>
                        </td>
                        <td>
                          <Badge tone={toneOf(STUDENT_STATUS, status ? student.status : undefined)} dot>{labelOf(STUDENT_STATUS, student.status)}</Badge>
                        </td>
                        <td>
                          <div className="actions" onClick={(event) => event.stopPropagation()}>
                            <IconButton icon={Eye} label="Voir la fiche" onClick={() => setDetailId(student.id)} />
                            <IconButton icon={CreditCard} label="Carte scolaire" onClick={() => openCard(student.id)} />
                            {isAdmin && <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(student)} />}
                            {isAdmin && <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(student)} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
        title={editing ? 'Modifier la fiche élève' : 'Inscrire un nouvel élève'}
        description={editing ? 'Les informations sont mises à jour immédiatement.' : 'Le matricule est généré automatiquement.'}
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : "Inscrire l'élève"}
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
          <Field label="Prénom" htmlFor="firstName">
            <Input id="firstName" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="Aya" />
          </Field>
          <Field label="Nom" htmlFor="lastName">
            <Input id="lastName" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Mbemba" />
          </Field>
          <Field label="Sexe" htmlFor="gender">
            <Select id="gender" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as 'F' | 'M' })}>
              <option value="F">Fille</option>
              <option value="M">Garçon</option>
            </Select>
          </Field>
          <Field label="Date de naissance" htmlFor="birthDate">
            <Input id="birthDate" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
          </Field>
          <Field label="Profil" htmlFor="studentType" hint="École (classe) ou université (filière).">
            <Select
              id="studentType"
              value={form.studentType}
              onChange={(event) => setForm({ ...form, studentType: event.target.value as 'eleve' | 'etudiant' })}
            >
              <option value="eleve">Élève — école</option>
              <option value="etudiant">Étudiant — université</option>
            </Select>
          </Field>
          {form.studentType === 'eleve' ? (
            <Field label="Classe" htmlFor="classId" hint="La classe détermine les frais annuels.">
              <Select id="classId" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}>
                <option value="">Non affecté</option>
                {(meta.data?.classes ?? []).map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name} · {cls.studentCount}/{cls.capacity}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Filière" htmlFor="programId" hint="Les frais suivent la filière.">
                <Select id="programId" value={form.programId} onChange={(event) => setForm({ ...form, programId: event.target.value })}>
                  <option value="">Non affecté</option>
                  {(meta.data?.programs ?? []).map((program) => (
                    <option key={program.id} value={program.id}>{program.code} — {program.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Niveau" htmlFor="academicLevel">
                <Select id="academicLevel" value={form.academicLevel} onChange={(event) => setForm({ ...form, academicLevel: event.target.value })}>
                  <option value="">Non défini</option>
                  {(meta.data?.academicLevels ?? ['L1', 'L2', 'L3', 'M1', 'M2']).map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Statut" htmlFor="status">
            <Select id="status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {Object.entries(STUDENT_STATUS).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nom du tuteur" htmlFor="guardianName">
            <Input id="guardianName" value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} placeholder="Nadège Ondongo" />
          </Field>
          <Field label="Téléphone du tuteur" htmlFor="guardianPhone">
            <Input id="guardianPhone" value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} placeholder="+242 06 000 00 00" />
          </Field>
          <Field label="E-mail du tuteur" htmlFor="guardianEmail">
            <Input id="guardianEmail" type="email" value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} placeholder="parent@exemple.cg" />
          </Field>
          <Field label="Adresse" htmlFor="address">
            <Input id="address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Bacongo, Brazzaville" />
          </Field>
          <Field label="Notes internes" htmlFor="notes" className="span-2">
            <Textarea id="notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Informations utiles (suivi médical, situation familiale…)" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer la fiche élève"
        description={toDelete ? `${toDelete.firstName} ${toDelete.lastName} et son historique seront définitivement supprimés.` : ''}
        confirmLabel="Supprimer définitivement"
      />

      <StudentDrawer
        studentId={detailId}
        onClose={() => setDetailId(null)}
        canManage={isAdmin}
        onEdit={(student) => { setDetailId(null); openEdit(student); }}
        onDelete={(student) => { setDetailId(null); setToDelete(student); }}
        onCard={(id) => { setDetailId(null); openCard(id); }}
      />

      <Modal
        open={Boolean(cardPreview)}
        onClose={() => setCardPreview(null)}
        title="Carte scolaire créée"
        description={cardPreview ? `${cardPreview.firstName} ${cardPreview.lastName} · ${cardPreview.matricule}` : undefined}
        wide
        footer={(
          <>
            <Link to="/app/cartes" className="btn btn-ghost">Gérer les cartes</Link>
            <Button variant="secondary" icon={Printer} onClick={() => {
              document.body.classList.add('printing-card');
              window.setTimeout(() => {
                window.print();
                window.setTimeout(() => document.body.classList.remove('printing-card'), 400);
              }, 60);
            }}>Imprimer</Button>
            <Button variant="primary" onClick={() => setCardPreview(null)}>Terminé</Button>
          </>
        )}
      >
        {cardPreview && (
          <div className="stack gap-14">
            <StudentIdCard card={cardPreview} />
            <div className="tiny muted">
              QR code, code-barres Code 128{cardPreview.nfcTag ? ` et badge NFC ${cardPreview.nfcTag}` : ' et badge NFC'} :
              la même carte sert à signer les présences depuis la page Présences ou Cartes scolaires.
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                StudentDrawer                               */
/* -------------------------------------------------------------------------- */

function StudentDrawer({
  studentId, onClose, canManage, onEdit, onDelete, onCard,
}: {
  studentId: string | null; onClose: () => void; canManage: boolean;
  onEdit: (student: Student) => void; onDelete: (student: Student) => void;
  onCard: (studentId: string) => void;
}) {
  const [tab, setTab] = useState<'apercu' | 'paiements' | 'resultats'>('apercu');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => get<StudentDetail>(`/students/${studentId}`),
    enabled: Boolean(studentId),
  });

  useEffect(() => { setTab('apercu'); }, [studentId]);

  const student = data?.student;
  const annualFee = student?.annualFee ?? 0;
  const progress = annualFee ? Math.min(100, Math.round((student?.paidTotal ?? 0) / annualFee * 100)) : 0;

  return (
    <Drawer open={Boolean(studentId)} onClose={onClose} label="Fiche élève">
      {isLoading || !student ? (
        <>
          <div className="drawer-head">
            <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }} />
            <div className="grow stack gap-8">
              <div className="skeleton" style={{ height: 16, width: '55%' }} />
              <div className="skeleton" style={{ height: 11, width: '40%' }} />
            </div>
          </div>
          <div className="drawer-body">
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 180 }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </>
      ) : (
        <>
          <div className="drawer-head">
            <Avatar name={`${student.firstName} ${student.lastName}`} color={colorFor(student.id)} size="lg" />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-8 wrap">
                <h2 style={{ fontSize: 17 }}>{student.firstName} {student.lastName}</h2>
                <Badge tone={toneOf(STUDENT_STATUS, student.status)} dot>{labelOf(STUDENT_STATUS, student.status)}</Badge>
              </div>
              <div className="small muted mt-4">
                {student.matricule} · {student.className ?? 'Non affecté'} · {student.gender === 'F' ? 'Fille' : 'Garçon'}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">
              <span style={{ fontSize: 18 }}>×</span>
            </button>
          </div>

          <div className="drawer-body">
            <div className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
              <Tabs
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'apercu', label: 'Aperçu' },
                  { value: 'paiements', label: 'Paiements', count: data?.payments.length },
                  { value: 'resultats', label: 'Résultats' },
                ]}
              />
              <Button size="sm" variant="secondary" icon={CreditCard} onClick={() => onCard(studentId!)}>
                Carte scolaire
              </Button>
            </div>

            {tab === 'apercu' && (
              <>
                <Card className="card-pad">
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className="label">Scolarité annuelle</span>
                    <span className="small strong">{progress}% réglé</span>
                  </div>
                  <ProgressBar value={progress} tone={progress >= 66 ? 'primary' : progress >= 33 ? 'amber' : 'danger'} />
                  <div className="row mt-8" style={{ justifyContent: 'space-between' }}>
                    <span className="tiny muted">{formatMoney(student.paidTotal)} réglés</span>
                    <span className="tiny muted">Total : {formatMoney(annualFee)}</span>
                  </div>
                  {student.outstanding > 0 && (
                    <div className="mt-8" style={{ background: 'var(--amber-soft)', color: '#96590a', padding: '8px 10px', borderRadius: 8, fontSize: 12 }}>
                      Reste à régler : <strong>{formatMoney(student.outstanding)}</strong>
                    </div>
                  )}
                </Card>

                <Card className="card-pad">
                  <div className="label" style={{ marginBottom: 12 }}>Informations</div>
                  <div className="stack gap-12">
                    <InfoRow icon={CalendarDays} label="Naissance" value={student.birthDate ? `${formatDate(student.birthDate)} (${ageFrom(student.birthDate)} ans)` : '—'} />
                    {student.programName ? (
                      <InfoRow icon={GraduationCap} label="Filière" value={`${student.programName}${student.academicLevel ? ` · ${student.academicLevel}` : ''}${student.facultyName ? ` · ${student.facultyName}` : ''}`} />
                    ) : (
                      <InfoRow icon={GraduationCap} label="Classe" value={`${student.className ?? 'Non affecté'}${student.mainTeacher ? ` · ${student.mainTeacher}` : ''}`} />
                    )}
                    <InfoRow icon={Users} label="Tuteur" value={student.guardianName ?? '—'} />
                    <InfoRow icon={Phone} label="Téléphone" value={student.guardianPhone ?? '—'} />
                    <InfoRow icon={Mail} label="E-mail" value={student.guardianEmail ?? '—'} />
                    <InfoRow icon={MapPin} label="Adresse" value={student.address ?? '—'} />
                    <InfoRow icon={CalendarDays} label="Inscrit le" value={formatDate(student.enrolledAt)} />
                    {student.notes && <InfoRow icon={FileText} label="Notes" value={student.notes} />}
                  </div>
                </Card>

                <div className="stack gap-8">
                  {canManage && (
                    <Button
                      variant="primary"
                      icon={Wallet}
                      block
                      onClick={() => navigate(`/app/paiements?new=1&studentId=${student.id}`)}
                    >
                      Encaisser un paiement
                    </Button>
                  )}
                  <div className="row gap-8">
                    {canManage && (
                      <Button icon={Pencil} onClick={() => onEdit(student)} className="grow">Modifier la fiche</Button>
                    )}
                    {canManage && (
                      <Button variant="soft-danger" icon={Trash2} onClick={() => onDelete(student)}>Supprimer</Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {tab === 'paiements' && (
              <Card>
                <div className="card-head">
                  <h3>Historique des paiements</h3>
                  <Badge tone="neutral">{data?.payments.length ?? 0}</Badge>
                </div>
                {data?.payments.length ? (
                  <div className="card-body stack gap-0">
                    {data.payments.map((payment) => (
                      <div key={payment.id} className="list-row">
                        <span className="stat-icon amber" style={{ width: 32, height: 32, borderRadius: 9 }}>
                          <Wallet size={15} />
                        </span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="strong" style={{ fontSize: 13 }}>{payment.type} · {payment.term ?? '—'}</div>
                          <div className="tiny muted">{payment.reference} · {payment.method} · {formatDate(payment.paidAt ?? payment.dueDate)}</div>
                        </div>
                        <div className="right">
                          <div className="strong nowrap" style={{ fontSize: 13 }}>{formatMoney(payment.amount)}</div>
                          <Badge tone={PAYMENT_STATUS[payment.status]?.tone}>{PAYMENT_STATUS[payment.status]?.label}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Wallet} title="Aucun paiement" description="Les encaissements apparaîtront ici." />
                )}
              </Card>
            )}

            {tab === 'resultats' && (
              <>
                {(data?.averages ?? []).length ? (
                  data!.averages.map((term) => (
                    <Card key={term.term} className="card-pad">
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div className="label">{term.term}</div>
                          <div className="tiny muted">{term.subjects.length} matières évaluées</div>
                        </div>
                        <div className="row gap-8">
                          <ScorePill value={term.average} />
                          <Badge tone={appreciationOf(term.average).tone}>{appreciationOf(term.average).label}</Badge>
                        </div>
                      </div>
                      <div className="stack gap-10 mt-8">
                        {term.subjects.map((subject) => (
                          <div key={subject.subject} className="row gap-10">
                            <span className="small grow">{subject.subject}</span>
                            <div className="progress" style={{ width: 90 }}>
                              <span style={{ width: `${Math.min(100, (subject.average / 20) * 100)}%`, background: subject.average >= 10 ? 'var(--primary)' : 'var(--danger)' }} />
                            </div>
                            <span className="small strong" style={{ width: 42, textAlign: 'right' }}>{formatAverage(subject.average)}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <EmptyState icon={Award} title="Aucune note" description="Les résultats du trimestre s'afficheront dès la première évaluation." />
                  </Card>
                )}
                <div className="tiny muted">
                  Les moyennes sont pondérées par les coefficients de chaque matière.
                </div>
              </>
            )}

            {tab === 'apercu' && (
              <div className="tiny muted row gap-6">
                Fiche mise à jour {relativeTime(student.enrolledAt)} <ArrowRight size={12} />
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
      <Icon size={14} style={{ color: 'var(--ink-300)', marginTop: 3, flex: 'none' }} />
      <span className="small muted" style={{ width: 90, flex: 'none' }}>{label}</span>
      <span className="small grow" style={{ overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}
