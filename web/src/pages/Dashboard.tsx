import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Award, BookOpen, CalendarClock, ClipboardList, GraduationCap,
  Megaphone, TrendingDown, TrendingUp, UserPlus, Users, Wallet, AlertTriangle, School, Bell,
  Building2, Layers, Library, UserCheck, Clock, CreditCard,
} from 'lucide-react';
import { get } from '../lib/api';
import type { DashboardData, Student } from '../lib/types';
import { useAuth } from '../lib/auth';
import { ADMISSION_STATUS, AUDIENCE, PAYMENT_STATUS, ROLE_LABEL, appreciationOf } from '../lib/labels';
import { formatAverage, formatDate, formatMoney, formatNumber, relativeTime, daysUntil } from '../lib/format';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, ProgressBar, StatCard, TableSkeleton } from '../components/ui';
import { LevelBars, MethodDonut, RevenueChart } from '../components/charts';
import { tones } from '../components/tone';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const ACTIVITY_ICON: Record<string, { icon: typeof Wallet; className: string; color: string }> = {
  payment: { icon: Wallet, className: 'amber', color: tones.warning },
  admission: { icon: ClipboardList, className: 'info', color: tones.info },
  student: { icon: UserPlus, className: 'violet', color: tones.violet },
  course: { icon: BookOpen, className: 'primary', color: tones.primary },
};

export function Dashboard() {
  const { user } = useAuth();
  const role = user?.role ?? 'admin';
  const isAdmin = role === 'admin';
  const isParent = role === 'parent';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => get<DashboardData>('/dashboard'),
  });

  const children = useQuery({
    queryKey: ['students', 'children'],
    queryFn: () => get<{ items: Student[] }>('/students'),
    enabled: isParent,
  });

  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const kpis = data?.kpis;

  if (isError) {
    return (
      <>
        <PageHeader title="Tableau de bord" subtitle="Impossible de charger les données." />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Les données n'ont pas pu être chargées"
            description="Vérifiez votre connexion puis réessayez."
            action={<Button variant="primary" onClick={() => refetch()}>Réessayer</Button>}
          />
        </Card>
      </>
    );
  }

  const nextDue = data?.upcomingDues
    ?.filter((due) => due.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

  const totalStudents = children.data?.items.length ?? 0;
  const childrenAverage = (() => {
    const withAverage = (children.data?.items ?? []).filter((s) => s.average !== null && s.average !== undefined);
    if (!withAverage.length) return null;
    return withAverage.reduce((sum, s) => sum + (s.average ?? 0), 0) / withAverage.length;
  })();

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)} · ${data?.term ?? 'Trimestre en cours'}`}
        actions={isAdmin ? (
          <>
            <Link to="/app/eleves?new=1" className="btn btn-secondary"><UserPlus size={15} /> Nouvel élève</Link>
            <Link to="/app/paiements?new=1" className="btn btn-primary"><Wallet size={15} /> Encaisser</Link>
          </>
        ) : undefined}
      />

      <section className="hello-card">
        <h2>{greeting()}, {user?.name.split(' ')[0]} 👋</h2>
        <p>
          {isAdmin && "Voici l'état de l'école aujourd'hui. Les paiements, les admissions et la vie pédagogique sont à jour."}
          {role === 'teacher' && 'Retrouvez vos classes, les résultats du trimestre et vos cours en ligne en un coup d’œil.'}
          {isParent && 'Suivez la scolarité de vos enfants : paiements, moyennes et communications de l’école.'}
        </p>
        <div className="hello-stats">
          <div>
            <div className="v">{isParent ? totalStudents : formatNumber(kpis?.students ?? 0)}</div>
            <div className="l">{isParent ? 'Enfant(s) inscrit(s)' : 'Élèves actifs'}</div>
          </div>
          <div>
            <div className="v">{data?.term ?? '—'}</div>
            <div className="l">Période en cours</div>
          </div>
          <div>
            <div className="v">{formatAverage(isParent ? childrenAverage : kpis?.average ?? null)}<span style={{ fontSize: 12, color: '#8dc2b8' }}>/20</span></div>
            <div className="l">Moyenne générale</div>
          </div>
          {isAdmin && (
            <div>
              <div className="v">{formatNumber(kpis?.admissionsPending ?? 0)}</div>
              <div className="l">Dossiers à traiter</div>
            </div>
          )}
          {isParent && nextDue && (
            <div>
              <div className="v">{formatDate(nextDue.dueDate)}</div>
              <div className="l">Prochaine échéance</div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-4 mt-16">
        {isAdmin && (
          <>
            <StatCard
              label="Élèves actifs" icon={Users} loading={isLoading}
              value={formatNumber(kpis?.students)}
              foot={<><span className="trend up"><ArrowUpRight size={13} /></span><span>+{kpis?.newStudents ?? 0} ce mois-ci</span></>}
            />
            <StatCard
              label="Encaissé (30 jours)" icon={Wallet} tone="amber" loading={isLoading}
              value={formatMoney(kpis?.collected30d, true)}
              foot={kpis?.growth !== null && kpis?.growth !== undefined ? (
                <>
                  <span className={kpis.growth >= 0 ? 'trend up' : 'trend down'}>
                    {kpis.growth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {kpis.growth >= 0 ? '+' : ''}{kpis.growth}%
                  </span>
                  <span>vs 30 j précédents</span>
                </>
              ) : <span>Sur la période</span>}
            />
            <StatCard
              label="Reste à recouvrer" icon={CalendarClock} tone="danger" loading={isLoading}
              value={formatMoney((kpis?.pending ?? 0) + (kpis?.late ?? 0), true)}
              foot={<><span className="trend down">{formatMoney(kpis?.late, true)}</span><span>en retard</span></>}
            />
            <StatCard
              label="Moyenne générale" icon={Award} tone="violet" loading={isLoading}
              value={`${formatAverage(kpis?.average)}/20`}
              foot={<><Badge tone={appreciationOf(kpis?.average ?? null).tone}>{appreciationOf(kpis?.average ?? null).label}</Badge></>}
            />
          </>
        )}

  
      {role === 'teacher' && (
          <>
            <StatCard label="Élèves suivis" icon={Users} loading={isLoading} value={formatNumber(kpis?.students)} foot={<span>Sur l'ensemble des classes</span>} />
            <StatCard label="Classes" icon={School} tone="info" loading={isLoading} value={formatNumber(kpis?.classes)} foot={<span>{kpis?.teachers ?? 0} enseignants actifs</span>} />
            <StatCard label="Cours publiés" icon={BookOpen} tone="amber" loading={isLoading} value={formatNumber(kpis?.courses)} foot={<span>Plateforme en ligne</span>} />
            <StatCard label="Moyenne générale" icon={Award} tone="violet" loading={isLoading} value={`${formatAverage(kpis?.average)}/20`} foot={<Badge tone={appreciationOf(kpis?.average ?? null).tone}>{appreciationOf(kpis?.average ?? null).label}</Badge>} />
          </>
        )}

        {isParent && (
          <>
            <StatCard label="Mes enfants" icon={Users} loading={isLoading} value={formatNumber(totalStudents)} foot={<span>Inscrits cette année</span>} />
            <StatCard label="Moyenne" icon={Award} tone="violet" loading={isLoading} value={`${formatAverage(childrenAverage)}/20`} foot={<Badge tone={appreciationOf(childrenAverage).tone}>{appreciationOf(childrenAverage).label}</Badge>} />
            <StatCard label="Solde restant" icon={Wallet} tone="danger" loading={isLoading} value={formatMoney((kpis?.pending ?? 0) + (kpis?.late ?? 0), true)} foot={<span>Échéances à venir</span>} />
            <StatCard label="Prochaine échéance" icon={CalendarClock} tone="amber" loading={isLoading} value={nextDue ? formatDate(nextDue.dueDate) : 'Aucune'} foot={<span>{nextDue ? formatMoney(nextDue.amount) : 'Tout est réglé'}</span>} />
          </>
        )}
      </div>

      {role !== 'parent' && data && (
        <div className="mt-16">
          <Card>
            <div className="card-head">
              <div>
                <h3>Université & vie scolaire</h3>
                <p className="card-sub">
                  {data.university.faculties} faculté(s) · {data.university.programs} filière(s) ·{' '}
                  {data.university.courseUnits} unité(s) d'enseignement
                </p>
              </div>
              <Link to="/app/filieres" className="small strong" style={{ color: 'var(--primary-700)' }}>
                Gérer
              </Link>
            </div>
            <div className="card-body">
              <div className="grid grid-4">
                <StatCard
                  label="Étudiants"
                  value={formatNumber(data.university.students)}
                  icon={GraduationCap}
                  tone="violet"
                  foot={<span>{data.university.credits} crédits au catalogue</span>}
                />
                <StatCard
                  label="Ouvrages"
                  value={formatNumber(data.university.library.books)}
                  icon={Library}
                  tone="info"
                  foot={<span>{data.university.library.available} exemplaires libres</span>}
                />
                <StatCard
                  label="Prêts en cours"
                  value={formatNumber(data.university.library.activeLoans)}
                  icon={BookOpen}
                  tone="amber"
                  foot={<span>{data.university.library.lateLoans} en retard</span>}
                />
                <StatCard
                  label="Présences du jour"
                  value={data.today.attendance.total
                    ? `${data.today.attendance.present}/${data.today.attendance.total}`
                    : '—'}
                  icon={UserCheck}
                  foot={<span>{data.today.day} · {data.today.attendance.absent} absence(s)</span>}
                />
              </div>
              <div className="row gap-8 wrap mt-16">
                <Link to="/app/facultes"><Button size="sm" variant="secondary" icon={Building2}>Facultés</Button></Link>
                <Link to="/app/unites"><Button size="sm" variant="secondary" icon={Layers}>Unités d'enseignement</Button></Link>
                <Link to="/app/emploi-du-temps"><Button size="sm" variant="secondary" icon={CalendarClock}>Emploi du temps</Button></Link>
                <Link to="/app/presences"><Button size="sm" variant="secondary" icon={UserCheck}>Présences</Button></Link>
                <Link to="/app/cartes"><Button size="sm" variant="secondary" icon={CreditCard}>Cartes scolaires</Button></Link>
                {role === 'admin' && (
                  <Link to="/app/bibliotheque"><Button size="sm" variant="secondary" icon={Library}>Bibliothèque</Button></Link>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {role !== 'parent' && data && (
        <div className="mt-16 dash-cols">
          <Card>
            <div className="card-head">
              <div>
                <h3>Séances de {data.today.day.toLowerCase()}</h3>
                <p className="card-sub">Emploi du temps du jour</p>
              </div>
              <Link to="/app/emploi-du-temps" className="small strong" style={{ color: 'var(--primary-700)' }}>Planning</Link>
            </div>
            <div className="card-body">
              {data.today.schedule.length === 0 && (
                <EmptyState icon={CalendarClock} title="Aucune séance aujourd'hui" description="Le planning reprend au prochain jour ouvré." />
              )}
              {data.today.schedule.map((session) => (
                <div key={session.id} className="list-row">
                  <span className="tag" style={{ minWidth: 82, justifyContent: 'center' }}>
                    <Clock size={11} /> {session.startTime}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="cell-main truncate">{session.title}</div>
                    <div className="cell-sub">
                      {session.className ?? session.programName ?? '—'}
                      {session.room ? ` · ${session.room}` : ''}
                      {session.teacherName ? ` · ${session.teacherName}` : ''}
                    </div>
                  </div>
                  <Badge tone="neutral">{session.kind}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <h3>Vie scolaire</h3>
              <Link to="/app/presences" className="small strong" style={{ color: 'var(--primary-700)' }}>Pointer</Link>
            </div>
            <div className="card-body stack gap-12">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small muted">Taux de présence du jour</span>
                <span className="strong">
                  {data.today.attendance.total
                    ? `${Math.round((data.today.attendance.present / data.today.attendance.total) * 100)}%`
                    : '—'}
                </span>
              </div>
              <ProgressBar
                value={data.today.attendance.total
                  ? Math.round((data.today.attendance.present / data.today.attendance.total) * 100)
                  : 0}
                tone="primary"
              />
              <div className="row gap-16 small muted">
                <span>{data.today.attendance.present} présents</span>
                <span>{data.today.attendance.late} retards</span>
                <span>{data.today.attendance.absent} absents</span>
              </div>
              <div className="tiny muted">
                {data.university.library.lateLoans > 0
                  ? `${data.university.library.lateLoans} ouvrage(s) non rendus à la bibliothèque.`
                  : 'Aucun retard de bibliothèque.'}
              </div>
            </div>
          </Card>
        </div>
      )}


      {isParent && (
        <div className="mt-16">
          <Card>
            <div className="card-head">
              <h3>Mes enfants</h3>
              <Link to="/app/mes-enfants" className="small strong" style={{ color: 'var(--primary-700)' }}>Voir les fiches</Link>
            </div>
            <div className="card-body stack gap-12">
              {children.isLoading && <TableSkeleton rows={2} cols={3} />}
              {!children.isLoading && (children.data?.items ?? []).map((child) => {
                const annualFee = (child.tuitionFee ?? 0) + 25000;
                const progress = annualFee ? Math.min(100, Math.round((child.paidTotal / annualFee) * 100)) : 0;
                return (
                  <div key={child.id} className="row gap-12" style={{ padding: '10px 0', borderBottom: '1px solid #eef2f0' }}>
                    <Avatar name={`${child.firstName} ${child.lastName}`} color={child.gender === 'F' ? '#7c3aed' : '#0f766e'} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong">{child.firstName} {child.lastName}</div>
                      <div className="tiny muted">{child.className ?? 'Non affecté'} · {child.matricule}</div>
                      <div className="progress mt-8" style={{ maxWidth: 260 }}><span style={{ width: `${progress}%` }} /></div>
                    </div>
                    <div className="right">
                      <div className="strong">{child.average !== null && child.average !== undefined ? `${formatAverage(child.average)}/20` : '—'}</div>
                      <div className="tiny muted">{progress}% des frais réglés</div>
                    </div>
                  </div>
                );
              })}
              {!children.isLoading && !(children.data?.items ?? []).length && (
                <EmptyState icon={Users} title="Aucun enfant rattaché" description="Contactez le secrétariat pour associer votre compte à la fiche de votre enfant." />
              )}
            </div>
          </Card>
        </div>
      )}

      {!isParent && (
        <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', gap: 18 }}>
          <Card>
            <div className="card-head">
              <div>
                <h3>Encaissements</h3>
                <p className="card-sub">6 derniers mois · {formatMoney(kpis?.collected, true)} au total</p>
              </div>
              <Badge tone="success" dot>À jour</Badge>
            </div>
            <div className="card-body">
              {isLoading ? <div className="skeleton" style={{ height: 240 }} /> : <RevenueChart data={data?.revenueSeries ?? []} />}
            </div>
          </Card>
          <Card>
            <div className="card-head"><h3>Moyens de paiement</h3></div>
            <div className="card-body">
              {isLoading ? (
                <div className="skeleton" style={{ height: 200 }} />
              ) : data?.paymentMethods?.length ? (
                <MethodDonut data={data.paymentMethods} />
              ) : (
                <EmptyState icon={Wallet} title="Aucun encaissement" description="Les répartitions apparaîtront dès le premier paiement." />
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 18 }}>
        <Card>
          <div className="card-head">
            <div>
              <h3>Activité récente</h3>
              <p className="card-sub">Dernières écritures dans la plateforme</p>
            </div>
            <Link to={isAdmin ? '/app/inscriptions' : '/app/resultats'} className="small strong" style={{ color: 'var(--primary-700)' }}>
              Tout voir <ArrowRight size={13} style={{ verticalAlign: -2 }} />
            </Link>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {isLoading && <TableSkeleton rows={5} cols={3} />}
            {!isLoading && (data?.recentActivity ?? []).map((activity) => {
              const config = ACTIVITY_ICON[activity.kind] ?? ACTIVITY_ICON.payment;
              const Icon = config.icon;
              return (
                <div className="list-row" key={`${activity.kind}-${activity.id}`}>
                  <span className={`activity-dot stat-icon ${config.className}`} style={{ width: 32, height: 32, borderRadius: 9 }}>
                    <Icon size={15} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong truncate" style={{ fontSize: 13 }}>{activity.subject}</div>
                    <div className="tiny muted truncate">{activity.detail}</div>
                  </div>
                  <div className="right">
                    <div className="tiny muted nowrap">{relativeTime(activity.occurred_at)}</div>
                    {activity.kind === 'payment' && (
                      <Badge tone={PAYMENT_STATUS[activity.status]?.tone ?? 'neutral'}>
                        {PAYMENT_STATUS[activity.status]?.label ?? activity.status}
                      </Badge>
                    )}
                    {activity.kind === 'admission' && (
                      <Badge tone={ADMISSION_STATUS[activity.status]?.tone ?? 'neutral'}>
                        {ADMISSION_STATUS[activity.status]?.short ?? activity.status}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="stack gap-16">
          <Card>
            <div className="card-head">
              <h3>Échéances à venir</h3>
              <Link to="/app/paiements" className="small strong" style={{ color: 'var(--primary-700)' }}>Paiements</Link>
            </div>
            <div className="card-body" style={{ paddingTop: 10 }}>
              {isLoading && <TableSkeleton rows={4} cols={3} />}
              {!isLoading && (data?.upcomingDues ?? []).slice(0, 4).map((due) => {
                const days = daysUntil(due.dueDate);
                const late = due.status === 'retard' || (days !== null && days < 0);
                return (
                  <div className="due-row" key={due.id}>
                    <Avatar name={due.studentName} size="sm" color={late ? '#bf3527' : '#0f766e'} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong truncate" style={{ fontSize: 12.5 }}>{due.studentName}</div>
                      <div className="tiny muted">{due.className ?? '—'} · {formatDate(due.dueDate)}</div>
                    </div>
                    <div className="right">
                      <div className="strong nowrap" style={{ fontSize: 12.5 }}>{formatMoney(due.amount, true)}</div>
                      <Badge tone={late ? 'danger' : 'warning'}>{late ? 'En retard' : days === null ? 'À venir' : `dans ${days} j`}</Badge>
                    </div>
                  </div>
                );
              })}
              {!isLoading && !(data?.upcomingDues ?? []).length && (
                <EmptyState icon={CalendarClock} title="Aucune échéance" description="Tous les paiements sont réglés." />
              )}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>Annonces</h3>
              <Link to="/app/annonces" className="small strong" style={{ color: 'var(--primary-700)' }}>Voir</Link>
            </div>
            <div className="card-body" style={{ paddingTop: 10 }}>
              {isLoading && <TableSkeleton rows={2} cols={2} />}
              {(data?.announcements ?? []).map((announcement) => (
                <div key={announcement.id} style={{ padding: '10px 0', borderBottom: '1px solid #eef2f0' }}>
                  <div className="row gap-8" style={{ marginBottom: 3 }}>
                    <Bell size={13} style={{ color: 'var(--primary)' }} />
                    <span className="strong truncate" style={{ fontSize: 12.5 }}>{announcement.title}</span>
                  </div>
                  <div className="tiny muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {announcement.body}
                  </div>
                  <div className="tiny muted mt-4">
                    {AUDIENCE[announcement.audience]?.label} · {relativeTime(announcement.publishedAt)}
                  </div>
                </div>
              ))}
              {!isLoading && !(data?.announcements ?? []).length && (
                <EmptyState icon={Megaphone} title="Aucune annonce" description="Les communications publiées apparaîtront ici." />
              )}
            </div>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18 }}>
          <Card>
            <div className="card-head">
              <div>
                <h3>Répartition par niveau</h3>
                <p className="card-sub">Élèves actifs par classe</p>
              </div>
              <Link to="/app/classes" className="small strong" style={{ color: 'var(--primary-700)' }}>Classes</Link>
            </div>
            <div className="card-body">
              {isLoading ? <div className="skeleton" style={{ height: 210 }} /> : <LevelBars data={data?.studentsByLevel ?? []} />}
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <h3>Classes les plus remplies</h3>
              <Link to="/app/classes" className="small strong" style={{ color: 'var(--primary-700)' }}>Gérer</Link>
            </div>
            <div className="card-body">
              {isLoading && <TableSkeleton rows={4} cols={3} />}
              {(data?.topClasses ?? []).map((cls) => (
                <div className="list-row" key={cls.id}>
                  <span className="stat-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
                    <GraduationCap size={15} />
                  </span>
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 13 }}>{cls.name}</div>
                    <div className="tiny muted">{cls.level} · {formatMoney(cls.collected, true)} encaissés</div>
                  </div>
                  <div className="row gap-8" style={{ minWidth: 120 }}>
                    <div className="progress grow"><span style={{ width: `${Math.min(100, (cls.studentCount / 35) * 100)}%` }} /></div>
                    <span className="tiny muted nowrap">{cls.studentCount} él.</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}


      {role !== 'parent' && data && (
        <div className="mt-16">
          <Card>
            <div className="card-head">
              <div>
                <h3>Université & vie scolaire</h3>
                <p className="card-sub">
                  {data.university.faculties} faculté(s) · {data.university.programs} filière(s) ·{' '}
                  {data.university.courseUnits} unité(s) d'enseignement
                </p>
              </div>
              <Link to="/app/filieres" className="small strong" style={{ color: 'var(--primary-700)' }}>
                Gérer
              </Link>
            </div>
            <div className="card-body">
              <div className="grid grid-4">
                <StatCard
                  label="Étudiants"
                  value={formatNumber(data.university.students)}
                  icon={GraduationCap}
                  tone="violet"
                  foot={<span>{data.university.credits} crédits au catalogue</span>}
                />
                <StatCard
                  label="Ouvrages"
                  value={formatNumber(data.university.library.books)}
                  icon={Library}
                  tone="info"
                  foot={<span>{data.university.library.available} exemplaires libres</span>}
                />
                <StatCard
                  label="Prêts en cours"
                  value={formatNumber(data.university.library.activeLoans)}
                  icon={BookOpen}
                  tone="amber"
                  foot={<span>{data.university.library.lateLoans} en retard</span>}
                />
                <StatCard
                  label="Présences du jour"
                  value={data.today.attendance.total
                    ? `${data.today.attendance.present}/${data.today.attendance.total}`
                    : '—'}
                  icon={UserCheck}
                  foot={<span>{data.today.day} · {data.today.attendance.absent} absence(s)</span>}
                />
              </div>
              <div className="row gap-8 wrap mt-16">
                <Link to="/app/facultes"><Button size="sm" variant="secondary" icon={Building2}>Facultés</Button></Link>
                <Link to="/app/unites"><Button size="sm" variant="secondary" icon={Layers}>Unités d'enseignement</Button></Link>
                <Link to="/app/emploi-du-temps"><Button size="sm" variant="secondary" icon={CalendarClock}>Emploi du temps</Button></Link>
                <Link to="/app/presences"><Button size="sm" variant="secondary" icon={UserCheck}>Présences</Button></Link>
                <Link to="/app/cartes"><Button size="sm" variant="secondary" icon={CreditCard}>Cartes scolaires</Button></Link>
                {role === 'admin' && (
                  <Link to="/app/bibliotheque"><Button size="sm" variant="secondary" icon={Library}>Bibliothèque</Button></Link>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {role !== 'parent' && data && (
        <div className="mt-16 dash-cols">
          <Card>
            <div className="card-head">
              <div>
                <h3>Séances de {data.today.day.toLowerCase()}</h3>
                <p className="card-sub">Emploi du temps du jour</p>
              </div>
              <Link to="/app/emploi-du-temps" className="small strong" style={{ color: 'var(--primary-700)' }}>Planning</Link>
            </div>
            <div className="card-body">
              {data.today.schedule.length === 0 && (
                <EmptyState icon={CalendarClock} title="Aucune séance aujourd'hui" description="Le planning reprend au prochain jour ouvré." />
              )}
              {data.today.schedule.map((session) => (
                <div key={session.id} className="list-row">
                  <span className="tag" style={{ minWidth: 82, justifyContent: 'center' }}>
                    <Clock size={11} /> {session.startTime}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="cell-main truncate">{session.title}</div>
                    <div className="cell-sub">
                      {session.className ?? session.programName ?? '—'}
                      {session.room ? ` · ${session.room}` : ''}
                      {session.teacherName ? ` · ${session.teacherName}` : ''}
                    </div>
                  </div>
                  <Badge tone="neutral">{session.kind}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <h3>Vie scolaire</h3>
              <Link to="/app/presences" className="small strong" style={{ color: 'var(--primary-700)' }}>Pointer</Link>
            </div>
            <div className="card-body stack gap-12">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small muted">Taux de présence du jour</span>
                <span className="strong">
                  {data.today.attendance.total
                    ? `${Math.round((data.today.attendance.present / data.today.attendance.total) * 100)}%`
                    : '—'}
                </span>
              </div>
              <ProgressBar
                value={data.today.attendance.total
                  ? Math.round((data.today.attendance.present / data.today.attendance.total) * 100)
                  : 0}
                tone="primary"
              />
              <div className="row gap-16 small muted">
                <span>{data.today.attendance.present} présents</span>
                <span>{data.today.attendance.late} retards</span>
                <span>{data.today.attendance.absent} absents</span>
              </div>
              <div className="tiny muted">
                {data.university.library.lateLoans > 0
                  ? `${data.university.library.lateLoans} ouvrage(s) non rendus à la bibliothèque.`
                  : 'Aucun retard de bibliothèque.'}
              </div>
            </div>
          </Card>
        </div>
      )}

      {role === 'teacher' && (
        <div className="mt-16">
          <Card>
            <div className="card-head"><h3>Répartition par niveau</h3></div>
            <div className="card-body">
              {isLoading ? <div className="skeleton" style={{ height: 210 }} /> : <LevelBars data={data?.studentsByLevel ?? []} />}
            </div>
          </Card>
        </div>
      )}

      <div className="tiny muted mt-16">
        Connecté en tant que <strong>{ROLE_LABEL[role]}</strong> · {user?.email}
      </div>
    </>
  );
}
