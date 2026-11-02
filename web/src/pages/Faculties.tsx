import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Building2, GraduationCap, Users, Layers, BookOpen, Mail, Phone, AlertTriangle,
} from 'lucide-react';
import { del, get, patch, post, ApiError } from '../lib/api';
import type { Faculty } from '../lib/types';
import { useAuth } from '../lib/auth';
import { DEGREE_TONE, PROGRAM_STATUS, labelOf, toneOf } from '../lib/labels';
import { formatMoney } from '../lib/format';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, StatCard, TableSkeleton, Textarea,
} from '../components/ui';
import { ConfirmDialog, Drawer, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

type FormState = {
  name: string; code: string; dean: string; building: string; phone: string; email: string; description: string;
};

const emptyForm: FormState = { name: '', code: '', dean: '', building: '', phone: '', email: '', description: '' };

export function Faculties() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Faculty | null>(null);
  const [detail, setDetail] = useState<Faculty | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => get<{ items: Faculty[]; stats: Record<string, number> }>('/faculties'),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(faculty: Faculty) {
    setEditing(faculty);
    setForm({
      name: faculty.name, code: faculty.code, dean: faculty.dean ?? '', building: faculty.building ?? '',
      phone: faculty.phone ?? '', email: faculty.email ?? '', description: faculty.description ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => (
      editing ? patch(`/faculties/${editing.id}`, payload) : post('/faculties', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Faculté mise à jour' : 'Faculté créée', form.name);
      setFormOpen(false);
    },
    onError: (error: ApiError) => setFormError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/faculties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
      toast.success('Faculté supprimée');
      setToDelete(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  function submit() {
    if (form.name.trim().length < 3 || form.code.trim().length < 2) {
      setFormError('Le nom et le sigle de la faculté sont obligatoires.');
      return;
    }
    saveMutation.mutate(form);
  }

  const items = data?.items ?? [];
  const stats = data?.stats ?? {};

  return (
    <>
      <PageHeader
        title="Facultés"
        subtitle="Structures universitaires, doyens et filières rattachées."
        actions={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvelle faculté</Button> : undefined}
      />

      <div className="grid grid-4">
        <StatCard label="Facultés" value={stats.total ?? 0} icon={Building2} loading={isLoading} foot={<span>Université School Net</span>} />
        <StatCard label="Filières" value={stats.programs ?? 0} icon={Layers} tone="info" loading={isLoading} foot={<span>Licence, Master, Doctorat</span>} />
        <StatCard label="Étudiants" value={stats.students ?? 0} icon={Users} tone="violet" loading={isLoading} foot={<span>Inscrits actifs</span>} />
        <StatCard label="Unités d'enseignement" value={items.reduce((sum, faculty) => sum + faculty.unitCount, 0)} icon={BookOpen} tone="amber" loading={isLoading} foot={<span>Toutes facultés</span>} />
      </div>

      {isLoading && <Card className="mt-16"><TableSkeleton rows={4} cols={3} /></Card>}

      {isError && (
        <Card className="mt-16">
          <EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => refetch()}>Réessayer</Button>} />
        </Card>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <Card className="mt-16">
          <EmptyState
            icon={Building2}
            title="Aucune faculté"
            description="Créez la première faculté pour organiser les filières et les unités d'enseignement."
            action={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreate}>Créer une faculté</Button> : undefined}
          />
        </Card>
      )}

      <div className="grid grid-2 mt-16">
        {items.map((faculty) => (
          <Card key={faculty.id} className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                <span className="stat-icon" style={{ width: 42, height: 42, borderRadius: 12, flex: 'none' }}>
                  <Building2 size={19} />
                </span>
                <div>
                  <div className="row gap-8 wrap">
                    <h3 className="card-title">{faculty.name}</h3>
                    <Badge tone="primary">{faculty.code}</Badge>
                  </div>
                  <div className="small muted mt-4">
                    {faculty.dean ? `Doyen : ${faculty.dean}` : 'Doyen à désigner'} · {faculty.building ?? 'Bâtiment non défini'}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="actions" style={{ opacity: 1 }}>
                  <IconButton icon={Pencil} label="Modifier" onClick={() => openEdit(faculty)} />
                  <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(faculty)} />
                </div>
              )}
            </div>

            {faculty.description && <p className="small muted">{faculty.description}</p>}

            <div className="row gap-16 wrap">
              <span className="tag"><Layers size={12} /> {faculty.programCount} filière(s)</span>
              <span className="tag"><BookOpen size={12} /> {faculty.unitCount} UE</span>
              <span className="tag"><Users size={12} /> {faculty.studentCount} étudiant(s)</span>
            </div>

            <div className="row gap-8 wrap">
              {faculty.phone && <span className="tiny muted row gap-4"><Phone size={11} /> {faculty.phone}</span>}
              {faculty.email && <span className="tiny muted row gap-4"><Mail size={11} /> {faculty.email}</span>}
              <Button size="sm" variant="ghost" className="grow" style={{ marginLeft: 'auto' }} onClick={() => setDetail(faculty)}>
                Voir les filières
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la faculté' : 'Créer une faculté'}
        description="Les filières et unités d'enseignement y seront rattachées."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Créer la faculté'}
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
          <Field label="Nom" htmlFor="fName" className="span-2">
            <Input id="fName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Faculté des Sciences et Techniques" />
          </Field>
          <Field label="Sigle" htmlFor="fCode">
            <Input id="fCode" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="FST" />
          </Field>
          <Field label="Doyen" htmlFor="fDean">
            <Input id="fDean" value={form.dean} onChange={(event) => setForm({ ...form, dean: event.target.value })} placeholder="Dr Prosper Mbemba" />
          </Field>
          <Field label="Bâtiment" htmlFor="fBuilding">
            <Input id="fBuilding" value={form.building} onChange={(event) => setForm({ ...form, building: event.target.value })} placeholder="Bâtiment A" />
          </Field>
          <Field label="Téléphone" htmlFor="fPhone">
            <Input id="fPhone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+242 06 000 00 00" />
          </Field>
          <Field label="E-mail" htmlFor="fEmail" className="span-2">
            <Input id="fEmail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="secretariat.fst@schoolnet.academy" />
          </Field>
          <Field label="Description" htmlFor="fDesc" className="span-2">
            <Textarea id="fDesc" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Domaines couverts par la faculté…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        loading={deleteMutation.isPending}
        title="Supprimer la faculté"
        description={toDelete ? `${toDelete.name} sera supprimée. Les facultés contenant des filières ne peuvent pas être supprimées.` : ''}
        confirmLabel="Supprimer"
      />

      <FacultyDrawer faculty={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function FacultyDrawer({ faculty, onClose }: { faculty: Faculty | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['faculty', faculty?.id],
    queryFn: () => get<{ faculty: Faculty; programs: any[] }>(`/faculties/${faculty?.id}`),
    enabled: Boolean(faculty?.id),
  });

  return (
    <Drawer open={Boolean(faculty)} onClose={onClose} label="Détail de la faculté">
      <div className="drawer-head">
        <span className="stat-icon" style={{ width: 46, height: 46, borderRadius: 13 }}><Building2 size={20} /></span>
        <div className="grow">
          <h2 style={{ fontSize: 17 }}>{faculty?.name}</h2>
          <div className="small muted mt-4">{faculty?.code} · {faculty?.studentCount} étudiant(s)</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><span style={{ fontSize: 18 }}>×</span></button>
      </div>
      <div className="drawer-body">
        {isLoading && <TableSkeleton rows={4} cols={3} />}
        {(data?.programs ?? []).map((program) => (
          <Card key={program.id} className="card-pad">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="row gap-8">
                  <strong style={{ fontSize: 14 }}>{program.name}</strong>
                  <Badge tone={DEGREE_TONE[program.degree] ?? 'primary'}>{program.degree}</Badge>
                </div>
                <div className="tiny muted mt-4">
                  {program.unitCount} UE · {program.studentCount} étudiant(s) · {formatMoney(program.tuitionFee)} / an
                </div>
              </div>
              <Badge tone={toneOf(PROGRAM_STATUS, program.status)}>{labelOf(PROGRAM_STATUS, program.status)}</Badge>
            </div>
            <div className="row gap-16 mt-8 tiny muted">
              <span className="row gap-4"><GraduationCap size={12} /> {program.durationYears} ans</span>
              <span className="row gap-4"><Layers size={12} /> {program.totalCredits} crédits</span>
            </div>
          </Card>
        ))}
        {!isLoading && !(data?.programs ?? []).length && (
          <Card><EmptyState icon={Layers} title="Aucune filière" description="Cette faculté n'accueille encore aucune filière." /></Card>
        )}
      </div>
    </Drawer>
  );
}
