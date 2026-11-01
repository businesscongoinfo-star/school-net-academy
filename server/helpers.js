import { all, get, now } from './db.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Ressource introuvable.') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
export const forbidden = (message = "Action non autorisée pour votre profil.") => new HttpError(403, message);

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join('.');
    let message = issue?.message || 'Données invalides.';
    if (/^Invalid input/i.test(message)) {
      message = /undefined/i.test(message) ? 'Champ obligatoire manquant.' : 'Valeur invalide.';
    }
    throw badRequest(field ? `${field} : ${message}` : message, result.error.issues);
  }
  return result.data;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function termNow(date = new Date()) {
  const month = date.getMonth();
  if (month >= 8) return 'Trimestre 1';
  if (month <= 2) return 'Trimestre 2';
  return 'Trimestre 3';
}

export function parentScope(user, alias = 's') {
  if (user.role === 'parent') return { sql: `${alias}.guardian_user_id = ?`, params: [user.id] };
  return { sql: '1 = 1', params: [] };
}

export function ensureStudentAccess(user, studentId) {
  const scope = parentScope(user);
  const row = get(`SELECT s.id FROM students s WHERE s.id = ? AND ${scope.sql}`, studentId, ...scope.params);
  if (!row) throw notFound('Élève introuvable.');
  return row;
}

/** Crée une référence lisible et unique pour une ressource. */
export function makeReference(prefix, table, column = 'reference') {
  const year = new Date().getFullYear();
  const row = get(`SELECT COUNT(*) AS c FROM ${table}`);
  let n = (row?.c ?? 0) + 1;
  let ref = `${prefix}-${year}-${String(n).padStart(3, '0')}`;
  while (get(`SELECT 1 AS x FROM ${table} WHERE ${column} = ?`, ref)) {
    n += 1;
    ref = `${prefix}-${year}-${String(n).padStart(3, '0')}`;
  }
  return ref;
}

/** Fil d'activité récent. Les comptes parents ne voient que leurs propres écritures. */
export function recentActivity(limit = 8, user = null) {
  const isParent = user?.role === 'parent';
  const parts = [];

  if (isParent) {
    parts.push(`SELECT 'payment' AS kind, p.id, p.created_at, p.created_at AS occurred_at,
            s.first_name || ' ' || s.last_name AS subject,
            'Paiement de ' || printf('%,d', p.amount) || ' FCFA — ' || p.type AS detail,
            p.status AS status
       FROM payments p JOIN students s ON s.id = p.student_id
      WHERE s.guardian_user_id = ?`);
  } else {
    parts.push(`SELECT 'payment' AS kind, p.id, p.created_at, p.created_at AS occurred_at,
            s.first_name || ' ' || s.last_name AS subject,
            'Paiement de ' || printf('%,d', p.amount) || ' FCFA — ' || p.type AS detail,
            p.status AS status
       FROM payments p JOIN students s ON s.id = p.student_id`);
    parts.push(`SELECT 'admission', a.id, a.created_at, a.submitted_at,
            a.student_name, 'Demande d''inscription en ' || a.level, a.status
       FROM admissions a`);
    parts.push(`SELECT 'student', s.id, s.created_at, s.enrolled_at,
            s.first_name || ' ' || s.last_name, 'Nouvelle inscription élève', s.status
       FROM students s`);
  }

  parts.push(`SELECT 'course', c.id, c.created_at, c.updated_at,
            c.title, 'Cours ' || CASE c.status WHEN 'publie' THEN 'publié' ELSE c.status END, c.status
       FROM courses c`);

  const params = isParent ? [user.id, limit] : [limit];
  const rows = all(`${parts.join(' UNION ALL ')} ORDER BY created_at DESC LIMIT ?`, ...params);
  return rows.map((r) => ({ ...r, occurred_at: r.occurred_at || r.created_at, at: r.occurred_at || r.created_at }));
}

export function stamp() {
  const ts = now();
  return { createdAt: ts, updatedAt: ts };
}
