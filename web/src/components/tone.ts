export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral';

export const tones: Record<Tone, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--amber)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  violet: 'var(--violet)',
  neutral: 'var(--ink-300)',
};
