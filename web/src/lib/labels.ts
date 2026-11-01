type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral';

export const STUDENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  actif: { label: 'Actif', tone: 'success' },
  suspendu: { label: 'Suspendu', tone: 'warning' },
  diplome: { label: 'Diplômé', tone: 'info' },
  parti: { label: 'Parti', tone: 'neutral' },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  paye: { label: 'Payé', tone: 'success' },
  en_attente: { label: 'En attente', tone: 'warning' },
  retard: { label: 'En retard', tone: 'danger' },
  rembourse: { label: 'Remboursé', tone: 'neutral' },
};

export const ADMISSION_STATUS: Record<string, { label: string; tone: Tone; short: string }> = {
  en_attente: { label: 'En attente', tone: 'warning', short: 'Attente' },
  en_revue: { label: 'En revue', tone: 'info', short: 'Revue' },
  acceptee: { label: 'Acceptée', tone: 'success', short: 'Acceptée' },
  refuse: { label: 'Refusée', tone: 'danger', short: 'Refusée' },
  refusee: { label: 'Refusée', tone: 'danger', short: 'Refusée' },
  inscrite: { label: 'Inscrite', tone: 'violet', short: 'Inscrite' },
};

export const COURSE_STATUS: Record<string, { label: string; tone: Tone }> = {
  publie: { label: 'Publié', tone: 'success' },
  brouillon: { label: 'Brouillon', tone: 'warning' },
  archive: { label: 'Archivé', tone: 'neutral' },
};

export const TEACHER_STATUS: Record<string, { label: string; tone: Tone }> = {
  actif: { label: 'En poste', tone: 'success' },
  conge: { label: 'En congé', tone: 'warning' },
  parti: { label: 'Parti', tone: 'neutral' },
};

export const AUDIENCE: Record<string, { label: string; tone: Tone }> = {
  tous: { label: 'Toute la communauté', tone: 'primary' },
  parents: { label: 'Parents', tone: 'info' },
  enseignants: { label: 'Enseignants', tone: 'violet' },
  eleves: { label: 'Élèves', tone: 'success' },
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Direction',
  teacher: 'Enseignant',
  parent: 'Parent',
};

export function labelOf(map: Record<string, { label: string }>, key?: string | null): string {
  if (!key) return '—';
  return map[key]?.label ?? key;
}

export function toneOf(map: Record<string, { tone: Tone }>, key?: string | null): Tone {
  if (!key) return 'neutral';
  return map[key]?.tone ?? 'neutral';
}

export function appreciationOf(average: number | null): { label: string; tone: Tone } {
  if (average === null) return { label: 'Non évalué', tone: 'neutral' };
  if (average >= 16) return { label: 'Excellent', tone: 'success' };
  if (average >= 14) return { label: 'Très bien', tone: 'primary' };
  if (average >= 12) return { label: 'Bien', tone: 'info' };
  if (average >= 10) return { label: 'Passable', tone: 'warning' };
  return { label: 'Insuffisant', tone: 'danger' };
}

export const PROGRAM_STATUS: Record<string, { label: string; tone: Tone }> = {
  ouverte: { label: 'Ouverte', tone: 'success' },
  fermee: { label: 'Fermée', tone: 'danger' },
  brouillon: { label: 'Brouillon', tone: 'warning' },
};

export const UNIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  actif: { label: 'Actif', tone: 'success' },
  archive: { label: 'Archivé', tone: 'neutral' },
};

export const LOAN_STATUS: Record<string, { label: string; tone: Tone }> = {
  en_cours: { label: 'En cours', tone: 'info' },
  rendu: { label: 'Rendu', tone: 'success' },
  retard: { label: 'En retard', tone: 'danger' },
};

export const ATTENDANCE_STATUS: Record<string, { label: string; tone: Tone; short: string }> = {
  present: { label: 'Présent', tone: 'success', short: 'Présent' },
  absent: { label: 'Absent', tone: 'danger', short: 'Absent' },
  retard: { label: 'En retard', tone: 'warning', short: 'Retard' },
  excuse: { label: 'Excusé', tone: 'info', short: 'Excusé' },
};

export const DEGREE_TONE: Record<string, Tone> = {
  Licence: 'primary',
  Master: 'violet',
  Doctorat: 'danger',
  BTS: 'info',
  Certificat: 'warning',
};

export const SCHEDULE_KIND: Record<string, { label: string; tone: Tone }> = {
  Cours: { label: 'Cours', tone: 'primary' },
  TD: { label: 'TD', tone: 'info' },
  TP: { label: 'TP', tone: 'violet' },
  Examen: { label: 'Examen', tone: 'danger' },
  Soutenance: { label: 'Soutenance', tone: 'warning' },
};
