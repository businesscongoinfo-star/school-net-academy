import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'school-net.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params) ?? null;
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const now = () => new Date().toISOString();

export function uid(prefix = '') {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix ? `${prefix}_${id}` : id;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','parent')),
  phone TEXT,
  title TEXT,
  avatar_color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif','conge','parti')),
  hired_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  room TEXT,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  capacity INTEGER NOT NULL DEFAULT 40,
  tuition_fee INTEGER NOT NULL DEFAULT 150000,
  schedule TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  matricule TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'F' CHECK (gender IN ('F','M')),
  birth_date TEXT,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  guardian_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif','suspendu','diplome','parti')),
  enrolled_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admissions (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT NOT NULL DEFAULT 'F' CHECK (gender IN ('F','M')),
  level TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT,
  guardian_email TEXT,
  previous_school TEXT,
  status TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('en_attente','en_revue','acceptee','refusee','inscrite')),
  source TEXT,
  submitted_at TEXT NOT NULL,
  decision_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'FCFA',
  type TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paye' CHECK (status IN ('paye','en_attente','retard','rembourse')),
  paid_at TEXT,
  due_date TEXT,
  term TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  level TEXT NOT NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('publie','brouillon','archive')),
  lessons_count INTEGER NOT NULL DEFAULT 0,
  duration_hours INTEGER NOT NULL DEFAULT 0,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'tous'
    CHECK (audience IN ('tous','parents','enseignants','eleves')),
  status TEXT NOT NULL DEFAULT 'publie' CHECK (status IN ('publie','brouillon')),
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  term TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL DEFAULT 20,
  coefficient INTEGER NOT NULL DEFAULT 1,
  evaluated_at TEXT,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

export function migrate() {
  db.exec(SCHEMA);
}

export function isEmpty() {
  const row = get('SELECT COUNT(*) AS c FROM users');
  return !row || row.c === 0;
}
