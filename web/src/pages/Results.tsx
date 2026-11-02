import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award, Users, TrendingUp, Plus, Trash2, Award as AwardIcon, SearchX, AlertTriangle, Pencil,
  Download, FileText, Printer,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Meta, ResultRow } from '../lib/types';
import { useAuth } from '../lib/auth';
import { appreciationOf } from '../lib/labels';
import { colorFor, formatAverage, formatDate } from '../lib/format';
import { datedFilename, downloadCsv } from '../lib/csv';
import {
  Avatar, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Pagination, ScorePill,
  SearchInput, Select, StatCard, TableSkeleton, Tabs,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

interface ResultsResponse {
  term: string;
  items: ResultRow[];
  subjects: string[];
  stats: { eleves: number; moyenne: number | null; reussite: number; meilleure: number | null };
}

type GradeForm = {
  id: string | null;
  studentId: string;
  subject: string;
  term: string;
  score: string;
  coefficient: string;
  comment: string;
};

export function Results() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  const [term, setTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<GradeForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
  const [bulletin, setBulletin] = useState<ResultRow | null>(null);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });
  const activeTerm = term || meta.data?.currentTerm || '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['results', { term: activeTerm, classFilter }],
    queryFn: () => get<ResultsResponse>(`/grades/results${qs({ term: activeTerm, classId: classFilter })}`),
    enabled: Boolean(activeTerm),
  });

  const rows = useMemo(() => {
    const list = data?.items ?? [];
    return search
      ? list.filter((row) => row.studentName.toLowerCase().includes(search.toLowerCase()) || row.matricule.includes(search))
      : list;
  }, [data, search]);

  const subjects = data?.subjects ?? [];
  const stats = data?.stats;
  const pageSize = 15;
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [activeTerm, classFilter, search]);

  const saveMutation = useMutation({
    mutationFn: (payload: GradeForm) => (
      payload.id
        ? patch(`/grades/${payload.id}`, {
          studentId: payload.studentId, subject: payload.subject, term: payload.term,
          score: payload.score, coefficient: payload.coefficient, comment: payload.comment,
        })
        : post('/grades', {
          studentId: payload.studentId, subject: payload.subject, term: payload.term,
          score: payload.score, coefficient: payload.coefficient, comment: payload.comment,
        })
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(form?.id ? 'Note mise à jour' : 'Note enregistrée', `${form?.subject} · ${form?.term}`);
      setForm(null);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/grades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Note supprimée');
      setToDelete(null);
      setForm(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  function openCreate(studentId = '', subject = '') {
    setForm({
      id: null, studentId, subject: subject || subjects[0] || 'Mathématiques',
      term: activeTerm, score: '', coefficient: '2', comment: '',
    });
    setFormError(null);
  }

  function openEdit(row: ResultRow, subject: string) {
    const grade = row.subjects[subject];
    if (!grade) {
      openCreate(row.studentId, subject);
      return;
    }
    setForm({
      id: grade.id, studentId: row.studentId, subject, term: activeTerm,
      score: String(grade.score), coefficient: String(grade.coefficient), comment: grade.comment ?? '',
    });
    setFormError(null);
  }

  function submit() {
    if (!form) return;
    if (!form.studentId) { setFormError('Sélectionnez un élève.'); return; }
    const score = Number(form.score);
    if (Number.isNaN(score) || score < 0 || score > 20) { setFormError('La note doit être comprise entre 0 et 20.'); return; }
    saveMutation.mutate(form);
  }

  const studentName = (studentId: string) => meta.data?.students.find((student) => student.id === studentId)?.name ?? '';

  const ranked = useMemo(
    () => [...(data?.items ?? [])]
      .filter((row) => row.average !== null && row.average !== undefined)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0)),
    [data],
  );
  const rankOf = (studentId: string) => {
    const index = ranked.findIndex((row) => row.studentId === studentId);
    return index === -1 ? null : index + 1;
  };
  const school = meta.data?.school?.name ?? 'School Net Academy';

  function exportCsv() {
    const columns = [
      { header: 'Rang', value: (row: ResultRow) => rankOf(row.studentId) ?? '' },
      { header: 'Élève', value: (row: ResultRow) => row.studentName },
      { header: 'Matricule', value: (row: ResultRow) => row.matricule },
      { header: 'Classe', value: (row: ResultRow) => row.className ?? '' },
      ...subjects.map((subject) => ({
        header: subject,
        value: (row: ResultRow) => row.subjects[subject]?.score ?? '',
      })),
      { header: 'Moyenne /20', value: (row: ResultRow) => (row.average === null || row.average === undefined ? '' : row.average) },
      { header: 'Appréciation', value: (row: ResultRow) => row.appreciation },
    ];
    const count = downloadCsv(datedFilename(`resultats-${activeTerm.replace(/\s+/g, '-').toLowerCase()}`), rows, columns);
    toast.success('Export CSV prêt', `${count} bulletin(s) — ${activeTerm}.`);
  }

  const bulletinRows = bulletin
    ? Object.entries(bulletin.subjects).map(([subject, grade]) => ({ subject, ...grade }))
    : [];
  const bulletinPoints = bulletinRows.reduce((sum, row) => sum + row.score * row.coefficient, 0);
  const bulletinCoefs = bulletinRows.reduce((sum, row) => sum + row.coefficient, 0);

  return (
    <>
      <PageHeader
        title="Résultats"
        subtitle="Notes par matière, moyennes pondérées et appréciations."
        actions={(
          <>
            <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>Exporter</Button>
            {canEdit && <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Saisir une note</Button>}
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard label="Élèves évalués" value={stats?.eleves ?? 0} icon={Users} loading={isLoading} foot={<span>{data?.term}</span>} />
        <StatCard label="Moyenne générale" value={`${formatAverage(stats?.moyenne ?? null)}/20`} icon={Award} tone="violet" loading={isLoading} foot={<Badge tone={appreciationOf(stats?.moyenne ?? null).tone}>{appreciationOf(stats?.moyenne ?? null).label}</Badge>} />
        <StatCard label="Taux de réussite" value={`${stats?.reussite ?? 0}%`} icon={TrendingUp} tone="info" loading={isLoading} foot={<span>Moyenne ≥ 10/20</span>} />
        <StatCard label="Meilleure moyenne" value={formatAverage(stats?.meilleure ?? null)} icon={AwardIcon} tone="amber" loading={isLoading} foot={<span>Sur la période</span>} />
      </div>

      <Card className="mt-16">
        <div className="table-toolbar">
          <Tabs
            value={activeTerm}
            onChange={(value) => setTerm(value)}
            options={(meta.data?.terms ?? ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']).map((item) => ({ value: item, label: item }))}
          />
          <div className="filter-bar" style={{ marginLeft: 'auto' }}>
            <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Classe">
              <option value="">Toutes les classes</option>
              {(meta.data?.classes ?? []).map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </Select>
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un élève…" />
          </div>
        </div>

        {isLoading && <TableSkeleton rows={7} cols={6} />}

        {isError && <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />}

        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            icon={search ? SearchX : Award}
            title={search ? 'Aucun élève trouvé' : 'Aucune note pour ce trimestre'}
            description={search ? 'Essayez un autre nom ou réinitialisez la recherche.' : canEdit ? 'Saisissez les évaluations pour calculer les moyennes automatiquement.' : 'Les résultats seront publiés par les enseignants.'}
            action={canEdit && !search ? <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Saisir une première note</Button> : undefined}
          />
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Rang</th>
                  <th>Élève</th>
                  {subjects.map((subject) => <th key={subject}>{subject}</th>)}
                  <th>Moyenne</th>
                  <th>Appréciation</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.studentId}>
                    <td><span className="tiny muted strong">{(page - 1) * pageSize + index + 1}</span></td>
                    <td>
                      <div className="row-avatar">
                        <Avatar name={row.studentName} size="sm" color={colorFor(row.studentId)} />
                        <div>
                          <div className="cell-main">{row.studentName}</div>
                          <div className="cell-sub">{row.className ?? '—'} · {row.matricule}</div>
                        </div>
                      </div>
                    </td>
                    {subjects.map((subject) => {
                      const grade = row.subjects[subject];
                      return (
                        <td key={subject}>
                          {grade ? (
                            <button
                              className={`score ${grade.score >= 14 ? 'good' : grade.score >= 10 ? 'mid' : 'low'}`}
                              style={{ border: 'none', cursor: canEdit ? 'pointer' : 'default' }}
                              title={canEdit ? 'Modifier la note' : grade.comment ?? ''}
                              onClick={() => canEdit && openEdit(row, subject)}
                            >
                              {grade.score.toFixed(1).replace('.', ',')}
                            </button>
                          ) : (
                            <button
                              className="score na"
                              style={{ border: 'none' }}
                              onClick={() => canEdit && openCreate(row.studentId, subject)}
                              aria-label={`Saisir une note en ${subject}`}
                            >
                              —
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td><ScorePill value={row.average} /></td>
                    <td><Badge tone={appreciationOf(row.average).tone}>{row.appreciation}</Badge></td>
                    <td>
                      <div className="actions">
                        <Button size="sm" variant="ghost" icon={FileText} onClick={() => setBulletin(row)}>Bulletin</Button>
                        {canEdit && <IconButton icon={Pencil} label="Ajouter une note" onClick={() => openCreate(row.studentId)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !isError && rows.length > pageSize && (
          <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} />
        )}
      </Card>

      <div className="tiny muted mt-16">
        Moyennes pondérées par coefficient · Les notes sont plafonnées à 20/20 · Dernière mise à jour {formatDate(new Date().toISOString())}
      </div>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Modifier la note' : 'Saisir une note'}
        description={canEdit ? 'La moyenne de l’élève est recalculée automatiquement.' : undefined}
        footer={(
          <>
            {form?.id && (
              <Button
                variant="soft-danger"
                icon={Trash2}
                className="left"
                onClick={() => setToDelete({ id: form.id!, label: `${form.subject} · ${studentName(form.studentId)}` })}
              >
                Supprimer
              </Button>
            )}
            <Button variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {form?.id ? 'Enregistrer' : 'Ajouter la note'}
            </Button>
          </>
        )}
      >
        {form && (
          <div className="form-grid">
            {formError && (
              <div className="span-2" style={{ background: 'var(--danger-soft)', color: '#a52f23', padding: '9px 12px', borderRadius: 9, fontSize: 12.5 }}>
                {formError}
              </div>
            )}
            <Field label="Élève" htmlFor="gStudent" className="span-2">
              <Select id="gStudent" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
                <option value="">Sélectionner un élève…</option>
                {(meta.data?.students ?? []).map((student) => (
                  <option key={student.id} value={student.id}>{student.name} · {student.className ?? 'Non affecté'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Matière" htmlFor="gSubject">
              <Select id="gSubject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>
                {(meta.data?.subjects ?? subjects).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </Select>
            </Field>
            <Field label="Trimestre" htmlFor="gTerm">
              <Select id="gTerm" value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}>
                {(meta.data?.terms ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label="Note sur 20" htmlFor="gScore">
              <Input id="gScore" type="number" min={0} max={20} step={0.25} value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} placeholder="14.5" />
            </Field>
            <Field label="Coefficient" htmlFor="gCoef">
              <Input id="gCoef" type="number" min={1} max={10} value={form.coefficient} onChange={(event) => setForm({ ...form, coefficient: event.target.value })} />
            </Field>
            <Field label="Appréciation de l'enseignant" htmlFor="gComment" className="span-2">
              <Input id="gComment" value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Bon travail, participation régulière…" />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(bulletin)}
        onClose={() => setBulletin(null)}
        title="Bulletin de notes"
        description={`${activeTerm} · ${school}`}
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={() => setBulletin(null)}>Fermer</Button>
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>Imprimer / PDF</Button>
          </>
        )}
      >
        {bulletin && (
          <div className="bulletin" id="bulletin">
            <div className="bulletin-head">
              <div>
                <div className="bulletin-school">{school}</div>
                <div className="bulletin-sub">Enseignement général et supérieur · Brazzaville, Congo</div>
              </div>
              <div className="bulletin-meta">
                <div><strong>{activeTerm}</strong></div>
                <div>Année scolaire {new Date().getFullYear() - 1}–{new Date().getFullYear()}</div>
                <div>Édité le {formatDate(new Date().toISOString())}</div>
              </div>
            </div>

            <div className="bulletin-title">Bulletin de notes</div>

            <div className="bulletin-info">
              <div><span>Élève</span> <strong>{bulletin.studentName}</strong></div>
              <div><span>Matricule</span> <strong>{bulletin.matricule}</strong></div>
              <div><span>Classe</span> <strong>{bulletin.className ?? '—'}</strong></div>
              <div><span>Niveau</span> <strong>{bulletin.level ?? '—'}</strong></div>
            </div>

            <table className="bulletin-table">
              <thead>
                <tr>
                  <th>Matière</th>
                  <th className="num">Note /20</th>
                  <th className="num">Coef.</th>
                  <th className="num">Points</th>
                  <th>Appréciation</th>
                </tr>
              </thead>
              <tbody>
                {bulletinRows.map((row) => (
                  <tr key={row.subject}>
                    <td>{row.subject}</td>
                    <td className="num">{row.score.toFixed(2).replace('.', ',')}</td>
                    <td className="num">{row.coefficient}</td>
                    <td className="num">{(row.score * row.coefficient).toFixed(2).replace('.', ',')}</td>
                    <td>{appreciationOf(row.score).label}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="num">—</td>
                  <td className="num"><strong>{bulletinCoefs}</strong></td>
                  <td className="num"><strong>{bulletinPoints.toFixed(2).replace('.', ',')}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <div className="bulletin-summary">
              <div>Moyenne générale <b>{formatAverage(bulletin.average)}/20</b></div>
              <div>
                Rang <b>{rankOf(bulletin.studentId) ?? '—'}{rankOf(bulletin.studentId) ? ` / ${ranked.length}` : ''}</b>
              </div>
              <div>Mention <b>{bulletin.appreciation}</b></div>
              <div>
                Décision <b>{bulletin.average !== null && bulletin.average >= 10 ? 'Admis(e)' : 'Doit progresser'}</b>
              </div>
            </div>

            <div className="bulletin-sign">
              <div>Le professeur titulaire</div>
              <div>La direction</div>
            </div>
            <div className="bulletin-foot">
              Document généré par School Net Academy · {bulletin.matricule} · {activeTerm} · Notes plafonnées à 20/20
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer la note"
        description={toDelete ? `${toDelete.label} sera retirée du bulletin.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
