import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen, Clock, Layers, AlertTriangle } from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { CourseUnit, Meta } from '../lib/types';
import { useAuth } from '../lib/auth';
import { UNIT_STATUS, labelOf, toneOf } from '../lib/labels';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SearchInput, Select, StatCard,
  TableSkeleton, Textarea,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

type FormState = {
  programId: string; code: string; title: string; semester: string; credits: string;
  hours: string; teacherId: string; status: string; description: string;
};

const emptyForm: FormState = {
  programId: '', code: '', title: '', semester: '1', credits: '6', hours: '45',
  teacherId: '', status: 'actif', description: '',
};

export function Units() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [programId, setProgramId] = useState('');
  const [semester, setSemester] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourseUnit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CourseUnit | null>(null);

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['units', search, programId, semester],
    queryFn: () => get<{ items: CourseUnit[]; stats: Record<string, number> }>(
      `/course-units${qs({ search, programId, semester })}`,
    ),
  });

  const items = data?.items ?? [];
  const stats = data?.stats ?? {};
  const programs = meta?.programs ?? [];
  const teachers = meta?.teachers ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['units'] });
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, programId: programId || programs[0]?.id || '' });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(unit: CourseUnit) {
    setEditing(unit);
    setForm({
      programId: unit.programId, code: unit.code, title: unit.title, semester: String(unit.semester),
      credits: String(unit.credits), hours: String(unit.hours), teacherId: unit.teacherId ?? '',
      status: unit.status, description: unit.description ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/course-units/${editing.id}`, payload) : post('/course-units', payload)
    ),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? 'Unité mise à jour' : 'Unité créée', form.title);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/course-units/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Unité supprimée');
      setToDelete(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  function submit() {
    if (!form.programId) return setFormError('Sélectionnez une filière.');
    if (form.title.trim().length < 3) return setFormError("L'intitulé de l'unité est requis.");
    if (form.code.trim().length < 2) return setFormError('Le code de l’unité est requis.');
    saveMutation.mutate(form);
    return undefined;
  }

  return (
    <>
      <PageHeader
        title="Unités d'enseignement"
        subtitle="Maquette LMD : crédits, volumes horaires et enseignants affectés."
        actions={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvelle unité</Button> : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Unités" value={stats.total ?? 0} icon={BookOpen} loading={isLoading} foot={<span>{stats.programs ?? 0} filière(s)</span>} />
        <StatCard label="Crédits" value={stats.credits ?? 0} icon={Layers} tone="violet" loading={isLoading} foot={<span>Système LMD</span>} />
        <StatCard label="Volume horaire" value={`${stats.hours ?? 0} h`} icon={Clock} tone="info" loading={isLoading} foot={<span>Cumul des UE</span>} />
        <StatCard label="Enseignants" value={new Set(items.map((unit) => unit.teacherId).filter(Boolean)).size} icon={BookOpen} tone="amber" loading={isLoading} foot={<span>Affectés aux UE</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une unité…" />
          <div className="filter-bar">
            <Select value={programId} onChange={(event) => setProgramId(event.target.value)} aria-label="Filière">
              <option value="">Toutes les filières</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.code} — {program.name}</option>
              ))}
            </Select>
            <Select value={semester} onChange={(event) => setSemester(event.target.value)} aria-label="Semestre">
              <option value="">Tous les semestres</option>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Semestre {value}</option>)}
            </Select>
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
              icon={BookOpen}
              title="Aucune unité d'enseignement"
              description="Ajoutez les UE qui composent la maquette de vos filières."
              action={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Créer une unité</Button> : undefined}
            />
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Unité</th>
                  <th className="hide-sm">Filière</th>
                  <th>Semestre</th>
                  <th>Crédits</th>
                  <th className="hide-sm">Heures</th>
                  <th className="hide-sm">Enseignant</th>
                  <th>Statut</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((unit) => (
                  <tr key={unit.id}>
                    <td>
                      <div className="cell-main">{unit.title}</div>
                      <div className="cell-sub">{unit.code}</div>
                    </td>
                    <td className="hide-sm">
                      <div className="cell-main" style={{ fontWeight: 500 }}>{unit.programName ?? '—'}</div>
                      <div className="cell-sub">{unit.facultyCode ?? ''}</div>
                    </td>
                    <td><Badge tone="neutral">S{unit.semester}</Badge></td>
                    <td><span className="strong">{unit.credits}</span> <span className="tiny muted">cr.</span></td>
                    <td className="hide-sm">{unit.hours} h</td>
                    <td className="hide-sm">{unit.teacherName ?? <span className="muted">À affecter</span>}</td>
                    <td><Badge tone={toneOf(UNIT_STATUS, unit.status)} dot>{labelOf(UNIT_STATUS, unit.status)}</Badge></td>
                    <td>
                      <div className="actions" style={{ opacity: 1 }}>
                        {isAdmin && <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(unit)} />}
                        {isAdmin && <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(unit)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          <span>{items.length} unité(s) · {stats.credits ?? 0} crédits · {stats.hours ?? 0} heures</span>
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Modifier l'unité d'enseignement" : "Créer une unité d'enseignement"}
        description="Les crédits et volumes horaires alimentent la maquette de la filière."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : "Créer l'unité"}
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
          <Field label="Intitulé" htmlFor="uTitle" className="span-2">
            <Input id="uTitle" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bases de données relationnelles" />
          </Field>
          <Field label="Code" htmlFor="uCode">
            <Input id="uCode" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="INF-110" />
          </Field>
          <Field label="Filière" htmlFor="uProgram">
            <Select id="uProgram" value={form.programId} onChange={(event) => setForm({ ...form, programId: event.target.value })}>
              <option value="">Sélectionner…</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.code} — {program.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Semestre" htmlFor="uSemester">
            <Select id="uSemester" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>Semestre {value}</option>)}
            </Select>
          </Field>
          <Field label="Crédits" htmlFor="uCredits">
            <Input id="uCredits" type="number" min={0} max={60} value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} />
          </Field>
          <Field label="Volume horaire" htmlFor="uHours">
            <Input id="uHours" type="number" min={0} max={500} value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
          </Field>
          <Field label="Enseignant" htmlFor="uTeacher">
            <Select id="uTeacher" value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}>
              <option value="">À affecter</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Statut" htmlFor="uStatus">
            <Select id="uStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="actif">Actif</option>
              <option value="archive">Archivé</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="uDesc" className="span-2">
            <Textarea id="uDesc" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Contenu et objectifs pédagogiques…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer l'unité"
        description={toDelete ? `${toDelete.title} sera retirée de la maquette.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
