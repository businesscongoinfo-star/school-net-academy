import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import type { SchoolCard } from '../lib/types';

/**
 * Carte d'identité scolaire — format carte bancaire (85,6 × 54 mm).
 * Recto : identité, QR code (URL de pointage) et code-barres Code 128.
 */
export function StudentIdCard({
  card, size = 'md', className = '',
}: {
  card: SchoolCard;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const code = card.cardCode ?? card.matricule;
  const initials = `${card.firstName?.[0] ?? ''}${card.lastName?.[0] ?? ''}`.toUpperCase();
  const fullName = `${card.firstName} ${card.lastName}`;
  const group = card.className
    ?? (card.programName ? `${card.programName}${card.academicLevel ? ` · ${card.academicLevel}` : ''}` : 'Non affecté');

  const scanUrl = typeof window !== 'undefined' && card.scanPath
    ? `${window.location.origin}${card.scanPath}`
    : (card.cardCode ?? card.matricule);

  useEffect(() => {
    if (!barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, code, {
        format: 'CODE128',
        displayValue: false,
        height: size === 'sm' ? 26 : 34,
        width: 1.5,
        margin: 0,
        background: 'transparent',
        lineColor: '#0a1f1b',
      });
    } catch {
      /* code non encodable : le QR reste disponible */
    }
  }, [code, size]);

  return (
    <div className={`idc idc-${size} ${className}`}>
      <div className="idc-top">
        <div className="idc-brand">
          <span className="idc-logo"><GraduationCap size={size === 'sm' ? 14 : 18} /></span>
          <div>
            <div className="idc-school">{card.schoolName}</div>
            <div className="idc-tagline">Carte d’identité scolaire</div>
          </div>
        </div>
        <div className="idc-year">
          <span>Année</span>
          <strong>{card.schoolYear}</strong>
        </div>
      </div>

      <div className="idc-body">
        <div className="idc-identity">
          <div className="idc-photo" aria-hidden>
            {card.photo ? <img src={card.photo} alt="" /> : (initials || '—')}
          </div>
          <div className="idc-fields">
            <div className="idc-name">{fullName}</div>
            <div className="idc-role">
              {card.studentType === 'etudiant' ? 'Étudiant(e)' : 'Élève'} · {group}
            </div>
            <div className="idc-meta">
              <span><em>Matricule</em> {card.matricule}</span>
              {card.birthDate && <span><em>Né(e) le</em> {formatShort(card.birthDate)}</span>}
            </div>
            <div className="idc-meta">
              <span><em>Carte</em> {card.cardCode ?? 'à émettre'}</span>
              {card.validUntil && <span><em>Valide jusqu’au</em> {formatShort(card.validUntil)}</span>}
            </div>
          </div>
        </div>

        <div className="idc-code">
          <div className="idc-qr">
            <QRCodeSVG
              value={scanUrl}
              size={size === 'sm' ? 64 : 82}
              level="M"
              bgColor="#ffffff"
              fgColor="#0a1f1b"
              marginSize={0}
            />
          </div>
          <div className="idc-barcode"><svg ref={barcodeRef} /></div>
          <div className="idc-code-text">{code}</div>
        </div>
      </div>

      <div className="idc-foot">
        <span><ShieldCheck size={11} /> {card.nfcTag ? `Badge NFC · ${card.nfcTag}` : 'QR · Code 128 · NFC'}</span>
        <span>{card.schoolShort} · {card.city}</span>
      </div>
    </div>
  );
}

function formatShort(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
