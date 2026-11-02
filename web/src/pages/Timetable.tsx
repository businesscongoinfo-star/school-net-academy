import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CalendarDays, Clock, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Meta, Schedule } from '../lib/types';
import { useAuth } from '../lib/auth';
import { SCHEDULE_KIND, labelOf, toneOf } from '../lib/labels';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Select, StatCard, TableSkeleton,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

type FormState = {
  title: string; scope: 'classe' | 'filiere'; classId: string; programId: string;
  teacherId: string; room: string; day: string; startTime: string; endTime: string; kind: string;
};

const emptyForm: FormState = {
  title: '', scope: 'classe', classId: '', programId: '', teacherId: '', room: '',
  day: 'Lundi', startTime: '08:00', endTime: '10:00', kind: 'Cours',
};

const TODAY_LABEL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()];

export function Timetable() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  const [scopeClass, setScopeClass] = useState('');
  const [scopeProgram, setScopeProgram] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Schedule | null>(null);

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['schedules', scopeClass, scopeProgram],
    queryFn: () => get<{ items: Schedule[]; days: string[]; stats: Record<string, any> }>(
      `/schedules${qs({ classId: scopeClass, programId: scopeProgram })}`,
    ),
  });

  const days = (data?.days ?? ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']).filter((day) => day !== 'Samedi'
    || (data?.items ?? []).some((item) => item.day === 'Samedi'));
  const items = data?.items ?? [];

  const byDay = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    days.forEach((day) => { map[day] = []; });
    items.forEach((item) => {
      map[item.day] = [...(map[item.day] ?? []), item];
    });
    return map;
  }, [items, days]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  function openCreate(day?: string) {
    setEditing(null);
    setForm({
      ...emptyForm,
      day: day ?? TODAY_LABEL,
      classId: scopeClass,
      programId: scopeProgram,
      scope: scopeClass ? 'classe' : scopeProgram ? 'filiere' : 'classe',
    });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(schedule: Schedule) {
    setEditing(schedule);
    setForm({
      title: schedule.title,
      scope: schedule.programId ? 'filiere' : 'classe',
      classId: schedule.classId ?? '',
      programId: schedule.programId ?? '',
      teacherId: schedule.teacherId ?? '',
      room: schedule.room ?? '',
      day: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      kind: schedule.kind,
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => {
      const body = {
        title: payload.title,
        classId: payload.scope === 'classe' ? payload.classId : null,
        programId: payload.scope === 'filiere' ? payload.programId : null,
        teacherId: payload.teacherId || null,
        room: payload.room,
        day: payload.day,
        startTime: payload.startTime,
        endTime: payload.endTime,
        kind: payload.kind,
      };
      return editing ? patch(`/schedules/${editing.id}`, body) : post('/schedules', body);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? 'Séance mise à jour' : 'Séance planifiée', form.title);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/schedules/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Séance supprimée');
      setToDelete(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  function submit() {
    if (form.title.trim().length < 2) return setFormError("L'intitulé de la séance est requis.");
    if (form.scope === 'classe' && !form.classId) return setFormError('Sélectionnez une classe.');
    if (form.scope === 'filiere' && !form.programId) return setFormError('Sélectionnez une filière.');
    if (form.endTime <= form.startTime) return setFormError("L'heure de fin doit suivre l'heure de début.");
    saveMutation.mutate(form);
    return undefined;
  }

  const classes = meta?.classes ?? [];
  const programs = meta?.programs ?? [];
  const teachers = meta?.teachers ?? [];
  const todayCount = items.filter((item) => item.day === TODAY_LABEL).length;

  return (
    <>
      <PageHeader
        title="Emploi du temps"
        subtitle="Planning hebdomadaire des classes et des amphis, séance par séance."
        actions={canEdit ? <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Nouvelle séance</Button> : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Séances / semaine" value={items.length} icon={CalendarDays} loading={isLoading} foot={<span>{days.length} jours ouvrés</span>} />
        <StatCard label={`Aujourd'hui (${TODAY_LABEL})`} value={todayCount} icon={Clock} tone="info" loading={isLoading} foot={<span>Cours et examens</span>} />
        <StatCard label="Salles utilisées" value={new Set(items.map((item) => item.room).filter(Boolean)).size} icon={MapPin} tone="violet" loading={isLoading} foot={<span>Salles et amphis</span>} />
        <StatCard label="Examens planifiés" value={items.filter((item) => item.kind === 'Examen' || item.kind === 'Soutenance').length} icon={AlertTriangle} tone="amber" loading={isLoading} foot={<span>Évaluations</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar" style={{ flexWrap: 'wrap' }}>
          <div className="filter-bar">
            <Select value={scopeClass} onChange={(event) => { setScopeClass(event.target.value); if (event.target.value) setScopeProgram(''); }} aria-label="Classe">
              <option value="">Toutes les classes</option>
              {classes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </Select>
            <Select value={scopeProgram} onChange={(event) => { setScopeProgram(event.target.value); if (event.target.value) setScopeClass(''); }} aria-label="Filière">
              <option value="">Toutes les filières</option>
              {programs.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
            </Select>
            {(scopeClass || scopeProgram) && (
              <Button variant="ghost" size="sm" onClick={() => { setScopeClass(''); setScopeProgram(''); }}>Réinitialiser</Button>
            )}
          </div>
          <span className="small muted" style={{ marginLeft: 'auto' }}>
            Cliquez sur une séance pour la modifier
          </span>
        </div>

        {isLoading && <div className="card-pad"><TableSkeleton rows={5} cols={4} /></div>}

        {isError && (
          <div className="card-pad">
            <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="card-pad">
            <EmptyState
              icon={CalendarDays}
              title="Aucune séance planifiée"
              description="Planifiez les cours de la semaine pour les classes et les filières."
              action={canEdit ? <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Planifier une séance</Button> : undefined}
            />
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="card-pad">
            <div className="tt-scroll">
              <div className="tt-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(190px, 1fr))` }}>
                {days.map((day) => (
                  <div key={day} className={day === TODAY_LABEL ? 'tt-col is-today' : 'tt-col'}>
                    <div className="tt-col-head">
                      <span>{day}</span>
                      <Badge tone={day === TODAY_LABEL ? 'primary' : 'neutral'}>{byDay[day]?.length ?? 0}</Badge>
                    </div>
                    <div className="tt-col-body">
                      {(byDay[day] ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((item) => (
                        <button
                          key={item.id}
                          className="tt-card"
                          onClick={() => (canEdit ? openEdit(item) : undefined)}
                          style={{ cursor: canEdit ? 'pointer' : 'default' }}
                        >
                          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="tt-time">{item.startTime} · {item.endTime}</span>
                            <Badge tone={toneOf(SCHEDULE_KIND, item.kind)}>{labelOf(SCHEDULE_KIND, item.kind)}</Badge>
                          </div>
                          <div className="tt-title">{item.title}</div>
                          <div className="tt-meta">
                            {item.className ?? item.programName ?? '—'}
                            {item.room ? ` · ${item.room}` : ''}
                          </div>
                          <div className="tt-meta">{item.teacherName ?? 'Enseignant à affecter'}</div>
                        </button>
                      ))}
                      {!(byDay[day] ?? []).length && (
                        <button className="tt-add" onClick={() => openCreate(day)} disabled={!canEdit}>
                          <Plus size={13} /> Ajouter
                        </button>
                      )}
                      {(byDay[day] ?? []).length > 0 && canEdit && (
                        <button className="tt-add" onClick={() => openCreate(day)}>
                          <Plus size={13} /> Ajouter une séance
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la séance' : 'Planifier une séance'}
        description="Classe (collège/lycée) ou filière universitaire."
        wide
        footer={(
          <>
            {editing && (
              <Button variant="danger" icon={Trash2} onClick={() => { setFormOpen(false); setToDelete(editing); }} style={{ marginRight: 'auto' }}>
                Supprimer
              </Button>
            )}
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Planifier'}
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
          <Field label="Intitulé" htmlFor="sTitle" className="span-2">
            <Input id="sTitle" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mathématiques — équations du second degré" />
          </Field>
          <Field label="Affectation" htmlFor="sScope">
            <Select id="sScope" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as FormState['scope'] })}>
              <option value="classe">Classe (école)</option>
              <option value="filiere">Filière (université)</option>
            </Select>
          </Field>
          {form.scope === 'classe' ? (
            <Field label="Classe" htmlFor="sClass">
              <Select id="sClass" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}>
                <option value="">Sélectionner…</option>
                {classes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Filière" htmlFor="sProgram">
              <Select id="sProgram" value={form.programId} onChange={(event) => setForm({ ...form, programId: event.target.value })}>
                <option value="">Sélectionner…</option>
                {programs.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Jour" htmlFor="sDay">
            <Select id="sDay" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>
              {(meta?.days ?? ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']).map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type de séance" htmlFor="sKind">
            <Select id="sKind" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {(meta?.scheduleKinds ?? ['Cours', 'TD', 'TP', 'Examen', 'Soutenance']).map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </Select>
          </Field>
          <Field label="Début" htmlFor="sStart">
            <Input id="sStart" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
          </Field>
          <Field label="Fin" htmlFor="sEnd">
            <Input id="sEnd" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
          </Field>
          <Field label="Enseignant" htmlFor="sTeacher">
            <Select id="sTeacher" value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}>
              <option value="">À affecter</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </Select>
          </Field>
          <Field label="Salle / Amphi" htmlFor="sRoom">
            <Input id="sRoom" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="Salle 204 / Amphi B" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer la séance"
        description={toDelete ? `${toDelete.title} (${toDelete.day} ${toDelete.startTime}) sera retirée de l'emploi du temps.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
