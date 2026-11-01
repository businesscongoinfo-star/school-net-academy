import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now } from '../db.js';
import { parseBody, asyncHandler, forbidden, badRequest, notFound } from '../helpers.js';

const router = Router();

const STATUSES = ['present', 'absent', 'retard', 'excuse'];
const today = () => new Date().toISOString().slice(0, 10);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code de carte lisible à voix haute et scannable (Code 128 / QR / NFC). */
export function newCardCode() {
  const year = String(new Date().getFullYear()).slice(2);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    const code = `SNA-${year}-${suffix}`;
    if (!get('SELECT 1 AS x FROM students WHERE card_code = ?', code)) return code;
  }
  return `SNA-${year}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function issueCard(studentId) {
  const student = get('SELECT id, card_code FROM students WHERE id = ?', studentId);
  if (!student) return null;
  const code = student.card_code || newCardCode();
  const ts = now();
  run('UPDATE students SET card_code = ?, card_issued_at = COALESCE(card_issued_at, ?), updated_at = ? WHERE id = ?',
    code, ts, ts, studentId);
  return code;
}

const baseSelect = `SELECT s.id AS studentId, s.first_name AS firstName, s.last_name AS lastName,
       s.matricule, s.gender, s.birth_date AS birthDate, s.status, s.student_type AS studentType,
       s.academic_level AS academicLevel,
       s.card_code AS cardCode, s.nfc_tag AS nfcTag, s.card_issued_at AS issuedAt,
       s.guardian_name AS guardianName, s.guardian_phone AS guardianPhone,
       s.class_id AS classId, c.name AS className, c.level AS level,
       s.program_id AS programId, p.name AS programName
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN programs p ON p.id = s.program_id`;

function ensureStaff(req) {
  if (req.user.role === 'parent') throw forbidden();
}

/** Enrichit la carte des informations d'affichage (établissement, année, validité). */
function toCard(row) {
  if (!row) return null;
  const year = new Date().getFullYear();
  const birthYear = row.birthDate ? Number(String(row.birthDate).slice(0, 4)) : null;
  return {
    ...row,
    cardCode: row.cardCode ?? null,
    nfcTag: row.nfcTag ?? null,
    issuedAt: row.issuedAt ?? null,
    schoolName: 'School Net Academy',
    schoolShort: 'SNA',
    city: 'Brazzaville',
    schoolYear: `${year}-${year + 1}`,
    validUntil: `${year + 1}-07-31`,
    age: birthYear ? year - birthYear : null,
    scanPath: row.cardCode ? `/app/presences?scan=${encodeURIComponent(row.cardCode)}` : null,
  };
}

/** Liste des cartes (recherche, classe, statut de la carte). */
router.get('/', asyncHandler(async (req, res) => {
  ensureStaff(req);
  const { search = '', classId = '', state = '' } = req.query;
  const filters = ["s.status IN ('actif','suspendu')"];
  const params = [];

  if (search) {
    filters.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.matricule LIKE ? OR s.card_code LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (classId) { filters.push('s.class_id = ?'); params.push(classId); }
  if (state === 'issued') filters.push('s.card_code IS NOT NULL');
  if (state === 'missing') filters.push('s.card_code IS NULL');
  if (state === 'nfc') filters.push('s.nfc_tag IS NOT NULL');

  const rows = all(`${baseSelect} WHERE ${filters.join(' AND ')} ORDER BY s.last_name COLLATE NOCASE, s.first_name`, ...params);
  const items = rows.map(toCard);
  const totals = get(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN card_code IS NOT NULL THEN 1 ELSE 0 END) AS issued,
      SUM(CASE WHEN nfc_tag IS NOT NULL THEN 1 ELSE 0 END) AS nfc
    FROM students WHERE status IN ('actif','suspendu')`);

  const scansToday = get(
    `SELECT COUNT(*) AS c FROM attendance a JOIN students s ON s.id = a.student_id
      WHERE a.date = ? AND a.note LIKE '%carte%'`,
    today(),
  );

  res.json({
    items,
    date: today(),
    stats: {
      total: totals?.total ?? 0,
      issued: totals?.issued ?? 0,
      missing: (totals?.total ?? 0) - (totals?.issued ?? 0),
      nfc: totals?.nfc ?? 0,
      scansToday: scansToday?.c ?? 0,
    },
  });
}));

/** Détail d'une carte + historique récent de pointages. */
router.get('/:studentId', asyncHandler(async (req, res) => {
  ensureStaff(req);
  const row = get(`${baseSelect} WHERE s.id = ?`, req.params.studentId);
  if (!row) throw notFound('Élève introuvable.');
  const history = all(
    `SELECT a.id, a.date, a.session, a.status, a.note, a.created_at AS createdAt
       FROM attendance a WHERE a.student_id = ? ORDER BY a.date DESC, a.created_at DESC LIMIT 12`,
    req.params.studentId,
  );
  res.json({ card: toCard(row), history });
}));

/** Émet (ou réémet) la carte d'un élève — le QR et le code-barres changent. */
router.post('/:studentId/issue', asyncHandler(async (req, res) => {
  ensureStaff(req);
  const row = get('SELECT id FROM students WHERE id = ?', req.params.studentId);
  if (!row) throw notFound('Élève introuvable.');
  const code = newCardCode();
  const ts = now();
  run('UPDATE students SET card_code = ?, card_issued_at = ?, updated_at = ? WHERE id = ?', code, ts, ts, req.params.studentId);
  res.json({ card: toCard(get(`${baseSelect} WHERE s.id = ?`, req.params.studentId)) });
}));

/** Associe (ou retire) le badge NFC physique. */
router.patch('/:studentId/nfc', asyncHandler(async (req, res) => {
  ensureStaff(req);
  const data = parseBody(z.object({
    nfcTag: z.string().trim().min(4).max(64).nullable(),
  }), req.body);
  const row = get('SELECT id FROM students WHERE id = ?', req.params.studentId);
  if (!row) throw notFound('Élève introuvable.');
  if (data.nfcTag) {
    const clash = get('SELECT id, first_name AS firstName, last_name AS lastName FROM students WHERE nfc_tag = ? AND id <> ?',
      data.nfcTag, req.params.studentId);
    if (clash) throw badRequest(`Ce badge est déjà associé à ${clash.firstName} ${clash.lastName}.`);
  }
  run('UPDATE students SET nfc_tag = ?, updated_at = ? WHERE id = ?', data.nfcTag, now(), req.params.studentId);
  res.json({ card: toCard(get(`${baseSelect} WHERE s.id = ?`, req.params.studentId)) });
}));

/** Pointage : enregistre la présence du jour pour un élève. */
function signPresence(studentId, { status = 'present', source = 'carte' } = {}) {
  const student = get('SELECT id, class_id, program_id, first_name AS firstName, last_name AS lastName FROM students WHERE id = ?', studentId);
  if (!student) return null;
  const date = today();
  const session = 'Journée';
  const existing = get(
    'SELECT id, status, created_at AS createdAt FROM attendance WHERE student_id = ? AND date = ? AND COALESCE(session, ?) = ?',
    studentId, date, session, session,
  );
  const ts = now();
  const note = `Pointage ${source}`;
  if (existing) {
    run('UPDATE attendance SET status = ?, note = ?, updated_at = ? WHERE id = ?', status, note, ts, existing.id);
  } else {
    run(
      `INSERT INTO attendance (id, student_id, class_id, program_id, date, session, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      studentId, student.class_id, student.program_id, date, session, status, note, ts, ts,
    );
  }
  const item = get(
    `SELECT a.id, a.date, a.session, a.status, a.note, a.created_at AS createdAt
       FROM attendance a WHERE a.student_id = ? AND a.date = ? AND COALESCE(a.session, ?) = ?`,
    studentId, date, session, session,
  );
  return { item, alreadyMarked: Boolean(existing), previousStatus: existing?.status ?? null };
}

/** Signature de présence depuis la carte (bouton « Signer la présence »). */
router.post('/:studentId/sign', asyncHandler(async (req, res) => {
  ensureStaff(req);
  const data = parseBody(z.object({
    status: z.enum(STATUSES).optional(),
    source: z.string().max(20).optional(),
  }).default({}), req.body ?? {});
  const card = get(`${baseSelect} WHERE s.id = ?`, req.params.studentId);
  if (!card) throw notFound('Élève introuvable.');
  if (!card.cardCode) issueCard(card.studentId);
  const result = signPresence(card.studentId, { status: data.status ?? 'present', source: data.source ?? 'carte' });
  res.json({
    card: toCard(get(`${baseSelect} WHERE s.id = ?`, card.studentId)),
    attendance: result.item,
    alreadyMarked: result.alreadyMarked,
    previousStatus: result.previousStatus,
  });
}));

/**
 * Scan d'une carte : QR, code-barres (douchette) ou badge NFC.
 * Accepte le code de carte, le tag NFC, le matricule ou l'identifiant interne.
 */
router.post('/scan', asyncHandler(async (req, res) => {
  ensureStaff(req);
  const data = parseBody(z.object({
    code: z.string().trim().min(3, 'Code de carte requis.').max(120),
    status: z.enum(STATUSES).optional(),
    source: z.enum(['qr', 'barcode', 'nfc', 'manuel']).optional(),
    preview: z.boolean().optional(),
  }), req.body);

  const raw = data.code.trim();
  // Un QR peut contenir une URL complète : on extrait le paramètre « scan » ou le dernier segment.
  let code = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      code = url.searchParams.get('scan') ?? url.pathname.split('/').filter(Boolean).pop() ?? raw;
    } catch { /* on garde la valeur brute */ }
  }

  const found = get('SELECT id FROM students WHERE card_code = ?', code)
    ?? get('SELECT id FROM students WHERE nfc_tag = ?', code)
    ?? get('SELECT id FROM students WHERE matricule = ?', code.toUpperCase())
    ?? get('SELECT id FROM students WHERE id = ?', code);
  if (!found) throw notFound(`Aucune carte ne correspond à « ${code.slice(0, 40)} ».`);

  const row = get(`${baseSelect} WHERE s.id = ?`, found.id);
  if (data.preview) {
    res.json({ card: toCard(row), attendance: null, alreadyMarked: false });
    return;
  }
  if (!row.cardCode) issueCard(row.studentId);
  const result = signPresence(found.id, { status: data.status ?? 'present', source: data.source ?? 'carte' });
  res.json({
    card: toCard(get(`${baseSelect} WHERE s.id = ?`, found.id)),
    attendance: result.item,
    alreadyMarked: result.alreadyMarked,
    previousStatus: result.previousStatus,
  });
}));

export default router;
