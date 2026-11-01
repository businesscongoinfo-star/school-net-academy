/**
 * Web NFC — badges physiques (Chrome Android, HTTPS uniquement).
 * L'API n'existe pas sur iOS/Safari ni sur la plupart des ordinateurs :
 * l'application retombe alors sur le scan du QR code ou de la douchette.
 */

export type NfcSupport = 'read+write' | 'none';

type NdefRecord = {
  recordType: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
  toRecords?: () => NdefRecord[];
};

type NdefReadingEvent = { message: { records: NdefRecord[] }; serialNumber?: string };

type NdefReader = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  write: (message: { records: { recordType: string; data: string }[] }) => Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
};

type NdefReaderCtor = new () => NdefReader;

export function nfcSupport(): NfcSupport {
  if (typeof window === 'undefined') return 'none';
  return 'NDEFReader' in window ? 'read+write' : 'none';
}

export const nfcAvailable = () => nfcSupport() !== 'none';

function decodeRecord(record: NdefRecord): string | null {
  try {
    const decoder = new TextDecoder(record.encoding || 'utf-8');
    if (record.recordType === 'text' || record.recordType === 'url') {
      return decoder.decode(record.data ?? new DataView(new ArrayBuffer(0)));
    }
    if (record.recordType === 'absolute-url' || record.recordType === 'smart-poster') {
      return decoder.decode(record.data ?? new DataView(new ArrayBuffer(0)));
    }
  } catch {
    /* enregistrement illisible : on l'ignore */
  }
  return null;
}

/**
 * Lit un badge pendant `ms` millisecondes et renvoie le texte lu
 * (URL du QR ou identifiant du badge).
 */
export function readNfcTag(timeout = 20000): {
  promise: Promise<{ value: string; serial: string | null }>;
  cancel: () => void;
} {
  const controller = new AbortController();
  const promise = new Promise<{ value: string; serial: string | null }>((resolve, reject) => {
    const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
    if (!ctor) {
      reject(new Error("La lecture NFC n'est pas disponible sur cet appareil. Utilisez le QR code ou la douchette."));
      return;
    }
    const reader = new ctor();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Aucun badge détecté. Approchez la carte du dos de l'appareil."));
    }, timeout);

    reader.onreading = (event) => {
      const values = event.message.records.map(decodeRecord).filter(Boolean) as string[];
      clearTimeout(timer);
      controller.abort();
      resolve({ value: values[0] ?? event.serialNumber ?? '', serial: event.serialNumber ?? null });
    };
    reader.onreadingerror = () => {
      clearTimeout(timer);
      controller.abort();
      reject(new Error('Badge illisible. Réessayez en maintenant la carte immobile.'));
    };

    reader.scan({ signal: controller.signal }).catch((error: Error) => {
      clearTimeout(timer);
      reject(new Error(error.message || "Impossible de démarrer le lecteur NFC."));
    });
  });

  return { promise, cancel: () => controller.abort() };
}

/** Écrit une URL sur un badge NFC vierge (ou réinscriptible). */
export async function writeNfcUrl(url: string): Promise<void> {
  const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
  if (!ctor) throw new Error("L'écriture NFC n'est pas disponible sur cet appareil.");
  const reader = new ctor();
  await reader.write({ records: [{ recordType: 'url', data: url }] });
}
