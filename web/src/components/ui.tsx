import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { initials } from '../lib/format';
import { tones } from './tone';
import type { Tone } from './tone';

/* --------------------------------- Button -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'soft-danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  block?: boolean;
};

export function Button({
  variant = 'secondary', size = 'md', loading, icon: Icon, block, className, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: number; tone?: 'default' | 'danger' };

export function IconButton({ icon: Icon, label, size = 16, tone = 'default', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={clsx('icon-btn', tone === 'danger' && 'danger', className)}
      aria-label={label}
      title={label}
      style={tone === 'danger' ? { color: 'var(--danger)' } : undefined}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
}

/* --------------------------------- Inputs -------------------------------- */

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('select', className)} {...rest}>{children}</select>;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('textarea', className)} {...rest} />;
}

export function Field({
  label, hint, error, htmlFor, className, children,
}: { label?: string; hint?: string; error?: string; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={clsx('field', className)}>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function SearchInput({
  value, onChange, placeholder = 'Rechercher…', className,
}: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx('search', className)}>
      <Search size={15} />
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

/* ---------------------------------- Badge -------------------------------- */

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx('badge', `badge-${tone}`)}>
      {dot && <span className="dot" style={{ background: tones[tone] }} />}
      {children}
    </span>
  );
}

/* ---------------------------------- Card --------------------------------- */

export function Card({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={clsx('card', className)} style={style}>{children}</div>;
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, tone = 'primary', foot, loading,
}: { label: string; value: ReactNode; icon?: LucideIcon; tone?: 'primary' | 'amber' | 'info' | 'violet' | 'danger'; foot?: ReactNode; loading?: boolean }) {
  return (
    <div className="stat-card">
      <div className="row gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="stat-label">{label}</div>
          {loading ? (
            <div className="skeleton" style={{ height: 28, width: '60%', marginTop: 10 }} />
          ) : (
            <div className="stat-value">{value}</div>
          )}
        </div>
        {Icon && <span className={`stat-icon ${tone}`}><Icon size={18} /></span>}
      </div>
      {loading ? <div className="skeleton sk-line" style={{ width: '45%', marginTop: 14 }} /> : foot ? <div className="stat-foot">{foot}</div> : null}
    </div>
  );
}

/* --------------------------------- Avatar -------------------------------- */

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={clsx('avatar', size === 'sm' && 'avatar-sm', size === 'lg' && 'avatar-lg')}
      style={{ background: color || 'var(--primary)' }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------------- States -------------------------------- */

export function EmptyState({
  icon: Icon, title, description, action,
}: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={22} /></span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export function SkeletonLine({ width = '100%', height = 11 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height }} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-busy="true" aria-label="Chargement des données">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="sk-row" key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="skeleton"
              style={{ height: 12, width: c === 0 ? '26%' : `${12 + ((r + c) % 3) * 5}%`, borderRadius: 6 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement de la page">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 22 }}>
        <div className="stack gap-8">
          <div className="skeleton" style={{ height: 22, width: 220 }} />
          <div className="skeleton" style={{ height: 11, width: 300 }} />
        </div>
        <div className="skeleton" style={{ height: 38, width: 140, borderRadius: 10 }} />
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {[0, 1, 2, 3].map((key) => (
          <div className="card card-pad" key={key}>
            <div className="skeleton" style={{ height: 10, width: '50%' }} />
            <div className="skeleton" style={{ height: 26, width: '70%', marginTop: 12 }} />
            <div className="skeleton" style={{ height: 9, width: '40%', marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="card"><TableSkeleton rows={8} cols={5} /></div>
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'amber' | 'danger' }) {
  return (
    <div className={clsx('progress', tone !== 'primary' && tone)}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ---------------------------------- Tabs --------------------------------- */

export function Tabs<T extends string>({
  options, value, onChange, className,
}: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void; className?: string }) {
  return (
    <div className={clsx('tabs', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          className={clsx('tab', value === option.value && 'active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Pagination ------------------------------ */

export function Pagination({
  page, pageSize, total, onPage,
}: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const list: (number | string)[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) list.push(i);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  return (
    <div className="table-foot">
      <span className="small muted">
        {total === 0 ? 'Aucun résultat' : <>Affichage de <strong>{from}–{to}</strong> sur <strong>{total}</strong></>}
      </span>
      <div className="pagination">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Page précédente">
          <ChevronLeft size={14} />
        </button>
        {list.map((item, index) => (
          typeof item === 'number'
            ? <button key={item} className={item === page ? 'active' : ''} onClick={() => onPage(item)}>{item}</button>
            : <span key={`gap-${index}`} className="muted" style={{ padding: '0 4px' }}>…</span>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Page suivante">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Page head ------------------------------ */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function ScorePill({ value }: { value: number | null | undefined }) {
  const tone = value === null || value === undefined ? 'na' : value >= 14 ? 'good' : value >= 10 ? 'mid' : 'low';
  return <span className={`score ${tone}`}>{value === null || value === undefined ? '—' : value.toFixed(2).replace('.', ',')}</span>;
}
