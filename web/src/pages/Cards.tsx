import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Nfc, Printer, RefreshCw, SearchX, UserCheck, AlertTriangle, BadgeCheck, ScanLine,
} from 'lucide-react';
import { get, post, patch, qs, ApiError } from '../lib/api';
import type { CardScanResult, CardsResponse, Meta, SchoolCard } from '../lib/types';
import { formatDate } from '../lib/format';
import { nfcAvailable, readNfcTag, writeNfcUrl } from '../lib/nfc';
import {
  Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, StatCard, TableSkeleton,
} from '../components/ui';
import { Modal } from '../components/overlays';
import { StudentIdCard } from '../components/student-card';
import { ScanPanel } from '../components/scan-panel';
import { useToast } from '../components/toast';

export function Cards() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [state, setState] = useState('');
  const [selected, setSelected] = useState<SchoolCard | null>(null);
  const [nfcBusy, setNfcBusy] = useState(false);

  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cards', { search, classId, state }],
    queryFn: () => get<CardsResponse>(`/cards${qs({ search, classId, state })}`),
  });

  const items = data?.items ?? [];
  const stats = data?.stats;

  const filtered = useMemo(() => items, [items]);

  const selectedLive = useMemo(
    () => (selected ? items.find((item) => item.studentId === selected.studentId) ?? selected : null),
    [items, selected],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const issue = useMutation({
    mutationFn: (studentId: string) => post<{ card: SchoolCard }>(`/cards/${studentId}/issue`),
    onSuccess: (result) => {
      invalidate();
      setSelected(result.card);
      toast.success('Nouvelle carte émise', `${result.card.firstName} ${result.card.lastName} · ${result.card.cardCode}`);
    },
    onError: (error: unknown) => toast.error('Émission impossible', error instanceof ApiError ? error.message : 'Réessayez.'),
  });

  const sign = useMutation({
    mutationFn: (studentId: string) => post<CardScanResult>(`/cards/${studentId}/sign`, { source: 'manuel' }),
    onSuccess: (result) => {
      invalidate();
      toast.success(
        result.alreadyMarked ? 'Présence déjà enregistrée' : 'Présence signée',
        `${result.card.firstName} ${result.card.lastName} · ${result.attendance?.status ?? 'present'}`,
      );
    },
    onError: (error: unknown) => toast.error('Pointage impossible', error instanceof ApiError ? error.message : 'Réessayez.'),
  });

  async function linkNfc(card: SchoolCard) {
    setNfcBusy(true);
    try {
      const { promise } = readNfcTag();
      toast.info('Approchez le badge du téléphone', 'Lecture du numéro de série en cours…');
      const { value, serial } = await promise;
      const tag = serial ?? value;
      if (!tag) throw new Error('Badge non identifié.');
      await patch<{ card: SchoolCard }>(`/cards/${card.studentId}/nfc`, { nfcTag: tag });
      invalidate();
      toast.success('Badge associé', `${tag} est désormais lié à ${card.firstName} ${card.lastName}.`);
    } catch (error) {
      toast.error('Association NFC', (error as Error).message);
    } finally {
      setNfcBusy(false);
    }
  }

  async function writeNfc(card: SchoolCard) {
    setNfcBusy(true);
    try {
      const url = `${window.location.origin}${card.scanPath ?? ''}`;
      await writeNfcUrl(url);
      toast.success('Badge programmé', 'Le badge ouvre maintenant la page de pointage de cet élève.');
    } catch (error) {
      toast.error('Écriture NFC', (error as Error).message);
    } finally {
      setNfcBusy(false);
    }
  }

  function printCard() {
    document.body.classList.add('printing-card');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove('printing-card'), 400);
    }, 60);
  }

  return (
    <>
      <PageHeader
        title="Cartes scolaires"
        subtitle="Une carte par élève : QR code, code-barres et badge NFC pour signer les présences."
        actions={(
          <Button variant="secondary" icon={Printer} onClick={printCard} disabled={!selectedLive}>
            Imprimer la carte
          </Button>
        )}
      />

      <div className="grid grid-4">
        <StatCard label="Cartes actives" icon={CreditCard} value={stats?.issued ?? 0} loading={isLoading}
          foot={<span>{stats?.total ?? 0} élèves & étudiants</span>} />
        <StatCard label="Badges NFC" icon={Nfc} tone="violet" value={stats?.nfc ?? 0} loading={isLoading}
          foot={<span>associés à un support physique</span>} />
        <StatCard label="Pointages du jour" icon={UserCheck} tone="info" value={stats?.scansToday ?? 0} loading={isLoading}
          foot={<span>{formatDate(data?.date ?? null)}</span>} />
        <StatCard label="Cartes à émettre" icon={AlertTriangle} tone="amber" value={stats?.missing ?? 0} loading={isLoading}
          foot={<span>générées automatiquement</span>} />
      </div>

      <div className="mt-16">
        <Card>
          <div className="card-body">
            <ScanPanel onScanned={(result) => setSelected(result.card)} />
          </div>
        </Card>
      </div>

      <div className="mt-16 cards-layout">
        <Card>
          <div className="card-head">
            <div>
              <h3>Élèves & étudiants</h3>
              <p className="card-sub">{filtered.length} carte(s) affichée(s)</p>
            </div>
            <Badge tone="neutral" dot>{data?.date ? formatDate(data.date) : '—'}</Badge>
          </div>
          <div className="card-body">
            <div className="filters-row">
              <SearchInput value={search} onChange={setSearch} placeholder="Nom, matricule ou code carte…" />
              <Select value={classId} onChange={(event) => setClassId(event.target.value)} aria-label="Classe">
                <option value="">Toutes les classes</option>
                {(meta.data?.classes ?? []).map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </Select>
              <Select value={state} onChange={(event) => setState(event.target.value)} aria-label="État de la carte">
                <option value="">Toutes les cartes</option>
                <option value="issued">Émises</option>
                <option value="missing">À émettre</option>
                <option value="nfc">Avec badge NFC</option>
              </Select>
            </div>

            {isError && (
              <EmptyState
                icon={AlertTriangle}
                title="Les cartes n'ont pas pu être chargées"
                description="Vérifiez votre connexion puis réessayez."
                action={<Button variant="primary" onClick={() => refetch()}>Réessayer</Button>}
              />
            )}

            {isLoading && <TableSkeleton rows={8} cols={4} />}

            {!isLoading && !isError && filtered.length === 0 && (
              <EmptyState
                icon={SearchX}
                title="Aucune carte"
                description="Aucun élève ne correspond à ces filtres. Les cartes sont créées automatiquement à l'inscription."
              />
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="card-list">
                {filtered.slice(0, 60).map((card) => (
                  <button
                    type="button"
                    key={card.studentId}
                    className={selectedLive?.studentId === card.studentId ? 'card-row active' : 'card-row'}
                    onClick={() => setSelected(card)}
                  >
                    <span className="card-row-avatar">{card.firstName[0]}{card.lastName[0]}</span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="card-row-name truncate">{card.firstName} {card.lastName}</span>
                      <span className="card-row-sub truncate">
                        {card.matricule} · {card.className ?? card.programName ?? 'Sans classe'}
                      </span>
                    </span>
                    <span className="card-row-code">{card.cardCode ?? 'à émettre'}</span>
                    <span className="card-row-flags">
                      {card.nfcTag && <span className="flag nfc" title={card.nfcTag}><Nfc size={12} /></span>}
                      {card.cardCode
                        ? <span className="flag ok" title="Carte émise"><BadgeCheck size={12} /></span>
                        : <span className="flag warn" title="Carte à émettre"><AlertTriangle size={12} /></span>}
                    </span>
                  </button>
                ))}
                {filtered.length > 60 && (
                  <div className="tiny muted" style={{ padding: '10px 4px' }}>
                    Affichage limité à 60 cartes — affinez la recherche pour trouver un élève précis.
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <div className="cards-preview">
          {selectedLive ? (
            <Card>
              <div className="card-head">
                <div>
                  <h3>Aperçu de la carte</h3>
                  <p className="card-sub">{selectedLive.firstName} {selectedLive.lastName} · {selectedLive.matricule}</p>
                </div>
                <Badge tone={selectedLive.cardCode ? 'success' : 'warning'} dot>
                  {selectedLive.cardCode ? 'Émise' : 'À émettre'}
                </Badge>
              </div>
              <div className="card-body stack gap-12">
                <StudentIdCard card={selectedLive} />
                <div className="stack gap-8">
                  <Button variant="primary" icon={UserCheck}
                    onClick={() => sign.mutate(selectedLive.studentId)}
                    disabled={sign.isPending}>
                    Signer la présence
                  </Button>
                  <Button variant="secondary" icon={Printer} onClick={printCard}>Imprimer la carte</Button>
                  <Button variant="secondary" icon={RefreshCw}
                    onClick={() => issue.mutate(selectedLive.studentId)}
                    disabled={issue.isPending}>
                    Réémettre (nouveau code)
                  </Button>
                  {nfcAvailable() ? (
                    <>
                      <Button variant="secondary" icon={Nfc} onClick={() => writeNfc(selectedLive)} disabled={nfcBusy}>
                        Programmer un badge NFC
                      </Button>
                      <Button variant="ghost" icon={ScanLine} onClick={() => linkNfc(selectedLive)} disabled={nfcBusy}>
                        Associer un badge existant
                      </Button>
                    </>
                  ) : (
                    <div className="tiny muted">
                      Le NFC nécessite Chrome sur Android. Le QR code et le code-barres fonctionnent partout.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="card-body">
                <EmptyState
                  icon={CreditCard}
                  title="Sélectionnez un élève"
                  description="Choisissez un élève dans la liste pour afficher sa carte, l'imprimer ou signer sa présence."
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selectedLive)}
        onClose={() => setSelected(null)}
        title="Carte d'identité scolaire"
        description={selectedLive ? `${selectedLive.firstName} ${selectedLive.lastName} · ${selectedLive.className ?? selectedLive.programName ?? 'Sans classe'}` : undefined}
        wide
        footer={selectedLive ? (
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Fermer</Button>
            <Button variant="secondary" icon={Printer} onClick={printCard}>Imprimer</Button>
            <Button variant="primary" icon={UserCheck} onClick={() => sign.mutate(selectedLive.studentId)} disabled={sign.isPending}>
              Signer la présence
            </Button>
          </>
        ) : undefined}
      >
        {selectedLive && (
          <div className="stack gap-16">
            <StudentIdCard card={selectedLive} />
            <div className="grid grid-2" style={{ gap: 12 }}>
              <InfoLine label="Matricule" value={selectedLive.matricule} />
              <InfoLine label="Code carte" value={selectedLive.cardCode ?? 'à émettre'} />
              <InfoLine label="Classe / filière" value={selectedLive.className ?? selectedLive.programName ?? '—'} />
              <InfoLine label="Année scolaire" value={selectedLive.schoolYear} />
              <InfoLine label="Badge NFC" value={selectedLive.nfcTag ?? 'aucun'} />
              <InfoLine label="Émise le" value={selectedLive.issuedAt ? formatDate(selectedLive.issuedAt) : '—'} />
              <InfoLine label="Tuteur" value={selectedLive.guardianName ?? '—'} />
              <InfoLine label="Contact" value={selectedLive.guardianPhone ?? '—'} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-line">
      <span className="tiny muted">{label}</span>
      <span className="strong">{value}</span>
    </div>
  );
}
