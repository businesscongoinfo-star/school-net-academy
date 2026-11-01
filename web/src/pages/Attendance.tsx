import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Clock3, ShieldCheck, ClipboardCheck, AlertTriangle, Users, CalendarDays,
} from 'lucide-react';
import { get, post, qs, ApiError } from '../lib/api';
import type { AttendanceRecord, Meta } from '../lib/types';
import { useAuth } from '../lib/auth';
import { ATTENDANCE_STATUS, labelOf, toneOf } from '../lib/labels';
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, SearchInput, Select, StatCard, TableSkeleton,
} from '../components/ui';
import { useToast } from '../components/toast';

type Status = 'present' | 'absent' | 'retard' | 'excuse';

const OPTIONS: { value: Status; icon: typeof CheckCircle2 }[] = [
  { value: 'present', icon: CheckCircle2 },
  { value: 'absent', icon: XCircle },
  { value: 'retard', icon: Clock3 },
  { value: 'excuse', icon: ShieldCheck },
];

const today = () => new Date().toISOString().slice(0, 10);

export function Attendance() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(today());
  const [scope, setScope] = useState<'classe' | 'filiere'>('classe');
  const [classId, setClassId] = useState('');
  const [programId, setProgramId] = useState('');
  const [session, setSession] = useState('Journée');
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<Record<string, Status>>({});

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance', date, classId, programId, session],
    queryFn: () => get<{ items: AttendanceRecord[]; stats: Record<string, number | null> }>(
      `/attendance${qs({ date, classId: classId || undefined, programId: programId || undefined, session: session === 'Journée' ? undefined : session })}`,
    ),
  });

  useEffect(() => { setOverrides({}); }, [date, classId, programId, session]);

  // Première classe sélectionnée par défaut pour un pointage rapide
  useEffect(() => {
    if (!classId && !programId && meta?.classes?.length) setClassId(meta.classes[0].id);
  }, [meta, classId, programId]);

  const records = data?.items ?? [];
  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((record) => map.set(record.studentId, record));
    return map;
  }, [records]);

  const scoped = scope === 'classe' ? Boolean(classId) : Boolean(programId);

  const roster = useMemo(() => {
    if (!scoped) return [];
    const students = (meta?.students ?? []).filter((student) => student.status === 'actif');
    return students
      .filter((student) => (scope === 'classe'
        ? (!classId || student.classId === classId)
        : (!programId || student.programId === programId)))
      .filter((student) => !search || student.name.toLowerCase().includes(search.toLowerCase())
        || student.matricule.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [meta, scope, classId, programId, search, scoped]);

  const statusOf = (studentId: string): Status | null => (
    overrides[studentId] ?? (recordMap.get(studentId)?.status as Status | undefined) ?? null
  );

  const counts = roster.reduce((acc, student) => {
    const status = statusOf(student.id);
    if (status) acc[status] += 1;
    return acc;
  }, { present: 0, absent: 0, retard: 0, excuse: 0 } as Record<Status, number>);
  const marked = counts.present + counts.absent + counts.retard + counts.excuse;
  const rate = marked ? Math.round(((counts.present + counts.retard) / marked) * 100) : null;

  const markMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: Status }) => (
      post('/attendance/mark', { studentId, date, session, status })
    ),
    onMutate: ({ studentId, status }) => {
      setOverrides((previous) => ({ ...previous, [studentId]: status }));
    },
    onError: (error: ApiError, variables) => {
      setOverrides((previous) => {
        const next = { ...previous };
        delete next[variables.studentId];
        return next;
      });
      toast.error('Pointage impossible', error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (status: Status) => post('/attendance/bulk', {
      date, session, status, studentIds: roster.map((student) => student.id),
    }),
    onMutate: (status: Status) => {
      const next: Record<string, Status> = {};
      roster.forEach((student) => { next[student.id] = status; });
      setOverrides(next);
    },
    onSuccess: (_result, status) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${roster.length} élève(s) pointés`, `Statut : ${labelOf(ATTENDANCE_STATUS, status)}`);
    },
    onError: (error: ApiError) => {
      setOverrides({});
      toast.error('Pointage impossible', error.message);
    },
  });

  const classes = meta?.classes ?? [];
  const programs = meta?.programs ?? [];
  const sessions = meta?.attendanceSessions ?? ['Journée', '08:00', '10:00', '14:00'];
  const scopeLabel = classId
    ? classes.find((option) => option.id === classId)?.name
    : programId
      ? programs.find((option) => option.id === programId)?.name
      : null;

  return (
    <>
      <PageHeader
        title="Présences"
        subtitle="Pointage quotidien des élèves et des étudiants, séance par séance."
        actions={(
          <Button
            variant="primary"
            icon={ClipboardCheck}
            loading={bulkMutation.isPending}
            disabled={!roster.length}
            onClick={() => bulkMutation.mutate('present')}
          >
            Tout marquer présent
          </Button>
        )}
      />

      <div className="grid grid-4">
        <StatCard label="Pointés" value={marked} icon={Users} loading={isLoading} foot={<span>sur {roster.length} inscrit(s)</span>} />
        <StatCard label="Présents" value={counts.present} icon={CheckCircle2} tone="info" loading={isLoading} foot={<span>{counts.retard} retard(s)</span>} />
        <StatCard label="Absents" value={counts.absent} icon={XCircle} tone="danger" loading={isLoading} foot={<span>{counts.excuse} excusé(s)</span>} />
        <StatCard label="Taux de présence" value={rate === null ? '—' : `${rate}%`} icon={CalendarDays} tone="violet" loading={isLoading} foot={<span>{date}</span>} />
      </div>

      <Card className="mt-16">
        <div className="card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <Field label="Date" htmlFor="aDate" className="mb-0">
            <Input id="aDate" type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} style={{ width: 170 }} />
          </Field>
          <Field label="Séance" htmlFor="aSession" className="mb-0">
            <Select id="aSession" value={session} onChange={(event) => setSession(event.target.value)} style={{ width: 140 }}>
              {sessions.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </Field>
          <Field label="Type" htmlFor="aScope" className="mb-0">
            <Select
              id="aScope"
              value={scope}
              onChange={(event) => {
                const value = event.target.value as 'classe' | 'filiere';
                setScope(value);
              }}
              style={{ width: 150 }}
            >
              <option value="classe">Classe</option>
              <option value="filiere">Filière</option>
            </Select>
          </Field>
          {scope === 'classe' ? (
            <Field label="Classe" htmlFor="aClass" className="mb-0">
              <Select id="aClass" value={classId} onChange={(event) => { setClassId(event.target.value); setProgramId(''); }} style={{ width: 180 }}>
                <option value="">Sélectionner une classe…</option>
                {classes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Filière" htmlFor="aProgram" className="mb-0">
              <Select id="aProgram" value={programId} onChange={(event) => { setProgramId(event.target.value); setClassId(''); }} style={{ width: 230 }}>
                <option value="">Sélectionner une filière…</option>
                {programs.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
              </Select>
            </Field>
          )}
          <div className="grow" />
          <SearchInput value={search} onChange={setSearch} placeholder="Nom ou matricule…" className="mb-0" />
        </div>
      </Card>

      {isLoading && <Card className="mt-16"><div className="card-pad"><TableSkeleton rows={6} cols={4} /></div></Card>}

      {isError && (
        <Card className="mt-16">
          <div className="card-pad">
            <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />
          </div>
        </Card>
      )}

      {!isLoading && !isError && roster.length === 0 && (
        <Card className="mt-16">
          <EmptyState
            icon={Users}
            title={scoped ? 'Aucun élève à pointer' : 'Choisissez une classe ou une filière'}
            description={scoped
              ? 'Cette sélection ne compte aucun inscrit actif.'
              : 'Le pointage se fait classe par classe (école) ou filière par filière (université).'}
          />
        </Card>
      )}

      {!isLoading && roster.length > 0 && (
        <Card className="mt-16">
          <div className="table-toolbar">
            <div>
              <strong style={{ fontSize: 13.5 }}>{scopeLabel ?? 'Tous les inscrits'}</strong>
              <div className="tiny muted mt-4">
                {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · séance {session}
              </div>
            </div>
            <div className="row gap-8" style={{ marginLeft: 'auto' }}>
              <Badge tone="success">{counts.present} présents</Badge>
              <Badge tone="danger">{counts.absent} absents</Badge>
              <Badge tone="warning">{counts.retard} retards</Badge>
              <Badge tone="info">{counts.excuse} excusés</Badge>
            </div>
          </div>

          <div className="att-list">
            {roster.map((student) => {
              const status = statusOf(student.id);
              const pending = markMutation.isPending && markMutation.variables?.studentId === student.id;
              return (
                <div key={student.id} className="att-row" style={{ opacity: pending ? 0.65 : 1 }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="cell-main truncate">{student.name}</div>
                    <div className="cell-sub">
                      {student.matricule} · {student.className ?? (student.programName
                        ? `${student.programName}${student.academicLevel ? ` · ${student.academicLevel}` : ''}`
                        : 'Non affecté')}
                    </div>
                  </div>
                  {status && (
                    <span className="hide-sm">
                      <Badge tone={toneOf(ATTENDANCE_STATUS, status)} dot>{labelOf(ATTENDANCE_STATUS, status)}</Badge>
                    </span>
                  )}
                  <div className="att-buttons">
                    {OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = status === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`att-btn ${option.value}${active ? ' active' : ''}`}
                          onClick={() => markMutation.mutate({ studentId: student.id, status: option.value })}
                          aria-pressed={active}
                          title={labelOf(ATTENDANCE_STATUS, option.value)}
                        >
                          <Icon size={14} />
                          <span>{ATTENDANCE_STATUS[option.value].short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="table-foot">
            <span>{roster.length} inscrit(s) · {marked} pointage(s) enregistré(s)</span>
            <Button size="sm" variant="ghost" onClick={() => setOverrides({})}>Réinitialiser la vue</Button>
          </div>
        </Card>
      )}
    </>
  );
}
