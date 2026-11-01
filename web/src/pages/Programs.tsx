import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Layers, Users, GraduationCap, BookOpen, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Meta, Program } from '../lib/types';
import { useAuth } from '../lib/auth';
import { DEGREE_TONE, PROGRAM_STATUS, labelOf, toneOf } from '../lib/labels';
import { formatMoney } from '../lib/format';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SearchInput, Select, StatCard,
  TableSkeleton, Textarea,
} from '../components/ui';
import { ConfirmDialog, Drawer, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

type FormState = {
  name: string; code: string; facultyId: string; degree: string; durationYears: string;
  totalCredits: string; tuitionFee: string; status: string; description: string;
};

const emptyForm: FormState = {
  name: '', code: '', facultyId: '', degree: 'Licence', durationYears: '3',
  totalCredits: '180', tuitionFee: '600000', status: 'ouverte', description: '',
};

export function Programs() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [degree, setDegree] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Program | null>(null);
  const [detail, setDetail] = useState<Program | null>(null);

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['programs', search, degree, facultyId],
    queryFn: () => get<{ items: Program[]; stats: Record<string, number> }>(
      `/programs${qs({ search, degree, facultyId })}`,
    ),
  });

  const items = data?.items ?? [];
  const stats = data?.stats ?? {};

  const facultyOptions = meta?.faculties ?? [];
  const degrees = meta?.degrees ?? ['Licence', 'Master', 'Doctorat', 'BTS', 'Certificat'];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: ['faculties'] });
    queryClient.invalidateQueries({ queryKey: ['meta'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, facultyId: facultyOptions[0]?.id ?? '' });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(program: Program) {
    setEditing(program);
    setForm({
      name: program.name, code: program.code, facultyId: program.facultyId, degree: program.degree,
      durationYears: String(program.durationYears), totalCredits: String(program.totalCredits),
      tuitionFee: String(program.tuitionFee), status: program.status, description: program.description ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing
        ? patch(`/programs/${editing.id}`, payload)
        : post('/programs', payload)
    ),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? 'Filière mise à jour' : 'Filière créée', form.name);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/programs/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Filière supprimée');
      setToDelete(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  function submit() {
    if (form.name.trim().length < 3) return setFormError('Le nom de la filière est requis.');
    if (!form.facultyId) return setFormError('Sélectionnez une faculté.');
    saveMutation.mutate(form);
    return undefined;
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Program[]>();
    items.forEach((program) => {
      const key = program.degree;
      map.set(key, [...(map.get(key) ?? []), program]);
    });
    return [...map.entries()];
  }, [items]);

  return (
    <>
      <PageHeader
        title="Filières & diplômes"
        subtitle="Licences, Masters, BTS et certificats : maquettes, crédits et frais de scolarité."
        actions={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvelle filière</Button> : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Filières" value={stats.total ?? 0} icon={Layers} loading={isLoading} foot={<span>{facultyOptions.length} faculté(s)</span>} />
        <StatCard label="Masters" value={stats.masters ?? 0} icon={GraduationCap} tone="violet" loading={isLoading} foot={<span>Bac+4 / Bac+5</span>} />
        <StatCard label="Étudiants inscrits" value={stats.students ?? 0} icon={Users} tone="info" loading={isLoading} foot={<span>Toutes filières</span>} />
        <StatCard label="Crédits cumulés" value={stats.credits ?? 0} icon={BookOpen} tone="amber" loading={isLoading} foot={<span>Système LMD</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une filière…" />
          <div className="filter-bar">
            <Select value={facultyId} onChange={(event) => setFacultyId(event.target.value)} aria-label="Faculté">
              <option value="">Toutes les facultés</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>{faculty.code} — {faculty.name}</option>
              ))}
            </Select>
            <Select value={degree} onChange={(event) => setDegree(event.target.value)} aria-label="Diplôme">
              <option value="">Tous les diplômes</option>
              {degrees.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
            {(search || degree || facultyId) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDegree(''); setFacultyId(''); }}>
                Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {isLoading && <div className="card-pad"><TableSkeleton rows={6} cols={5} /></div>}

        {isError && (
          <div className="card-pad">
            <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="card-pad">
            <EmptyState
              icon={Layers}
              title="Aucune filière"
              description={search || degree || facultyId ? 'Aucun résultat pour ces filtres.' : 'Créez une filière pour commencer à structurer les enseignements.'}
              action={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Créer une filière</Button> : undefined}
            />
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Filière</th>
                  <th className="hide-sm">Faculté</th>
                  <th>Diplôme</th>
                  <th className="hide-sm">Maquette</th>
                  <th className="hide-sm">Étudiants</th>
                  <th className="hide-sm">Frais / an</th>
                  <th>Statut</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((program) => (
                  <tr key={program.id} onClick={() => setDetail(program)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="cell-main">{program.name}</div>
                      <div className="cell-sub">{program.code} · {program.durationYears} ans</div>
                    </td>
                    <td className="hide-sm">
                      <div className="cell-main" style={{ fontWeight: 500 }}>{program.facultyCode ?? '—'}</div>
                      <div className="cell-sub">{program.facultyName}</div>
                    </td>
                    <td><Badge tone={DEGREE_TONE[program.degree] ?? 'primary'}>{program.degree}</Badge></td>
                    <td className="hide-sm">
                      <div className="cell-main" style={{ fontWeight: 500 }}>{program.unitCount} UE</div>
                      <div className="cell-sub">{program.creditedUnits}/{program.totalCredits} crédits</div>
                    </td>
                    <td className="hide-sm">{program.studentCount}</td>
                    <td className="hide-sm nowrap">{formatMoney(program.tuitionFee, true)}</td>
                    <td><Badge tone={toneOf(PROGRAM_STATUS, program.status)} dot>{labelOf(PROGRAM_STATUS, program.status)}</Badge></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="actions" style={{ opacity: 1 }}>
                        {isAdmin && <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(program)} />}
                        {isAdmin && <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(program)} />}
                        {!isAdmin && <IconButton icon={ArrowRight} label="Détails" onClick={() => setDetail(program)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          <span>{items.length} filière(s) · réparties en {grouped.length} niveau(x) de diplôme</span>
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la filière' : 'Créer une filière'}
        description="Système LMD : licence 180 crédits, master 120 crédits."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Créer la filière'}
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
          <Field label="Intitulé" htmlFor="pName" className="span-2">
            <Input id="pName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Informatique" />
          </Field>
          <Field label="Sigle" htmlFor="pCode">
            <Input id="pCode" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="INF" />
          </Field>
          <Field label="Faculté" htmlFor="pFaculty">
            <Select id="pFaculty" value={form.facultyId} onChange={(event) => setForm({ ...form, facultyId: event.target.value })}>
              <option value="">Sélectionner…</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>{faculty.code} — {faculty.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Diplôme" htmlFor="pDegree">
            <Select id="pDegree" value={form.degree} onChange={(event) => setForm({ ...form, degree: event.target.value })}>
              {degrees.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </Field>
          <Field label="Statut" htmlFor="pStatus">
            <Select id="pStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ouverte">Ouverte</option>
              <option value="fermee">Fermée</option>
              <option value="brouillon">Brouillon</option>
            </Select>
          </Field>
          <Field label="Durée (années)" htmlFor="pYears">
            <Input id="pYears" type="number" min={1} max={8} value={form.durationYears} onChange={(event) => setForm({ ...form, durationYears: event.target.value })} />
          </Field>
          <Field label="Crédits requis" htmlFor="pCredits">
            <Input id="pCredits" type="number" min={1} max={600} value={form.totalCredits} onChange={(event) => setForm({ ...form, totalCredits: event.target.value })} />
          </Field>
          <Field label="Frais annuels (FCFA)" htmlFor="pFee" className="span-2">
            <Input id="pFee" type="number" min={0} step={5000} value={form.tuitionFee} onChange={(event) => setForm({ ...form, tuitionFee: event.target.value })} />
          </Field>
          <Field label="Description" htmlFor="pDesc" className="span-2">
            <Textarea id="pDesc" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Objectifs, débouchés, conditions d'admission…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer la filière"
        description={toDelete ? `${toDelete.name} et ses unités d'enseignement seront supprimées. Une filière avec des étudiants actifs ne peut pas être supprimée.` : ''}
        confirmLabel="Supprimer"
      />

      <ProgramDrawer program={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function ProgramDrawer({ program, onClose }: { program: Program | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['program', program?.id],
    queryFn: () => get<{ program: Program; units: any[]; students: any[] }>(`/programs/${program?.id}`),
    enabled: Boolean(program?.id),
  });

  return (
    <Drawer open={Boolean(program)} onClose={onClose} label="Détail de la filière">
      <div className="drawer-head">
        <span className="stat-icon violet" style={{
          width: 46, height: 46, borderRadius: 13, display: 'grid',
          placeItems: 'center', background: 'var(--violet-soft)', color: 'var(--violet)',
        }}><GraduationCap size={20} /></span>
        <div className="grow">
          <h2 style={{ fontSize: 17 }}>{program?.name}</h2>
          <div className="small muted mt-4">
            {program?.degree} · {program?.facultyName} · {program?.durationYears} ans
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><span style={{ fontSize: 18 }}>×</span></button>
      </div>

      <div className="drawer-body">
        <div className="grid grid-2">
          <div className="stat-card">
            <div className="stat-label">Crédits maquette</div>
            <div className="stat-value">{program?.creditedUnits ?? 0}<span className="small muted"> / {program?.totalCredits}</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Frais annuels</div>
            <div className="stat-value" style={{ fontSize: 19 }}>{formatMoney(program?.tuitionFee)}</div>
          </div>
        </div>

        <div className="section-head mt-16"><h2>Unités d'enseignement</h2><Badge tone="neutral">{data?.units.length ?? 0}</Badge></div>
        {isLoading && <TableSkeleton rows={3} cols={3} />}
        {(data?.units ?? []).map((unit) => (
          <Card key={unit.id} className="card-pad">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{unit.title}</div>
                <div className="tiny muted mt-4">
                  {unit.code} · Semestre {unit.semester} · {unit.hours} h · {unit.teacherName ?? 'Enseignant à affecter'}
                </div>
              </div>
              <Badge tone="info">{unit.credits} crédits</Badge>
            </div>
          </Card>
        ))}

        <div className="section-head mt-16"><h2>Étudiants inscrits</h2><Badge tone="neutral">{data?.students.length ?? 0}</Badge></div>
        {(data?.students ?? []).slice(0, 12).map((student) => (
          <div key={student.id} className="list-row">
            <div className="grow">
              <div className="cell-main">{student.firstName} {student.lastName}</div>
              <div className="cell-sub">{student.matricule} · {student.academicLevel ?? '—'}</div>
            </div>
            <Badge tone={student.status === 'actif' ? 'success' : 'neutral'} dot>{student.status}</Badge>
          </div>
        ))}
        {!isLoading && !(data?.students ?? []).length && (
          <p className="small muted">Aucun étudiant inscrit dans cette filière.</p>
        )}
      </div>
    </Drawer>
  );
}
