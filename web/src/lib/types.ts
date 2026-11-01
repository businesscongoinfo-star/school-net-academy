export type Role = 'admin' | 'teacher' | 'parent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  title?: string | null;
  avatarColor?: string | null;
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
  students: { id: string; name: string; matricule: string; classId: string | null; className: string | null; status: string }[];
  subjects: string[];
  levels: string[];
  terms: string[];
  currentTerm: string;
  paymentTypes: string[];
  paymentMethods: string[];
  admissionSources: string[];
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
  student: Student & { annualFee: number; outstanding: number; guardian_user_id?: string | null; mainTeacher?: string | null };
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
