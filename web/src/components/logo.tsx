import { GraduationCap } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className="brand-mark">
        <GraduationCap size={20} />
      </span>
      {!compact && (
        <span className="brand-text">
          <strong>School Net</strong>
          <span>Academy</span>
        </span>
      )}
    </>
  );
}
