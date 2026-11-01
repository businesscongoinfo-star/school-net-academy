const nf = new Intl.NumberFormat('fr-FR');

export function formatMoney(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (compact && Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(millions)} M FCFA`;
  }
  return `${nf.format(Math.round(value))} FCFA`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return nf.format(value);
}

export function formatAverage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const longDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function formatDate(value?: string | null, long = false): string {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return long ? longDateFmt.format(d) : dateFmt.format(d);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`;
}

export function toDateInput(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} j`;
  return formatDate(value);
}

export function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const AVATAR_COLORS = ['#0f766e', '#b45309', '#7c3aed', '#1d4ed8', '#be123c', '#15803d', '#0e7490', '#a16207'];

export function colorFor(seed: string, palette = AVATAR_COLORS): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}

export function ageFrom(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
  return Math.max(0, Math.floor(age));
}

export const TONES = {
  primary: '#0f766e',
  amber: '#c2740b',
  info: '#1d4ed8',
  violet: '#6d28d9',
  success: '#15803d',
  danger: '#bf3527',
};
