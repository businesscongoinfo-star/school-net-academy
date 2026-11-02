import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ScanLine, Nfc, CheckCircle2, AlertTriangle, Loader2, Keyboard, Clock3, XCircle, ShieldCheck, Undo2,
} from 'lucide-react';
import { post, ApiError } from '../lib/api';
import type { CardScanResult } from '../lib/types';
import { nfcAvailable, readNfcTag } from '../lib/nfc';
import { Button, Input } from './ui';
import { useToast } from './toast';

type Status = 'present' | 'retard' | 'absent' | 'excuse';

const STATUS_OPTIONS: { value: Status; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'present', label: 'Présent', icon: CheckCircle2 },
  { value: 'retard', label: 'Retard', icon: Clock3 },
  { value: 'absent', label: 'Absent', icon: XCircle },
  { value: 'excuse', label: 'Excusé', icon: ShieldCheck },
];

/**
 * Pointage par carte : douchette / QR (saisie clavier) ou badge NFC.
 * Utilisé sur la page Présences et sur la page Cartes scolaires.
 */
export function ScanPanel({ onScanned, defaultStatus = 'present' }: {
  onScanned?: (result: CardScanResult) => void;
  defaultStatus?: Status;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [last, setLast] = useState<CardScanResult | null>(null);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useMutation({
    mutationFn: (payload: { code: string; source?: 'qr' | 'barcode' | 'nfc' | 'manuel' }) => (
      post<CardScanResult>('/cards/scan', { ...payload, status })
    ),
    onSuccess: (result, variables) => {
      setLast(result);
      setError(null);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const name = `${result.card.firstName} ${result.card.lastName}`;
      const statut = result.attendance?.status ?? 'present';
      const voie = variables.source === 'nfc' ? 'badge NFC' : 'carte';
      if (statut === 'absent') {
        toast.info(`Absence enregistrée — ${name}`, `${result.card.matricule} · ${voie}`);
      } else if (result.alreadyMarked) {
        toast.info(`${name} était déjà pointé`, `Nouveau statut : ${label(statut)} · ${voie}`);
      } else {
        toast.success(`${label(statut)} — ${name}`, `${result.card.matricule} · ${voie}`);
      }
      onScanned?.(result);
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Pointage impossible.';
      setError(message);
      toast.error('Carte non reconnue', message);
    },
  });

  async function startNfc() {
    setError(null);
    setNfcBusy(true);
    try {
      const { promise } = readNfcTag();
      const { value } = await promise;
      if (!value) throw new Error('Badge vide : aucune donnée lisible.');
      scan.mutate({ code: value, source: 'nfc' });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error('Lecture NFC', message);
    } finally {
      setNfcBusy(false);
    }
  }

  function submit(raw: string, source: 'barcode' | 'manuel') {
    const value = raw.trim();
    if (!value) return;
    scan.mutate({ code: value, source });
  }

  // Une URL de badge NFC ouverte sur téléphone déclenche le pointage automatiquement.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('scan');
    if (param) {
      setCode(param);
      scan.mutate({ code: param, source: 'nfc' });
      const next = new URLSearchParams(window.location.search);
      next.delete('scan');
      window.history.replaceState({}, '', `${window.location.pathname}${next.toString() ? `?${next}` : ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scan-panel">
      <div className="scan-head">
        <span className="scan-icon"><ScanLine size={18} /></span>
        <div className="grow">
          <div className="strong">Pointer par carte</div>
          <div className="tiny muted">
            Scannez le QR code, passez la carte sous la douchette ou approchez un badge NFC :
            le statut sélectionné ({label(status).toLowerCase()}) est enregistré immédiatement.
          </div>
        </div>
        <div className="scan-status">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                className={`chip${status === option.value ? ' active' : ''}${option.value === 'absent' ? ' chip-danger' : ''}`}
                onClick={() => setStatus(option.value)}
                title={`Enregistrer « ${option.label} » au prochain scan`}
              >
                <Icon size={12} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scan-input-row">
        <Input
          ref={inputRef}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit(code, 'barcode');
            }
          }}
          placeholder="Code carte (ex. SNA-26-K7P2QX), matricule ou lien du QR…"
          aria-label="Code de la carte"
        />
        <Button
          variant="primary"
          icon={scan.isPending ? Loader2 : Keyboard}
          onClick={() => submit(code, 'barcode')}
          disabled={scan.isPending || !code.trim()}
        >
          Signer
        </Button>
        {nfcAvailable() && (
          <Button variant="secondary" icon={nfcBusy ? Loader2 : Nfc} onClick={startNfc} disabled={nfcBusy || scan.isPending}>
            {nfcBusy ? 'Approchez la carte…' : 'Badge NFC'}
          </Button>
        )}
      </div>

      <div className="tiny muted row gap-8 wrap" style={{ alignItems: 'center' }}>
        <Undo2 size={12} />
        Sélectionnez « Présent », « Retard », « Absent » ou « Excusé » avant de scanner : un seul geste
        enregistre le pointage du jour.
      </div>

      {!nfcAvailable() && (
        <div className="tiny muted">
          Le NFC s’active sur Android (Chrome). Ici, utilisez le QR code ou une douchette : ils sont toujours disponibles.
        </div>
      )}

      {error && (
        <div className="scan-error"><AlertTriangle size={14} /> {error}</div>
      )}

      {last && (
        <div className={last.alreadyMarked ? 'scan-result again' : 'scan-result'}>
          <span className="scan-avatar">
            {last.card.photo
              ? <img src={last.card.photo} alt="" />
              : <>{last.card.firstName[0]}{last.card.lastName[0]}</>}
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong truncate">{last.card.firstName} {last.card.lastName}</div>
            <div className="tiny muted truncate">
              {last.card.matricule} · {last.card.className ?? last.card.programName ?? 'Sans classe'} ·{' '}
              {last.attendance ? heure(last.attendance.createdAt) : '—'}
            </div>
          </div>
          <span className={`scan-badge ${last.alreadyMarked ? 'again' : ''}${last.attendance?.status === 'absent' ? ' absent' : ''}`}>
            {last.attendance?.status === 'absent'
              ? 'Absence enregistrée'
              : last.alreadyMarked ? 'Déjà pointé' : `${label(last.attendance?.status)} enregistré`}
          </span>
        </div>
      )}
    </div>
  );
}

function label(status?: string | null) {
  if (status === 'retard') return 'Retard';
  if (status === 'absent') return 'Absent';
  if (status === 'excuse') return 'Excusé';
  return 'Présent';
}

function heure(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}
