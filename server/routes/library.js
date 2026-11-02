import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now, uid } from '../db.js';
import { parseBody, asyncHandler, notFound, forbidden, badRequest, conflict, parentScope } from '../helpers.js';

const router = Router();

/* -------------------------------- Ouvrages ------------------------------- */

const bookSchema = z.object({
  title: z.string().min(2, 'Titre requis.').max(180),
  author: z.string().max(120).nullable().optional(),
  isbn: z.string().max(40).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  copiesTotal: z.coerce.number().int().min(1, 'Au moins un exemplaire.').max(500).default(1),
  shelf: z.string().max(30).nullable().optional(),
});

router.get('/books', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { search = '', category = '', availability = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) { filters.push('b.category = ?'); params.push(category); }
  if (availability === 'disponible') filters.push('b.copies_available > 0');
  if (availability === 'epuise') filters.push('b.copies_available = 0');

  const items = all(
    `SELECT b.id, b.title, b.author, b.isbn, b.category, b.copies_total AS copiesTotal,
            b.copies_available AS copiesAvailable, b.shelf, b.created_at AS createdAt,
            (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status <> 'rendu') AS activeLoans
       FROM books b WHERE ${filters.join(' AND ')}
      ORDER BY b.title COLLATE NOCASE`,
    ...params,
  );

  const categories = all('SELECT DISTINCT category FROM books WHERE category IS NOT NULL ORDER BY category')
    .map((row) => row.category);

  res.json({
    items,
    categories,
    stats: {
      total: items.length,
      copies: items.reduce((sum, book) => sum + book.copiesTotal, 0),
      disponibles: items.reduce((sum, book) => sum + book.copiesAvailable, 0),
      emprunts: items.reduce((sum, book) => sum + book.activeLoans, 0),
    },
  });
}));

router.post('/books', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(bookSchema, req.body);
  const id = uid('bok');
  const ts = now();
  run(
    `INSERT INTO books (id, title, author, isbn, category, copies_total, copies_available, shelf,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, data.title, data.author ?? null, data.isbn ?? null, data.category ?? null,
    data.copiesTotal, data.copiesTotal, data.shelf ?? null, ts, ts,
  );
  res.status(201).json({ book: get('SELECT * FROM books WHERE id = ?', id) });
}));

router.patch('/books/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const existing = get('SELECT * FROM books WHERE id = ?', req.params.id);
  if (!existing) throw notFound('Ouvrage introuvable.');
  const data = parseBody(bookSchema.partial(), req.body);
  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries({
    title: 'title', author: 'author', isbn: 'isbn', category: 'category', shelf: 'shelf',
  })) {
    if (data[key] !== undefined) { fields.push(`${column} = ?`); params.push(data[key] ?? null); }
  }
  if (data.copiesTotal !== undefined) {
    const onLoan = existing.copies_total - existing.copies_available;
    if (data.copiesTotal < onLoan) {
      throw badRequest(`Impossible : ${onLoan} exemplaire(s) sont actuellement empruntés.`);
    }
    fields.push('copies_total = ?');
    params.push(data.copiesTotal);
    fields.push('copies_available = ?');
    params.push(data.copiesTotal - onLoan);
  }
  if (!fields.length) throw badRequest('Aucune modification fournie.');
  fields.push('updated_at = ?');
  params.push(now(), req.params.id);
  run(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`, ...params);
  res.json({ book: get('SELECT * FROM books WHERE id = ?', req.params.id) });
}));

router.delete('/books/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  if (!get('SELECT id FROM books WHERE id = ?', req.params.id)) throw notFound('Ouvrage introuvable.');
  const active = get("SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND status <> 'rendu'", req.params.id).c;
  if (active > 0) throw conflict(`${active} emprunt(s) en cours sur cet ouvrage.`);
  run('DELETE FROM books WHERE id = ?', req.params.id);
  res.json({ ok: true });
}));

/* --------------------------------- Prêts --------------------------------- */

const loanSchema = z.object({
  bookId: z.string().min(1, 'Ouvrage requis.'),
  studentId: z.string().min(1, 'Emprunteur requis.'),
  dueAt: z.string().min(8, "Date de retour requise.").max(30),
});

const LOAN_SELECT = `SELECT l.id, l.book_id AS bookId, l.student_id AS studentId,
       l.loaned_at AS loanedAt, l.due_at AS dueAt, l.returned_at AS returnedAt, l.status,
       b.title AS bookTitle, b.author AS bookAuthor,
       s.first_name AS firstName, s.last_name AS lastName, s.matricule,
       s.first_name || ' ' || s.last_name AS studentName,
       c.name AS className, p.name AS programName
  FROM loans l
  JOIN books b ON b.id = l.book_id
  JOIN students s ON s.id = l.student_id
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN programs p ON p.id = s.program_id`;

router.get('/loans', asyncHandler(async (req, res) => {
  if (req.user.role === 'parent') throw forbidden();
  const { search = '', status = '' } = req.query;
  const filters = ['1 = 1'];
  const params = [];
  if (search) {
    filters.push('(b.title LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.matricule LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) { filters.push('l.status = ?'); params.push(status); }

  const items = all(
    `${LOAN_SELECT} WHERE ${filters.join(' AND ')}
      ORDER BY CASE l.status WHEN 'retard' THEN 0 WHEN 'en_cours' THEN 1 ELSE 2 END, l.due_at`,
    ...params,
  );

  const today = new Date().toISOString().slice(0, 10);
  const enriched = items.map((loan) => ({
    ...loan,
    late: loan.status !== 'rendu' && loan.dueAt < today,
  }));

  res.json({
    items: enriched,
    stats: {
      total: items.length,
      enCours: items.filter((loan) => loan.status === 'en_cours').length,
      retards: items.filter((loan) => loan.status === 'retard').length,
      rendus: items.filter((loan) => loan.status === 'rendu').length,
    },
  });
}));

router.post('/loans', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const data = parseBody(loanSchema, req.body);
  const book = get('SELECT * FROM books WHERE id = ?', data.bookId);
  if (!book) throw badRequest('Ouvrage introuvable.');
  if (book.copies_available < 1) throw conflict('Aucun exemplaire disponible pour cet ouvrage.');
  if (!get('SELECT id FROM students WHERE id = ?', data.studentId)) throw badRequest('Emprunteur introuvable.');

  const id = uid('lon');
  const ts = now();
  run(
    `INSERT INTO loans (id, book_id, student_id, loaned_at, due_at, returned_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'en_cours', ?, ?)`,
    id, data.bookId, data.studentId, ts, data.dueAt, ts, ts,
  );
  run('UPDATE books SET copies_available = copies_available - 1, updated_at = ? WHERE id = ?', ts, data.bookId);
  res.status(201).json({ loan: get(`${LOAN_SELECT} WHERE l.id = ?`, id) });
}));

router.patch('/loans/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const loan = get('SELECT * FROM loans WHERE id = ?', req.params.id);
  if (!loan) throw notFound('Emprunt introuvable.');
  const data = parseBody(z.object({
    status: z.enum(['en_cours', 'rendu', 'retard']),
  }), req.body);
  const ts = now();
  if (data.status === 'rendu') {
    if (loan.status !== 'rendu') {
      run('UPDATE books SET copies_available = MIN(copies_total, copies_available + 1), updated_at = ? WHERE id = ?', ts, loan.book_id);
    }
    run("UPDATE loans SET status = 'rendu', returned_at = ?, updated_at = ? WHERE id = ?", ts, ts, loan.id);
  } else {
    if (loan.status === 'rendu') {
      run('UPDATE books SET copies_available = MAX(0, copies_available - 1), updated_at = ? WHERE id = ?', ts, loan.book_id);
    }
    run('UPDATE loans SET status = ?, returned_at = NULL, updated_at = ? WHERE id = ?', data.status, ts, loan.id);
  }
  res.json({ loan: get(`${LOAN_SELECT} WHERE l.id = ?`, req.params.id) });
}));

router.delete('/loans/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw forbidden();
  const loan = get('SELECT * FROM loans WHERE id = ?', req.params.id);
  if (!loan) throw notFound('Emprunt introuvable.');
  if (loan.status !== 'rendu') {
    run('UPDATE books SET copies_available = MIN(copies_total, copies_available + 1) WHERE id = ?', loan.book_id);
  }
  run('DELETE FROM loans WHERE id = ?', loan.id);
  res.json({ ok: true });
}));

/* ---------------------- Emprunts de l'élève connecté --------------------- */

router.get('/mes-emprunts', asyncHandler(async (req, res) => {
  const scope = parentScope(req.user);
  const items = all(
    `${LOAN_SELECT} WHERE ${scope.sql} ORDER BY l.due_at DESC`,
    ...scope.params,
  );
  res.json({ items });
}));

export default router;
