import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import {
  parseBody, asyncHandler, notFound, forbidden, badRequest, makeReference, stamp, parentScope,
} from '../helpers.js';

const router = Router();

const TYPES = ['Scolarité', 'Inscription', 'Cantine', 'Transport', "Frais d'examen"];
const METHODS = ['Mobile Money', 'Espèces', 'Virement bancaire', 'Chèque'];
const STATUSES = ['paye', 'en_attente', 'retard', 'rembourse'];

const schema = z.object({
  studentId: z.string().min(1, 'Élève requis.'),
  amount: z.coerce.number().int().min(1, 'Montant invalide.').max(100_000_000),
  type: z.enum(TYPES),
  method: z.enum(METHODS),
  status: z.enum(STATUSES).default('paye'),
  paidAt: z.string().max(30).nullable().optional(),
  dueDate: z.string().max(10).nullable().optional(),
  term: z.string().max(30).nullable().optional(),
  note: z.string().max(400).nullable().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { search = '', status = '', method = '', type = '', studentId = '' } = req.query;
  const scope = parentScope(req.user);
  const filters = [scope.sql];
  const params = [...scope.params];
  if (search) {
    filters.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR p.reference LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (status) { filters.push('p.status = ?'); params.push(status); }
  if (method) { filters.push('p.method = ?'); params.push(method); }
  if (type) { filters.push('p.type = ?'); params.push(type); }
  if (studentId) { filters.push('p.student_id = ?'); params.push(studentId); }

  const items = all(
    `SELECT p.id, p.reference, p.student_id AS studentId, p.amount, p.currency, p.type, p.method,
            p.status, p.paid_at AS paidAt, p.due_date AS dueDate, p.term, p.note,
            s.first_name AS firstName, s.last_name AS lastName, s.matricule,
            s.first_name || ' ' || s.last_name AS studentName,
            c.name AS className
       FROM payments p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN classes c ON c.id = s.class_id
      WHERE ${filters.join(' AND ')}
      ORDER BY COALESCE(p.paid_at, p.due_date) DESC`,
    ...params,
  );

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const paid = items.filter((p) => p.status === 'paye');
  res.json({
    items,
    stats: {
      encaisse: paid.reduce((s, p) => s + p.amount, 0),
      enAttente: items.filter((p) => p.status === 'en_attente').reduce((s, p) => s + p.amount, 0),
      retard: items.filter((p) => p.status === 'retard').reduce((s, p) => s + p.amount, 0),
      recent: paid.filter((p) => (p.paidAt ?? '') >= since30).reduce((s, p) => s + p.amount, 0),
      transactions: items.length,
    },
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(schema, req.body);
  if (!get('SELECT id FROM students WHERE id = ?', data.studentId)) throw badRequest('Élève introuvable.');
  const id = uid('pay');
  const { createdAt, updatedAt } = stamp();
  const isPaid = data.status === 'paye';
  run(
    `INSERT INTO payments (id, reference, student_id, amount, currency, type, method, status, paid_at,
       due_date, term, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'FCFA', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, makeReference('PAY', 'payments'), data.studentId, data.amount, data.type, data.method, data.status,
    data.paidAt ?? (isPaid ? now() : null), data.dueDate ?? null, data.term ?? null, data.note ?? null,
    createdAt, updatedAt,
  );
  res.status(201).json({ payment: get('SELECT * FROM payments WHERE id = ?', id) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const existing = get('SELECT * FROM payments WHERE id = ?', req.params.id);
  if (!existing) throw notFound('Paiement introuvable.');
  const data = parseBody(schema.partial(), req.body);
  const map = {
    studentId: 'student_id', amount: 'amount', type: 'type', method: 'method', status: 'status',
    paidAt: 'paid_at', dueDate: 'due_date', term: 'term', note: 'note',
  };
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key] ?? null);
    }
  }
  if (data.status === 'paye' && !existing.paid_at && data.paidAt === undefined) {
    fields.push('paid_at = ?');
    params.push(now());
  }
  if (data.status && data.status !== 'paye' && !data.paidAt) {
    fields.push('paid_at = ?');
    params.push(null);
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ payment: get('SELECT * FROM payments WHERE id = ?', req.params.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM payments WHERE id = ?', req.params.id)) throw notFound('Paiement introuvable.');
  run('DELETE FROM payments WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

export default router;
