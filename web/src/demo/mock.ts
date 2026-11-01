/**
 * API simulée pour la démo statique (GitHub Pages).
 *
 * Le serveur Express/SQLite n'est pas disponible sur un hébergement statique : ce module
 * rejoue les mêmes routes à partir d'un instantané de données (`public/demo/snapshot.json`)
 * et applique les écritures en mémoire (elles disparaissent au rechargement de la page).
 */
import type { User } from '../lib/types';

type Json = Record<string, any>;

const SESSION_KEY = 'sna-demo-session';
const ACCOUNTS: Record<string, User['role']> = {
  'direction@schoolnet.academy': 'admin',
  'prof.mbemba@schoolnet.academy': 'teacher',
  'parent.ondongo@schoolnet.academy': 'parent',
};

let snapshotPromise: Promise<Json> | null = null;

async function loadSnapshot(): Promise<Json> {
  if (!snapshotPromise) {
    // Chemin relatif au document : fonctionne aussi bien à la racine que sous /school-net-academy/.
    const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
    snapshotPromise = fetch(new URL('demo/snapshot.json', base)).then((res) => {
      if (!res.ok) throw new Error("Instantané de démonstration introuvable.");
      return res.json();
    });
  }
  return snapshotPromise;
}

let state: Json | null = null;

async function ready(): Promise<Json> {
  if (!state) {
    state = structuredClone(await loadSnapshot());
  }
  return state as Json;
}

function role(): User['role'] | null {
  const value = localStorage.getItem(SESSION_KEY);
  if (value === null) {
    localStorage.setItem(SESSION_KEY, 'admin');
    return 'admin';
  }
  if (value === 'out') return null;
  return value as User['role'];
}

function currentUser(data: Json): User | null {
  const active = role();
  return active ? (data.users[active] as User) : null;
}

function fail(status: number, message: string): never {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  throw error;
}

const wait = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });
const uid = (prefix: string) => `${prefix}_demo${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------- utilitaires ------------------------------ */

function filterBy(items: Json[], query: URLSearchParams, rules: Record<string, (item: Json, value: string) => boolean>) {
  let result = items;
  for (const [key, predicate] of Object.entries(rules)) {
    const value = query.get(key);
    if (!value) continue;
    result = result.filter((item) => predicate(item, value));
  }
  return result;
}

const contains = (value: unknown, needle: string) => String(value ?? '').toLowerCase().includes(needle.toLowerCase());
const anyContains = (item: Json, needle: string, fields: string[]) => fields.some((field) => contains(item[field], needle));

export function demoUserLabel(): string {
  return role() ?? 'out';
}

/* -------------------------------- requêtes -------------------------------- */

export async function demoRequest<T>(method: string, rawPath: string, body?: unknown): Promise<T> {
  const data = await ready();
  await wait(60 + Math.random() * 90);

  const [path, search = ''] = rawPath.split('?');
  const query = new URLSearchParams(search);
  const segments = path.split('/').filter(Boolean);
  const [root, id, extra] = segments;

  /* ------------------------------- session ------------------------------- */

  if (root === 'auth') {
    if (id === 'me' && method === 'GET') {
      const user = currentUser(data);
      if (!user) fail(401, 'Session expirée.');
      return { user } as T;
    }
    if (id === 'login' && method === 'POST') {
      const payload = (body ?? {}) as { email?: string; password?: string };
      const email = String(payload.email ?? '').trim().toLowerCase();
      const target = ACCOUNTS[email];
      if (!target) fail(401, 'Compte de démonstration inconnu. Utilisez un des trois comptes proposés.');
      if (String(payload.password ?? '').length < 4) fail(401, 'Mot de passe trop court (démo : demo1234).');
      localStorage.setItem(SESSION_KEY, target);
      return { user: data.users[target] } as T;
    }
    if (id === 'logout' && method === 'POST') {
      localStorage.setItem(SESSION_KEY, 'out');
      return { ok: true } as T;
    }
    if (id === 'profile' && (method === 'PATCH' || method === 'POST')) {
      const user = currentUser(data);
      if (!user) fail(401, 'Session expirée.');
      const payload = (body ?? {}) as Json;
      Object.assign(user, {
        name: payload.name ?? user.name,
        email: payload.email ?? user.email,
        phone: payload.phone ?? (user as Json).phone,
      });
      return { user } as T;
    }
    if (id === 'password') return { ok: true } as T;
    fail(404, 'Route inconnue.');
  }

  const user = currentUser(data);
  if (!user) fail(401, 'Session expirée.');
  const activeRole = role() as User['role'];
  const views = data.roles[activeRole];

  /* ------------------------------ lectures ------------------------------- */

  if (method === 'GET') {
    switch (root) {
      case 'meta':
        return data.meta as T;

      case 'dashboard':
        return views.dashboard as T;

      case 'students': {
        if (!id) {
          const items = filterBy(views.students.items, query, {
            search: (item, value) => anyContains(item, value, ['firstName', 'lastName', 'matricule', 'guardianName', 'programName']),
            classId: (item, value) => item.classId === value,
            status: (item, value) => item.status === value,
            type: (item, value) => (item.studentType ?? 'eleve') === value,
            programId: (item, value) => item.programId === value,
          });
          return { ...views.students, items } as T;
        }
        const detail = data.studentDetails[id];
        if (detail) return detail as T;
        const student = views.students.items.find((item: Json) => item.id === id);
        if (!student) fail(404, 'Élève introuvable.');
        return {
          student: { ...student, annualFee: (student.tuitionFee ?? 0) + 25000, outstanding: 0 },
          payments: views.payments.items.filter((item: Json) => item.studentId === id),
          grades: [],
          averages: [],
        } as T;
      }

      case 'classes': {
        if (!id) return data.classes as T;
        const detail = data.classDetails[id];
        if (!detail) fail(404, 'Classe introuvable.');
        return detail as T;
      }

      case 'teachers':
        return {
          ...data.teachers,
          items: filterBy(data.teachers.items, query, {
            search: (item, value) => anyContains(item, value, ['name', 'firstName', 'lastName', 'subject', 'phone', 'email']),
            status: (item, value) => item.status === value,
          }),
        } as T;

      case 'admissions':
        return {
          ...data.admissions,
          items: filterBy(data.admissions.items, query, {
            search: (item, value) => anyContains(item, value, ['name', 'firstName', 'lastName', 'phone', 'email', 'level']),
            status: (item, value) => item.status === value,
          }),
        } as T;

      case 'payments':
        return {
          ...views.payments,
          items: filterBy(views.payments.items, query, {
            search: (item, value) => anyContains(item, value, ['reference', 'studentName', 'firstName', 'lastName', 'matricule']),
            status: (item, value) => item.status === value,
            method: (item, value) => item.method === value,
            type: (item, value) => item.type === value,
          }),
        } as T;

      case 'grades': {
        if (id === 'results') {
          const term = query.get('term') || data.meta.currentTerm;
          return (views.results[term] ?? views.results[data.meta.currentTerm]) as T;
        }
        fail(404, 'Route inconnue.');
      }

      case 'courses':
        return {
          ...data.courses,
          items: filterBy(data.courses.items, query, {
            search: (item, value) => anyContains(item, value, ['title', 'teacherName', 'level', 'subject']),
            status: (item, value) => item.status === value,
            level: (item, value) => item.level === value,
          }),
        } as T;

      case 'announcements':
        return {
          ...views.announcements,
          items: filterBy(views.announcements.items, query, {
            search: (item, value) => anyContains(item, value, ['title', 'body', 'author']),
          }),
        } as T;

      case 'faculties': {
        if (!id) return data.faculties as T;
        const detail = data.facultyDetails[id];
        if (!detail) fail(404, 'Faculté introuvable.');
        return detail as T;
      }

      case 'programs': {
        if (!id) {
          return {
            ...data.programs,
            items: filterBy(data.programs.items, query, {
              search: (item, value) => anyContains(item, value, ['name', 'code', 'facultyName']),
              degree: (item, value) => item.degree === value,
              facultyId: (item, value) => item.facultyId === value,
            }),
          } as T;
        }
        const detail = data.programDetails[id];
        if (!detail) fail(404, 'Filière introuvable.');
        return detail as T;
      }

      case 'course-units':
        return {
          ...data.units,
          items: filterBy(data.units.items, query, {
            search: (item, value) => anyContains(item, value, ['title', 'code', 'programName', 'teacherName']),
            programId: (item, value) => item.programId === value,
            semester: (item, value) => String(item.semester) === value,
          }),
        } as T;

      case 'schedules': {
        const items = filterBy(data.schedules.items, query, {
          classId: (item, value) => item.classId === value,
          programId: (item, value) => item.programId === value,
          day: (item, value) => item.day === value,
        }).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
        return { ...data.schedules, items } as T;
      }

      case 'library': {
        if (id === 'books') {
          return {
            ...data.books,
            items: filterBy(data.books.items, query, {
              search: (item, value) => anyContains(item, value, ['title', 'author', 'isbn']),
              category: (item, value) => item.category === value,
              availability: (item, value) => (value === 'disponible' ? item.copiesAvailable > 0 : item.copiesAvailable === 0),
            }),
          } as T;
        }
        if (id === 'loans') {
          const date = today();
          const items = filterBy(data.loans.items, query, {
            search: (item, value) => anyContains(item, value, ['bookTitle', 'studentName', 'matricule']),
            status: (item, value) => item.status === value,
          }).map((item: Json) => ({ ...item, late: item.status !== 'rendu' && item.dueAt < date }));
          return { ...data.loans, items } as T;
        }
        fail(404, 'Route inconnue.');
      }

      case 'attendance': {
        const date = query.get('date') || today();
        const classId = query.get('classId');
        const programId = query.get('programId');
        const session = query.get('session');
        const items = data.attendance
          .filter((item: Json) => item.date === date)
          .filter((item: Json) => !classId || item.classId === classId)
          .filter((item: Json) => !programId || item.programId === programId)
          .filter((item: Json) => !session || item.session === session)
          .sort((a: Json, b: Json) => String(a.lastName).localeCompare(String(b.lastName)));
        const count = (status: string) => items.filter((item: Json) => item.status === status).length;
        return {
          date,
          items,
          stats: {
            total: items.length,
            present: count('present'),
            absent: count('absent'),
            retard: count('retard'),
            excuse: count('excuse'),
            tauxPresence: items.length ? Math.round(((count('present') + count('retard')) / items.length) * 100) : null,
          },
        } as T;
      }

      default:
        fail(404, 'Route inconnue.');
    }
  }

  /* ------------------------------ écritures ------------------------------ */

  /* --------------------------- cartes scolaires --------------------------- */
  if (root === 'cards') {
    const list = views.students.items as Json[];
    const codeOf = (student: Json) => {
      let hash = 0;
      for (const character of String(student.id)) hash = (hash * 31 + character.charCodeAt(0)) % 60466176;
      return `SNA-26-${hash.toString(36).toUpperCase().padStart(6, '2').slice(-6)}`;
    };
    const year = new Date().getFullYear();
    const toCard = (student: Json) => {
      const cardCode = codeOf(student);
      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        matricule: student.matricule,
        gender: student.gender,
        birthDate: student.birthDate ?? null,
        status: student.status,
        studentType: student.studentType ?? 'eleve',
        academicLevel: student.academicLevel ?? null,
        cardCode,
        nfcTag: null,
        issuedAt: new Date().toISOString(),
        guardianName: student.guardianName ?? null,
        guardianPhone: student.guardianPhone ?? null,
        classId: student.classId ?? null,
        className: student.className ?? null,
        level: student.level ?? null,
        programId: student.programId ?? null,
        programName: student.programName ?? null,
        age: null,
        schoolName: 'School Net Academy',
        schoolShort: 'SNA',
        city: 'Brazzaville',
        schoolYear: `${year}-${year + 1}`,
        validUntil: `${year + 1}-07-31`,
        scanPath: `/app/presences?scan=${cardCode}`,
      };
    };

    if (method === 'GET' && !id) {
      const items = list.map(toCard);
      return {
        items, date: new Date().toISOString().slice(0, 10),
        stats: { total: items.length, issued: items.length, missing: 0, nfc: 0, scansToday: 0 },
      } as T;
    }
    if (method === 'GET' && id) {
      const student = list.find((item) => item.id === id);
      if (!student) fail(404, 'Élève introuvable.');
      return { card: toCard(student), history: [] } as T;
    }
    if (method === 'POST' && id === 'scan') {
      const payload = (body ?? {}) as Json;
      const raw = String(payload.code ?? '').trim();
      const code = raw.includes('scan=') ? raw.split('scan=')[1].split('&')[0] : raw;
      const student = list.find((item) => codeOf(item) === code || item.matricule === code);
      if (!student) fail(404, `Aucune carte ne correspond à « ${code.slice(0, 40)} ».`);
      return {
        card: toCard(student),
        attendance: {
          id: uid('att'), date: new Date().toISOString().slice(0, 10), session: 'Journée',
          status: payload.status === 'retard' ? 'retard' : 'present', note: 'Pointage démo (carte)',
          createdAt: new Date().toISOString(),
        },
        alreadyMarked: false,
        previousStatus: null,
      } as T;
    }
    if (method === 'POST' && extra === 'sign') {
      const student = list.find((item) => item.id === id);
      if (!student) fail(404, 'Élève introuvable.');
      return {
        card: toCard(student),
        attendance: {
          id: uid('att'), date: new Date().toISOString().slice(0, 10), session: 'Journée',
          status: 'present', note: 'Pointage démo (carte)', createdAt: new Date().toISOString(),
        },
        alreadyMarked: false,
        previousStatus: null,
      } as T;
    }
    if (method === 'POST' && extra === 'issue') {
      const student = list.find((item) => item.id === id);
      if (!student) fail(404, 'Élève introuvable.');
      return { card: toCard(student) } as T;
    }
    fail(404, 'Route inconnue.');
  }

  const collections: Record<string, { key: string; items: Json[] }> = {
    students: { key: 'student', items: views.students.items },
    classes: { key: 'class', items: data.classes.items },
    teachers: { key: 'teacher', items: data.teachers.items },
    admissions: { key: 'admission', items: data.admissions.items },
    payments: { key: 'payment', items: views.payments.items },
    courses: { key: 'course', items: data.courses.items },
    announcements: { key: 'announcement', items: views.announcements.items },
    faculties: { key: 'faculty', items: data.faculties.items },
    programs: { key: 'program', items: data.programs.items },
    'course-units': { key: 'unit', items: data.units.items },
    schedules: { key: 'schedule', items: data.schedules.items },
  };

  /* Prêts et ouvrages : routes imbriquées sous /library */
  if (root === 'library') {
    const books = data.books.items as Json[];
    const loans = data.loans.items as Json[];

    if (id === 'books') {
      if (method === 'POST') {
        const book = { id: uid('bok'), activeLoans: 0, copiesAvailable: Number((body as Json)?.copiesTotal ?? 1), ...(body as Json) };
        books.unshift(book);
        return { book } as T;
      }
      if (method === 'PATCH' && extra) {
        const book = books.find((item) => item.id === extra);
        if (!book) fail(404, 'Ouvrage introuvable.');
        const payload = (body ?? {}) as Json;
        const onLoan = book.copiesTotal - book.copiesAvailable;
        Object.assign(book, payload);
        if (payload.copiesTotal !== undefined) book.copiesAvailable = Number(payload.copiesTotal) - onLoan;
        return { book } as T;
      }
      if (method === 'DELETE' && extra) {
        const index = books.findIndex((item) => item.id === extra);
        if (index >= 0) books.splice(index, 1);
        return { ok: true } as T;
      }
    }

    if (id === 'loans') {
      if (method === 'POST') {
        const payload = (body ?? {}) as Json;
        const book = books.find((item) => item.id === payload.bookId);
        if (!book) fail(400, 'Ouvrage introuvable.');
        if (book.copiesAvailable < 1) fail(409, 'Aucun exemplaire disponible.');
        const student = (data.meta.students as Json[]).find((item) => item.id === payload.studentId);
        const loan = {
          id: uid('lon'),
          bookId: book.id,
          bookTitle: book.title,
          bookAuthor: book.author,
          studentId: payload.studentId,
          studentName: student?.name ?? 'Emprunteur',
          firstName: student?.name?.split(' ')[0] ?? '',
          lastName: student?.name?.split(' ').slice(1).join(' ') ?? '',
          matricule: student?.matricule ?? '—',
          className: student?.className ?? null,
          programName: student?.programName ?? null,
          loanedAt: new Date().toISOString(),
          dueAt: payload.dueAt,
          returnedAt: null,
          status: 'en_cours',
          late: false,
        };
        loans.unshift(loan);
        book.copiesAvailable -= 1;
        book.activeLoans += 1;
        return { loan } as T;
      }
      if (method === 'PATCH' && extra) {
        const loan = loans.find((item) => item.id === extra);
        if (!loan) fail(404, 'Emprunt introuvable.');
        const book = books.find((item) => item.id === loan.bookId);
        const status = (body as Json)?.status;
        if (status === 'rendu') {
          if (loan.status !== 'rendu' && book) {
            book.copiesAvailable = Math.min(book.copiesTotal, book.copiesAvailable + 1);
            book.activeLoans = Math.max(0, book.activeLoans - 1);
          }
          loan.status = 'rendu';
          loan.returnedAt = new Date().toISOString();
        } else if (status) {
          if (loan.status === 'rendu' && book) {
            book.copiesAvailable = Math.max(0, book.copiesAvailable - 1);
            book.activeLoans += 1;
          }
          loan.status = status;
          loan.returnedAt = null;
        }
        return { loan } as T;
      }
      if (method === 'DELETE' && extra) {
        const index = loans.findIndex((item) => item.id === extra);
        if (index >= 0) {
          const [loan] = loans.splice(index, 1);
          const book = books.find((item) => item.id === loan.bookId);
          if (book && loan.status !== 'rendu') {
            book.copiesAvailable = Math.min(book.copiesTotal, book.copiesAvailable + 1);
            book.activeLoans = Math.max(0, book.activeLoans - 1);
          }
        }
        return { ok: true } as T;
      }
    }
    fail(404, 'Route inconnue.');
  }

  /* ------------------------------ présences ------------------------------ */

  if (root === 'attendance') {
    if (method === 'POST' && id === 'mark') {
      const payload = (body ?? {}) as Json;
      const record = upsertAttendance(data, payload.studentId, payload.date, payload.session || 'Journée', payload.status, payload.note ?? null);
      return { item: record } as T;
    }
    if (method === 'POST' && id === 'bulk') {
      const payload = (body ?? {}) as Json;
      (payload.studentIds as string[]).forEach((studentId) => {
        upsertAttendance(data, studentId, payload.date, payload.session || 'Journée', payload.status, null);
      });
      return { ok: true, updated: (payload.studentIds as string[]).length } as T;
    }
    if (method === 'PATCH' && id) {
      const record = data.attendance.find((item: Json) => item.id === id);
      if (!record) fail(404, 'Pointage introuvable.');
      Object.assign(record, body);
      return { item: record } as T;
    }
    if (method === 'DELETE' && id) {
      const index = data.attendance.findIndex((item: Json) => item.id === id);
      if (index >= 0) data.attendance.splice(index, 1);
      return { ok: true } as T;
    }
    fail(404, 'Route inconnue.');
  }

  /* ------------------------- inscription → élève ------------------------- */

  if (root === 'admissions' && method === 'POST' && extra === 'enroll') {
    const admission = data.admissions.items.find((item: Json) => item.id === id);
    if (!admission) fail(404, 'Dossier introuvable.');
    const student = {
      id: uid('stu'),
      matricule: `SNA-DEMO-${Math.floor(Math.random() * 900 + 100)}`,
      firstName: admission.firstName,
      lastName: admission.lastName,
      gender: admission.gender ?? 'F',
      birthDate: admission.birthDate ?? null,
      classId: admission.classId ?? null,
      className: admission.className ?? null,
      level: admission.level ?? null,
      guardianName: admission.guardianName ?? admission.name ?? '—',
      guardianPhone: admission.phone ?? '—',
      guardianEmail: admission.email ?? '',
      address: admission.address ?? '',
      status: 'actif',
      enrolledAt: today(),
      studentType: 'eleve',
      programId: null,
      programName: null,
      academicLevel: null,
      paidTotal: 0,
      tuitionFee: admission.tuitionFee ?? 0,
    };
    views.students.items.unshift(student);
    data.roles.teacher?.students.items.unshift({ ...student });
    admission.status = 'inscrite';
    return { student } as T;
  }

  /* --------------------------- CRUD génériques --------------------------- */

  const resource = collections[root as string];
  if (!resource) fail(404, 'Route inconnue.');
  const { key, items } = resource;

  if (method === 'POST') {
    const payload = { ...(body as Json) };
    const created: Json = {
      id: uid(root.slice(0, 3)),
      createdAt: new Date().toISOString(),
      studentCount: 0,
      ...payload,
    };
    if (root === 'students') {
      created.paidTotal = 0;
      created.status = created.status ?? 'actif';
      created.studentType = created.studentType ?? 'eleve';
      created.matricule = created.matricule ?? `SNA-DEMO-${Math.floor(Math.random() * 900 + 100)}`;
    }
    if (root === 'classes') created.studentCount = 0;
    if (root === 'payments') created.reference = created.reference ?? `PAY-DEMO-${Math.floor(Math.random() * 9000 + 1000)}`;
    items.unshift(created);
    return { [key]: created } as T;
  }

  if (method === 'PATCH' && id) {
    const target = items.find((item) => item.id === id);
    if (!target) fail(404, 'Élément introuvable.');
    Object.assign(target, body);
    return { [key]: target } as T;
  }

  if (method === 'DELETE' && id) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) fail(404, 'Élément introuvable.');
    items.splice(index, 1);
    return { ok: true } as T;
  }

  fail(405, 'Méthode non autorisée.');
}

/* ------------------------- pointage : création/maj ------------------------ */

function upsertAttendance(data: Json, studentId: string, date: string, session: string, status: string, note: string | null) {
  const student = (data.meta.students as Json[]).find((item) => item.id === studentId);
  const existing = data.attendance.find((item: Json) => (
    item.studentId === studentId && item.date === date && (item.session ?? 'Journée') === session
  ));
  if (existing) {
    existing.status = status;
    existing.note = note ?? existing.note ?? null;
    return existing;
  }
  const record = {
    id: uid('att'),
    studentId,
    studentName: student?.name ?? 'Élève',
    firstName: student?.name?.split(' ')[0] ?? '',
    lastName: student?.name?.split(' ').slice(1).join(' ') ?? '',
    matricule: student?.matricule ?? '—',
    classId: student?.classId ?? null,
    className: student?.className ?? null,
    programId: student?.programId ?? null,
    programName: student?.programName ?? null,
    date,
    session,
    status,
    note,
  };
  data.attendance.push(record);
  return record;
}
