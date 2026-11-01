import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  School, Users, Wallet, DoorOpen, Plus, Pencil, Trash2, SearchX, ArrowRight,
  GraduationCap, CalendarClock, AlertTriangle,
} from 'lucide-react';
import { del, get, patch, post, ApiError } from '../lib/api';
import type { ClassRoom, Meta, Student } from '../lib/types';
import { useAuth } from '../lib/auth';
import { STUDENT_STATUS, labelOf, toneOf } from '../lib/labels';
import { colorFor, formatAverage, formatMoney } from '../lib/format';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, ProgressBar,
  ScorePill, SearchInput, Select, StatCard, TableSkeleton,
} from '../components/ui';
import { ConfirmDialog, Drawer, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

type FormState = {
  name: string; level: string; room: string; teacherId: string;
  capacity: string; tuitionFee: string; schedule: string;
};

const emptyForm: FormState = {
  name: '', level: '6ème', room: '', teacherId: '', capacity: '35', tuitionFee: '150000', schedule: '08:00 — 12:00',
};

export function Classes() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ClassRoom | null>(null);
  const [detail, setDetail] = useState<ClassRoom | null>(null);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['classes'],
    queryFn: () => get<{ items: ClassRoom[]; stats: Record<string, number> }>('/classes'),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    return list.filter((cls) => (
      (!levelFilter || cls.level === levelFilter)
      && (!search || cls.name.toLowerCase().includes(search.toLowerCase()) || (cls.teacherName ?? '').toLowerCase().includes(search.toLowerCase()))
    ));
  }, [data, search, levelFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(cls: ClassRoom) {
    setEditing(cls);
    setForm({
      name: cls.name, level: cls.level, room: cls.room ?? '', teacherId: cls.teacherId ?? '',
      capacity: String(cls.capacity), tuitionFee: String(cls.tuitionFee), schedule: cls.schedule ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing
        ? patch(`/classes/${editing.id}`, payload)
        : post('/classes', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Classe mise à jour' : 'Classe créée', `${form.name} est disponible.`);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      toast.success('Classe supprimée');
      setToDelete(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  function submit() {
    if (!form.name.trim()) {
      setFormError('Le nom de la classe est obligatoire.');
      return;
    }
    saveMutation.mutate({ ...form, teacherId: form.teacherId || '' });
  }

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Effectifs, salles et enseignants titulaires."
        actions={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvelle classe</Button> : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Classes ouvertes" value={data?.stats.total ?? 0} icon={School} loading={isLoading} foot={<span>{data?.stats.students ?? 0} élèves affectés</span>} />
        <StatCard label="Places disponibles" value={data?.stats.places ?? 0} icon={DoorOpen} tone="info" loading={isLoading} foot={<span>Capacité restante</span>} />
        <StatCard label="Recouvrement" value={formatMoney(data?.stats.collected, true)} icon={Wallet} tone="amber" loading={isLoading} foot={<span>Tous paiements confondus</span>} />
        <StatCard label="Niveaux" value={new Set(items.map((cls) => cls.level)).size} icon={GraduationCap} tone="violet" loading={isLoading} foot={<span>De la 6ème à la Terminale</span>} />
      </div>

      <div className="row gap-10 wrap mt-16">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une classe ou un enseignant…" />
        <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} style={{ width: 'auto', minWidth: 150 }} aria-label="Filtrer par niveau">
          <option value="">Tous les niveaux</option>
          {(meta.data?.levels ?? []).map((level) => <option key={level} value={level}>{level}</option>)}
        </Select>
        {(search || levelFilter) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setLevelFilter(''); }}>Réinitialiser</Button>
        )}
      </div>

      {isLoading && (
        <Card className="mt-16"><TableSkeleton rows={5} cols={4} /></Card>
      )}

      {isError && (
        <Card className="mt-16">
          <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />
        </Card>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <Card className="mt-16">
          <EmptyState
            icon={SearchX}
            title="Aucune classe trouvée"
            description={search || levelFilter ? 'Ajustez vos filtres pour voir plus de classes.' : 'Créez une première classe pour organiser vos effectifs.'}
            action={isAdmin && !search && !levelFilter ? <Button variant="primary" icon={Plus} onClick={openCreate}>Créer une classe</Button> : undefined}
          />
        </Card>
      )}

      <div className="grid grid-3 mt-16">
        {items.map((cls) => {
          const fill = Math.min(100, Math.round((cls.studentCount / cls.capacity) * 100));
          return (
            <Card key={cls.id} className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="row gap-8">
                    <h3 className="card-title">{cls.name}</h3>
                    <Badge tone="primary">{cls.level}</Badge>
                  </div>
                  <div className="small muted mt-4">{cls.room ?? 'Salle non définie'} · {cls.schedule ?? 'Horaires à définir'}</div>
                </div>
                {isAdmin && (
                  <div className="actions" style={{ opacity: 1 }}>
                    <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(cls)} />
                    <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(cls)} />
                  </div>
                )}
              </div>

              <div className="row gap-10">
                <Avatar name={cls.teacherName ?? 'Non assigné'} size="sm" color={cls.teacherName ? colorFor(cls.teacherName) : '#a6b5b1'} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small strong truncate">{cls.teacherName ?? 'Titulaire à désigner'}</div>
                  <div className="tiny muted">Enseignant titulaire</div>
                </div>
                <ScorePill value={cls.average ?? null} />
              </div>

              <div>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="tiny muted">{cls.studentCount} / {cls.capacity} élèves</span>
                  <span className="tiny strong">{fill}%</span>
                </div>
                <ProgressBar value={fill} tone={fill >= 90 ? 'amber' : 'primary'} />
              </div>

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="tiny muted">Frais annuels</div>
                  <div className="small strong">{formatMoney(cls.tuitionFee)}</div>
                </div>
                <Button size="sm" variant="ghost" icon={ArrowRight} onClick={() => setDetail(cls)}>Effectif</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la classe' : 'Créer une classe'}
        description="Les effectifs et les frais sont utilisés dans toute la plateforme."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Créer la classe'}
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
          <Field label="Nom de la classe" htmlFor="className">
            <Input id="className" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="6ème A" />
          </Field>
          <Field label="Niveau" htmlFor="classLevel">
            <Select id="classLevel" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
              {(meta.data?.levels ?? ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale']).map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </Select>
          </Field>
          <Field label="Salle" htmlFor="classRoom">
            <Input id="classRoom" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="Salle 101" />
          </Field>
          <Field label="Enseignant titulaire" htmlFor="classTeacher">
            <Select id="classTeacher" value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}>
              <option value="">Non assigné</option>
              {(meta.data?.teachers ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.subject}</option>
              ))}
            </Select>
          </Field>
          <Field label="Capacité" htmlFor="classCapacity">
            <Input id="classCapacity" type="number" min={1} max={120} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
          </Field>
          <Field label="Frais annuels (FCFA)" htmlFor="classFee">
            <Input id="classFee" type="number" min={0} step={5000} value={form.tuitionFee} onChange={(event) => setForm({ ...form, tuitionFee: event.target.value })} />
          </Field>
          <Field label="Horaires" htmlFor="classSchedule" className="span-2">
            <Input id="classSchedule" value={form.schedule} onChange={(event) => setForm({ ...form, schedule: event.target.value })} placeholder="07:30 — 12:30" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer la classe"
        description={toDelete ? `${toDelete.name} sera retirée du catalogue. Les classes avec élèves actifs ne peuvent pas être supprimées.` : ''}
        confirmLabel="Supprimer"
      />

      <ClassDrawer classRoom={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function ClassDrawer({ classRoom, onClose }: { classRoom: ClassRoom | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['class', classRoom?.id],
    queryFn: () => get<{ class: ClassRoom; students: Student[] }>(`/classes/${classRoom?.id}`),
    enabled: Boolean(classRoom?.id) && classRoom !== null,
  });

  return (
    <Drawer open={Boolean(classRoom)} onClose={onClose} label="Effectif de la classe">
      <div className="drawer-head">
        <span className="stat-icon" style={{ width: 46, height: 46, borderRadius: 13 }}><School size={20} /></span>
        <div className="grow">
          <h2 style={{ fontSize: 17 }}>{classRoom?.name}</h2>
          <div className="small muted mt-4">
            {classRoom?.level} · {classRoom?.room ?? 'Salle non définie'} · {classRoom?.teacherName ?? 'Sans titulaire'}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><span style={{ fontSize: 18 }}>×</span></button>
      </div>
      <div className="drawer-body">
        <div className="grid grid-2" style={{ gap: 10 }}>
          <div className="card card-pad">
            <div className="stat-label">Effectif</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{data?.class.studentCount ?? classRoom?.studentCount ?? 0}</div>
            <div className="tiny muted">sur {classRoom?.capacity} places</div>
          </div>
          <div className="card card-pad">
            <div className="stat-label">Frais annuels</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{formatMoney(classRoom?.tuitionFee, true)}</div>
            <div className="tiny muted">par élève</div>
          </div>
        </div>

        <Card>
          <div className="card-head">
            <h3>Élèves de la classe</h3>
            <Badge tone="neutral">{data?.students.length ?? 0}</Badge>
          </div>
          {isLoading && <TableSkeleton rows={5} cols={3} />}
          {!isLoading && (data?.students.length ?? 0) === 0 && (
            <EmptyState icon={Users} title="Effectif vide" description="Aucun élève n'est encore affecté à cette classe." />
          )}
          <div className="card-body stack">
            {(data?.students ?? []).map((student) => (
              <div key={student.id} className="list-row">
                <Avatar name={`${student.firstName} ${student.lastName}`} size="sm" color={colorFor(student.id)} />
                <div className="grow">
                  <div className="strong" style={{ fontSize: 13 }}>{student.firstName} {student.lastName}</div>
                  <div className="tiny muted">{student.matricule} · {student.guardianName ?? 'Tuteur inconnu'}</div>
                </div>
                <div className="right">
                  <Badge tone={toneOf(STUDENT_STATUS, student.status)}>{labelOf(STUDENT_STATUS, student.status)}</Badge>
                  <div className="tiny muted mt-4">{formatAverage(student.average ?? null)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="tiny muted row gap-6">
          <CalendarClock size={12} /> {classRoom?.schedule ?? 'Horaires à définir'}
        </div>
      </div>
    </Drawer>
  );
}
