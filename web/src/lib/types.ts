export type Role = 'admin' | 'teacher' | 'parent';

export type PlatformRole = 'owner' | 'manager' | 'support' | 'finance' | 'marketing' | 'closer';

export interface TenantSummary {
  id: string;
  name: string;
  kind: 'ecole' | 'universite' | 'mixte' | string;
  country: string;
  countryCode: string;
  currency: string;
  email?: string | null;
  phone?: string | null;
  status: 'essai' | 'actif' | 'expire' | 'suspendu' | string;
  plan?: string | null;
  seats?: number | null;
  trialEndsAt?: string | null;
  createdAt?: string | null;
  access?: AccessState;
}

export interface AccessState {
  status: 'essai' | 'essai_expire' | 'actif' | 'expire' | 'suspendu' | string;
  blocked: boolean;
  daysLeft: number | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  title?: string | null;
  avatarColor?: string | null;
  platformRole?: PlatformRole | null;
  tenantId?: string | null;
  tenant?: TenantSummary | null;
  access?: AccessState | null;
}

export type StudentStatus = 'actif' | 'suspendu' | 'diplome' | 'parti';

export interface Student {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: 'F' | 'M';
  birthDate?: string | null;
  classId?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  address?: string | null;
  status: StudentStatus;
  enrolledAt?: string | null;
  notes?: string | null;
  className?: string | null;
  level?: string | null;
  tuitionFee?: number | null;
  paidTotal: number;
  average?: number | null;
  studentType?: 'eleve' | 'etudiant';
  programId?: string | null;
  programName?: string | null;
  academicLevel?: string | null;
  programFee?: number | null;
}

export interface Payment {
  id: string;
  reference: string;
  studentId?: string;
  studentName?: string;
  firstName?: string;
  lastName?: string;
  matricule?: string;
  className?: string | null;
  amount: number;
  currency?: string;
  type: string;
  method: string;
  status: 'paye' | 'en_attente' | 'retard' | 'rembourse';
  paidAt?: string | null;
  dueDate?: string | null;
  term?: string | null;
  note?: string | null;
}

export interface ClassRoom {
  id: string;
  name: string;
  level: string;
  room?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  capacity: number;
  tuitionFee: number;
  schedule?: string | null;
  studentCount: number;
  collected?: number;
  average?: number | null;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  subject: string;
  status: 'actif' | 'conge' | 'parti';
  hiredAt?: string | null;
  notes?: string | null;
  classCount?: number;
  courseCount?: number;
}

export interface Admission {
  id: string;
  reference: string;
  studentName: string;
  birthDate?: string | null;
  gender: 'F' | 'M';
  level: string;
  guardianName: string;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  previousSchool?: string | null;
  status: 'en_attente' | 'en_revue' | 'acceptee' | 'refusee' | 'inscrite';
  source?: string | null;
  submittedAt: string;
  decisionAt?: string | null;
  notes?: string | null;
}

export interface Course {
  id: string;
  title: string;
  subject: string;
  level: string;
  teacherId?: string | null;
  teacherName?: string | null;
  status: 'publie' | 'brouillon' | 'archive';
  lessonsCount: number;
  durationHours: number;
  enrolledCount: number;
  description?: string | null;
  color?: string | null;
  createdAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'tous' | 'parents' | 'enseignants' | 'eleves';
  status: 'publie' | 'brouillon';
  publishedAt?: string | null;
  createdAt?: string;
  authorName?: string | null;
  authorColor?: string | null;
}

export interface Grade {
  id: string;
  studentId?: string;
  studentName?: string;
  subject: string;
  term: string;
  score: number;
  coefficient: number;
  comment?: string | null;
  evaluatedAt?: string | null;
  teacherName?: string | null;
}

export interface Meta {
  classes: (Pick<ClassRoom, 'id' | 'name' | 'level' | 'capacity' | 'tuitionFee'> & { studentCount: number })[];
  teachers: { id: string; name: string; subject: string; status: string }[];
  students: {
    id: string; name: string; matricule: string; classId: string | null; className: string | null;
    status: string; studentType?: string; programId?: string | null; programName?: string | null;
    academicLevel?: string | null;
  }[];
  subjects: string[];
  levels: string[];
  terms: string[];
  currentTerm: string;
  paymentTypes: string[];
  paymentMethods: string[];
  admissionSources: string[];
  faculties: { id: string; name: string; code: string }[];
  programs: {
    id: string; name: string; code: string; degree: string; facultyId: string;
    facultyName?: string | null; tuitionFee: number; totalCredits: number; studentCount: number;
  }[];
  degrees: string[];
  academicLevels: string[];
  days: string[];
  attendanceSessions: string[];
  scheduleKinds: string[];
  school?: { name: string; title?: string } | null;
}

export interface ListResponse<T> {
  items: T[];
  stats?: Record<string, number>;
}

export interface DashboardData {
  role: Role;
  term: string;
  kpis: {
    students: number; newStudents: number; teachers: number; classes: number; courses: number;
    collected: number; pending: number; late: number; collected30d: number; payments30d: number;
    growth: number | null; admissionsPending: number; average: number | null; transactions: number;
    universityStudents: number; programs: number; courseUnits: number; credits: number;
  };
  university: {
    faculties: number; programs: number; students: number; courseUnits: number; credits: number;
    library: { books: number; copies: number; available: number; activeLoans: number; lateLoans: number };
  };
  today: {
    day: string;
    schedule: {
      id: string; title: string; room?: string | null; day: string; startTime: string; endTime: string;
      kind: string; className?: string | null; programName?: string | null; teacherName?: string | null;
    }[];
    attendance: { date: string; total: number; present: number; absent: number; late: number };
  };
  revenueSeries: { month: string; total: number }[];
  studentsByLevel: { level: string; total: number }[];
  paymentMethods: { method: string; total: number; count: number }[];
  admissions: Record<string, number>;
  recentActivity: {
    kind: string; id: string; subject: string; detail: string; status: string;
    created_at: string; occurred_at: string; at?: string;
  }[];
  upcomingDues: {
    id: string; reference: string; amount: number; dueDate?: string | null; status: string;
    type: string; studentName: string; studentId: string; className?: string | null;
  }[];
  topClasses: { id: string; name: string; level: string; studentCount: number; collected: number }[];
  announcements: { id: string; title: string; body: string; audience: string; publishedAt?: string | null; authorName?: string | null }[];
}

export interface StudentDetail {
  student: Student & {
    annualFee: number; outstanding: number; guardian_user_id?: string | null;
    mainTeacher?: string | null; facultyName?: string | null; degree?: string | null;
    programFee?: number | null;
  };
  payments: Payment[];
  grades: Grade[];
  averages: { term: string; average: number | null; subjects: { subject: string; average: number; count: number; coefficient: number }[] }[];
}

export interface ResultRow {
  studentId: string;
  studentName: string;
  matricule: string;
  className?: string | null;
  level?: string | null;
  subjects: Record<string, { id: string; score: number; coefficient: number; comment?: string | null }>;
  average: number | null;
  appreciation: string;
}

/* ----------------------------- Université ------------------------------- */

export interface Faculty {
  id: string;
  name: string;
  code: string;
  dean?: string | null;
  building?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  programCount: number;
  unitCount: number;
  studentCount: number;
}

export type Degree = 'Licence' | 'Master' | 'Doctorat' | 'BTS' | 'Certificat';

export interface Program {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  facultyName?: string | null;
  facultyCode?: string | null;
  degree: Degree;
  durationYears: number;
  totalCredits: number;
  tuitionFee: number;
  status: 'ouverte' | 'fermee' | 'brouillon';
  description?: string | null;
  studentCount: number;
  unitCount: number;
  creditedUnits: number;
}

export interface CourseUnit {
  id: string;
  programId: string;
  programName?: string | null;
  facultyCode?: string | null;
  degree?: string | null;
  code: string;
  title: string;
  semester: number;
  credits: number;
  hours: number;
  teacherId?: string | null;
  teacherName?: string | null;
  description?: string | null;
  status: 'actif' | 'archive';
}

export interface Schedule {
  id: string;
  title: string;
  classId?: string | null;
  className?: string | null;
  programId?: string | null;
  programName?: string | null;
  degree?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
  day: string;
  startTime: string;
  endTime: string;
  kind: 'Cours' | 'TD' | 'TP' | 'Examen' | 'Soutenance';
}

export interface Book {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  copiesTotal: number;
  copiesAvailable: number;
  shelf?: string | null;
  activeLoans: number;
}

export interface Loan {
  id: string;
  bookId: string;
  studentId: string;
  bookTitle: string;
  bookAuthor?: string | null;
  studentName: string;
  firstName: string;
  lastName: string;
  matricule: string;
  className?: string | null;
  programName?: string | null;
  loanedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  status: 'en_cours' | 'rendu' | 'retard';
  late?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  firstName: string;
  lastName: string;
  matricule: string;
  classId?: string | null;
  className?: string | null;
  programId?: string | null;
  programName?: string | null;
  date: string;
  session?: string | null;
  status: 'present' | 'absent' | 'retard' | 'excuse';
  note?: string | null;
}

/* ------------------------- Cartes scolaires / pointage ------------------------- */

export interface SchoolCard {
  studentId: string;
  firstName: string;
  lastName: string;
  matricule: string;
  gender: 'F' | 'M';
  birthDate?: string | null;
  status: StudentStatus;
  studentType?: 'eleve' | 'etudiant' | null;
  academicLevel?: string | null;
  cardCode: string | null;
  nfcTag: string | null;
  issuedAt: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  classId?: string | null;
  className?: string | null;
  level?: string | null;
  programId?: string | null;
  programName?: string | null;
  age?: number | null;
  schoolName: string;
  schoolShort: string;
  city: string;
  schoolYear: string;
  validUntil: string;
  scanPath: string | null;
}

export interface CardAttendance {
  id: string;
  date: string;
  session: string | null;
  status: 'present' | 'absent' | 'retard' | 'excuse';
  note?: string | null;
  createdAt: string;
}

export interface CardsResponse {
  items: SchoolCard[];
  date: string;
  stats: { total: number; issued: number; missing: number; nfc: number; scansToday: number };
}

export interface CardScanResult {
  card: SchoolCard;
  attendance: CardAttendance | null;
  alreadyMarked: boolean;
  previousStatus?: string | null;
}

/* ------------------------------ Plateforme ------------------------------- */

export interface Plan {
  id: 'essentiel' | 'pro' | 'universite' | string;
  name: string;
  priceFcfa: number;
  price?: number;
  currency?: string;
  localPrice?: number;
  localCurrency?: string;
  period: string;
  tagline: string;
  features: string[];
  seats: number;
  popular?: boolean;
  trialDays: number;
}

export interface CatalogResponse {
  plans: Plan[];
  trialDays: number;
  baseCurrency: string;
  rates?: Record<string, number>;
  currencies?: string[];
}

export interface SubscriptionInvoice {
  id: string;
  reference: string;
  tenantId?: string;
  tenantName?: string;
  tenantCountry?: string;
  plan: string;
  amount: number;
  amountFcfa?: number | null;
  currency: string;
  method: string;
  status: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt: string;
}

export interface BillingResponse {
  tenant: TenantSummary | null;
  access: AccessState;
  plans: Plan[];
  invoices: SubscriptionInvoice[];
  currency?: string;
  baseCurrency?: string;
  rates?: Record<string, number>;
}

export interface PlatformOverview {
  kpis: {
    tenants: number;
    actifs: number;
    essais: number;
    bloques: number;
    mrr: number;
    revenue: number;
    revenue30d: number;
    subscribers: number;
    staff: number;
  };
  trials: TenantSummary[];
  tenants: TenantSummary[];
  invoices: SubscriptionInvoice[];
  staff: { id: string; name: string; email: string; platformRole: PlatformRole }[];
}

export interface PlatformTenant extends TenantSummary {
  owner?: { name: string; email: string } | null;
  users?: number;
  lastSubscription?: { reference: string; amount: number; plan: string; createdAt: string; periodEnd: string } | null;
}

export interface PlatformStaff {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  avatarColor?: string | null;
  platformRole: PlatformRole;
  lastLoginAt?: string | null;
  createdAt: string;
  active?: boolean;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string | null;
  countryCode?: string | null;
  source?: string | null;
  status: 'actif' | 'desinscrit' | string;
  createdAt: string;
}

export interface NewsletterCampaign {
  id: string;
  subject: string;
  body: string;
  audience: string;
  status: 'brouillon' | 'envoyee' | string;
  recipients: number;
  sentAt?: string | null;
  createdAt: string;
}

export interface SmsMessage {
  id: string;
  to: string;
  body: string;
  status: 'envoye' | 'simule' | 'echec' | string;
  provider?: string | null;
  error?: string | null;
  createdAt: string;
  sentAt?: string | null;
}
