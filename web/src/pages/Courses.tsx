import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, BookOpen, Users, Clock, PlayCircle, SearchX,
  Layers, Eye, EyeOff, AlertTriangle,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Course, Meta } from '../lib/types';
import { COURSE_STATUS, labelOf, toneOf } from '../lib/labels';
import { formatNumber } from '../lib/format';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SearchInput, Select,
  StatCard, TableSkeleton, Textarea,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

const PALETTE = ['#0f766e', '#1d4ed8', '#b45309', '#6d28d9', '#15803d', '#0e7490', '#be123c', '#a16207'];

type FormState = {
  title: string; subject: string; level: string; teacherId: string; status: string;
  lessonsCount: string; durationHours: string; description: string; color: string;
};

const emptyForm: FormState = {
  title: '', subject: 'Mathématiques', level: '6ème', teacherId: '', status: 'brouillon',
  lessonsCount: '0', durationHours: '0', description: '', color: PALETTE[0],
};

export function Courses() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Course | null>(null);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['courses', { search, statusFilter, levelFilter }],
    queryFn: () => get<{ items: Course[]; canManage: boolean; stats: Record<string, number> }>(
      `/courses${qs({ search, status: statusFilter, level: levelFilter })}`,
    ),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const stats = data?.stats ?? {};

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setForm({
      title: course.title,
      subject: course.subject,
      level: course.level,
      teacherId: course.teacherId ?? '',
      status: course.status,
      lessonsCount: String(course.lessonsCount),
      durationHours: String(course.durationHours),
      description: course.description ?? '',
      color: course.color ?? PALETTE[0],
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/courses/${editing.id}`, payload) : post('/courses', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Cours mis à jour' : 'Cours créé', form.title);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/courses/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['courses'] });
      const snapshot = queryClient.getQueriesData<{ items: Course[] }>({ queryKey: ['courses'] });
      queryClient.setQueriesData<{ items: Course[] }>({ queryKey: ['courses'] }, (old) => old ? {
        ...old, items: old.items.map((course) => course.id === id ? { ...course, status: status as Course['status'] } : course),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _vars, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Publication impossible', error.message);
    },
    onSuccess: (_data, vars) => toast.success(
      vars.status === 'publie' ? 'Cours publié' : 'Cours dépublié',
      vars.status === 'publie' ? 'Les élèves peuvent accéder au cours.' : 'Le cours n’est plus visible des élèves.',
    ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/courses/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['courses'] });
      const snapshot = queryClient.getQueriesData<{ items: Course[] }>({ queryKey: ['courses'] });
      queryClient.setQueriesData<{ items: Course[] }>({ queryKey: ['courses'] }, (old) => old ? {
        ...old, items: old.items.filter((course) => course.id !== id),
      } : old);
      return { snapshot };
    },
    onError: (error: ApiError, _id, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Suppression impossible', error.message);
    },
    onSuccess: () => toast.success('Cours supprimé'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setToDelete(null);
    },
  });

  function submit() {
    if (form.title.trim().length < 4) {
      setFormError('Le titre doit contenir au moins 4 caractères.');
      return;
    }
    saveMutation.mutate({ ...form, teacherId: form.teacherId || '' });
  }

  return (
    <>
      <PageHeader
        title="Cours en ligne"
        subtitle="Catalogue pédagogique publié aux élèves."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>Nouveau cours</Button>}
      />

      <div className="grid grid-4">
        <StatCard label="Cours au catalogue" value={stats.total ?? 0} icon={BookOpen} loading={isLoading} foot={<span>{stats.publies ?? 0} publiés</span>} />
        <StatCard label="Brouillons" value={stats.brouillons ?? 0} icon={Layers} tone="amber" loading={isLoading} foot={<span>En préparation</span>} />
        <StatCard label="Apprenants" value={formatNumber(stats.apprenants ?? 0)} icon={Users} tone="violet" loading={isLoading} foot={<span>Inscrits aux cours publiés</span>} />
        <StatCard label="Leçons disponibles" value={items.reduce((sum, course) => sum + course.lessonsCount, 0)} icon={PlayCircle} tone="info" loading={isLoading} foot={<span>Toutes disciplines</span>} />
      </div>

      <div className="row gap-10 wrap mt-16">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un cours ou une matière…" />
        <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} style={{ width: 'auto', minWidth: 140 }} aria-label="Niveau">
          <option value="">Tous les niveaux</option>
          {(meta.data?.levels ?? []).map((level) => <option key={level} value={level}>{level}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: 'auto', minWidth: 140 }} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(COURSE_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </Select>
        {(search || levelFilter || statusFilter) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setLevelFilter(''); setStatusFilter(''); }}>Réinitialiser</Button>
        )}
      </div>

      {isLoading && <Card className="mt-16"><TableSkeleton rows={4} cols={3} /></Card>}

      {isError && <Card className="mt-16"><EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} /></Card>}

      {!isLoading && !isError && items.length === 0 && (
        <Card className="mt-16">
          <EmptyState
            icon={search || levelFilter || statusFilter ? SearchX : BookOpen}
            title={search || levelFilter || statusFilter ? 'Aucun cours ne correspond' : 'Le catalogue est vide'}
            description={search || levelFilter || statusFilter ? 'Modifiez vos filtres pour découvrir d’autres cours.' : 'Créez un cours, ajoutez des leçons puis publiez-le aux élèves.'}
            action={!search && !levelFilter && !statusFilter ? <Button variant="primary" icon={Plus} onClick={openCreate}>Créer un cours</Button> : undefined}
          />
        </Card>
      )}

      <div className="grid grid-3 mt-16">
        {items.map((course) => {
          const color = course.color || PALETTE[0];
          const published = course.status === 'publie';
          return (
            <article className="course-card" key={course.id}>
              <div className="course-cover" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
                <div>
                  <div className="subject">{course.subject}</div>
                  <div className="strong" style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>{course.level}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <Badge tone={published ? 'success' : course.status === 'archive' ? 'neutral' : 'warning'}>
                    {labelOf(COURSE_STATUS, course.status)}
                  </Badge>
                </div>
              </div>
              <div className="course-body">
                <h3 className="course-title">{course.title}</h3>
                <p className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.description ?? 'Aucune description fournie.'}
                </p>
                <div className="course-meta">
                  <span><Layers size={12} /> {course.lessonsCount} leçons</span>
                  <span><Clock size={12} /> {course.durationHours} h</span>
                  <span><Users size={12} /> {course.enrolledCount} inscrits</span>
                </div>
                {course.teacherName && <div className="tiny muted">Par {course.teacherName}</div>}
              </div>
              <div className="course-foot">
                <IconButton
                  icon={published ? EyeOff : Eye}
                  label={published ? 'Dépublier' : 'Publier'}
                  onClick={() => statusMutation.mutate({ id: course.id, status: published ? 'brouillon' : 'publie' })}
                />
                <span className="tiny muted grow">{published ? 'Visible des élèves' : 'Non visible'}</span>
                <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(course)} />
                <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(course)} />
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le cours' : 'Créer un cours en ligne'}
        description="Les cours publiés sont visibles dans l'espace élève."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Créer le cours'}
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
          <Field label="Titre du cours" htmlFor="cTitle" className="span-2">
            <Input id="cTitle" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mathématiques — Fonctions et dérivées" />
          </Field>
          <Field label="Matière" htmlFor="cSubject">
            <Select id="cSubject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>
              {(meta.data?.subjects ?? []).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </Select>
          </Field>
          <Field label="Niveau" htmlFor="cLevel">
            <Select id="cLevel" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
              {(meta.data?.levels ?? []).map((level) => <option key={level} value={level}>{level}</option>)}
            </Select>
          </Field>
          <Field label="Enseignant" htmlFor="cTeacher">
            <Select id="cTeacher" value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}>
              <option value="">Non assigné</option>
              {(meta.data?.teachers ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </Select>
          </Field>
          <Field label="Statut" htmlFor="cStatus">
            <Select id="cStatus" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {Object.entries(COURSE_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </Select>
          </Field>
          <Field label="Nombre de leçons" htmlFor="cLessons">
            <Input id="cLessons" type="number" min={0} value={form.lessonsCount} onChange={(event) => setForm({ ...form, lessonsCount: event.target.value })} />
          </Field>
          <Field label="Durée (heures)" htmlFor="cHours">
            <Input id="cHours" type="number" min={0} value={form.durationHours} onChange={(event) => setForm({ ...form, durationHours: event.target.value })} />
          </Field>
          <Field label="Description" htmlFor="cDescription" className="span-2">
            <Textarea id="cDescription" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Objectifs, chapitres couverts, ressources…" />
          </Field>
          <Field label="Couleur de couverture" className="span-2">
            <div className="chip-row">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  aria-label={`Couleur ${color}`}
                  style={{
                    width: 30, height: 30, borderRadius: 9, background: color, border: form.color === color ? '3px solid #0a1f1b' : '3px solid transparent',
                    outline: form.color === color ? '2px solid #fff' : 'none', outlineOffset: -4,
                  }}
                />
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer le cours"
        description={toDelete ? `« ${toDelete.title} » sera retiré du catalogue.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
