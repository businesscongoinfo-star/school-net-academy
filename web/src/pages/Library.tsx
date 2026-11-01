import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Library as LibraryIcon, BookOpen, Users, AlertTriangle, RotateCcw, ArrowLeftRight,
  Download,
} from 'lucide-react';
import { del, get, patch, post, qs, ApiError } from '../lib/api';
import type { Book, Loan, Meta } from '../lib/types';
import { useAuth } from '../lib/auth';
import { LOAN_STATUS, labelOf, toneOf } from '../lib/labels';
import { formatDate, toDateInput } from '../lib/format';
import { datedFilename, downloadCsv } from '../lib/csv';
import {
  Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SearchInput, Select, StatCard,
  TableSkeleton, Tabs,
} from '../components/ui';
import { ConfirmDialog, Modal } from '../components/overlays';
import { useToast } from '../components/toast';

type Tab = 'ouvrages' | 'prets';

type BookForm = {
  title: string; author: string; isbn: string; category: string; copiesTotal: string; shelf: string;
};

const emptyBook: BookForm = { title: '', author: '', isbn: '', category: '', copiesTotal: '1', shelf: '' };

function inTwoWeeks() {
  return new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
}

export function Library() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('ouvrages');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [loanStatus, setLoanStatus] = useState('');
  const [loanSearch, setLoanSearch] = useState('');

  const [bookOpen, setBookOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState<BookForm>(emptyBook);
  const [bookError, setBookError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Book | null>(null);

  const [loanOpen, setLoanOpen] = useState(false);
  const [loanBookId, setLoanBookId] = useState('');
  const [loanStudentId, setLoanStudentId] = useState('');
  const [loanDueAt, setLoanDueAt] = useState(inTwoWeeks());
  const [loanError, setLoanError] = useState<string | null>(null);

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta') });

  const booksQuery = useQuery({
    queryKey: ['books', search, category, availability],
    queryFn: () => get<{ items: Book[]; categories: string[]; stats: Record<string, number> }>(
      `/library/books${qs({ search, category, availability })}`,
    ),
    enabled: tab === 'ouvrages',
  });

  const loansQuery = useQuery({
    queryKey: ['loans', loanStatus, loanSearch],
    queryFn: () => get<{ items: Loan[]; stats: Record<string, number> }>(
      `/library/loans${qs({ status: loanStatus, search: loanSearch })}`,
    ),
    enabled: tab === 'prets',
  });

  const books = booksQuery.data?.items ?? [];
  const loans = loansQuery.data?.items ?? [];
  const stats = booksQuery.data?.stats ?? loansQuery.data?.stats ?? {};

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['books'] });
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  function openCreateBook() {
    setEditingBook(null);
    setBookForm(emptyBook);
    setBookError(null);
    setBookOpen(true);
  }

  function openEditBook(book: Book) {
    setEditingBook(book);
    setBookForm({
      title: book.title, author: book.author ?? '', isbn: book.isbn ?? '', category: book.category ?? '',
      copiesTotal: String(book.copiesTotal), shelf: book.shelf ?? '',
    });
    setBookError(null);
    setBookOpen(true);
  }

  const saveBook = useMutation({
    mutationFn: (payload: BookForm) => (
      editingBook ? patch(`/library/books/${editingBook.id}`, payload) : post('/library/books', payload)
    ),
    onSuccess: () => {
      invalidate();
      toast.success(editingBook ? 'Ouvrage mis à jour' : 'Ouvrage ajouté', bookForm.title);
      setBookOpen(false);
    },
    onError: (error: ApiError) => setBookError(error.message),
  });

  const deleteBook = useMutation({
    mutationFn: (id: string) => del(`/library/books/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Ouvrage supprimé');
      setToDelete(null);
    },
    onError: (error: ApiError) => toast.error('Suppression impossible', error.message),
  });

  const createLoan = useMutation({
    mutationFn: () => post('/library/loans', { bookId: loanBookId, studentId: loanStudentId, dueAt: loanDueAt }),
    onSuccess: () => {
      invalidate();
      toast.success('Prêt enregistré', 'Retour prévu le ' + formatDate(loanDueAt));
      setLoanOpen(false);
      setLoanBookId('');
      setLoanStudentId('');
      setLoanDueAt(inTwoWeeks());
      setTab('prets');
    },
    onError: (error: ApiError) => setLoanError(error.message),
  });

  const returnLoan = useMutation({
    mutationFn: (id: string) => patch(`/library/loans/${id}`, { status: 'rendu' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['loans'] });
      const previous = queryClient.getQueriesData<{ items: Loan[]; stats: Record<string, number> }>({ queryKey: ['loans'] });
      queryClient.setQueriesData<{ items: Loan[]; stats: Record<string, number> }>({ queryKey: ['loans'] }, (old) => (
        old ? { ...old, items: old.items.map((loan) => (loan.id === id ? { ...loan, status: 'rendu', late: false } : loan)) } : old
      ));
      return { previous };
    },
    onError: (error: ApiError, _id, context) => {
      context?.previous?.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error('Retour impossible', error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Livre rendu', 'Disponibilité mise à jour.');
    },
  });

  function submitBook() {
    if (bookForm.title.trim().length < 2) return setBookError("Le titre de l'ouvrage est requis.");
    saveBook.mutate(bookForm);
    return undefined;
  }

  function submitLoan() {
    if (!loanBookId) return setLoanError('Sélectionnez un ouvrage.');
    if (!loanStudentId) return setLoanError('Sélectionnez un emprunteur.');
    createLoan.mutate();
    return undefined;
  }

  const students = (meta?.students ?? []).filter((student) => student.status === 'actif');
  const availableBooks = books.filter((book) => book.copiesAvailable > 0);

  function exportCsv() {
    const count = tab === 'ouvrages'
      ? downloadCsv(datedFilename('catalogue-bibliotheque'), books, [
        { header: 'Titre', value: (b) => b.title },
        { header: 'Auteur', value: (b) => b.author ?? '' },
        { header: 'ISBN', value: (b) => b.isbn ?? '' },
        { header: 'Catégorie', value: (b) => b.category ?? '' },
        { header: 'Rayon', value: (b) => b.shelf ?? '' },
        { header: 'Exemplaires', value: (b) => b.copiesTotal },
        { header: 'Disponibles', value: (b) => b.copiesAvailable },
        { header: 'Prêts actifs', value: (b) => b.activeLoans },
      ])
      : downloadCsv(datedFilename('prets-bibliotheque'), loans, [
        { header: 'Ouvrage', value: (l) => l.bookTitle },
        { header: 'Emprunteur', value: (l) => l.studentName },
        { header: 'Matricule', value: (l) => l.matricule },
        { header: 'Classe / Filière', value: (l) => l.className ?? l.programName ?? '' },
        { header: 'Prêté le', value: (l) => l.loanedAt },
        { header: 'Retour prévu', value: (l) => l.dueAt },
        { header: 'Rendu le', value: (l) => l.returnedAt ?? '' },
        { header: 'Statut', value: (l) => labelOf(LOAN_STATUS, l.status) },
      ]);
    toast.success('Export CSV prêt', `${count} ligne(s) exportée(s).`);
  }


  return (
    <>
      <PageHeader
        title="Bibliothèque"
        subtitle="Catalogue, exemplaires disponibles et suivi des prêts."
        actions={(
          <>
            <Button
              icon={Download}
              onClick={exportCsv}
              disabled={tab === 'ouvrages' ? !books.length : !loans.length}
            >
              Exporter
            </Button>
            {tab === 'ouvrages' && isAdmin && (
              <Button variant="secondary" icon={Plus} onClick={openCreateBook}>Ajouter un ouvrage</Button>
            )}
            {isAdmin && (
              <Button variant="primary" icon={ArrowLeftRight} onClick={() => { setLoanError(null); setLoanOpen(true); }}>
                Enregistrer un prêt
              </Button>
            )}
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard label="Ouvrages" value={stats.total ?? 0} icon={BookOpen} loading={booksQuery.isLoading || loansQuery.isLoading} foot={<span>{stats.copies ?? 0} exemplaires</span>} />
        <StatCard label="Disponibles" value={stats.disponibles ?? 0} icon={LibraryIcon} tone="info" loading={booksQuery.isLoading} foot={<span>Prêts possibles</span>} />
        <StatCard label="Prêts en cours" value={stats.enCours ?? 0} icon={Users} tone="violet" loading={loansQuery.isLoading} foot={<span>{stats.emprunts ?? 0} ouvrages sortis</span>} />
        <StatCard label="Retards" value={stats.retards ?? 0} icon={AlertTriangle} tone="danger" loading={loansQuery.isLoading} foot={<span>Relances à effectuer</span>} />
      </div>

      <Card className="mt-16">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <Tabs
            value={tab}
            onChange={(value) => setTab(value)}
            options={[
              { value: 'ouvrages', label: 'Catalogue', count: stats.total ?? 0 },
              { value: 'prets', label: 'Prêts', count: (stats.enCours ?? 0) + (stats.retards ?? 0) },
            ]}
          />
        </div>

        {tab === 'ouvrages' && (
          <>
            <div className="table-toolbar" style={{ flexWrap: 'wrap' }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Titre, auteur ou ISBN…" />
              <div className="filter-bar">
                <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Catégorie">
                  <option value="">Toutes catégories</option>
                  {(booksQuery.data?.categories ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
                <Select value={availability} onChange={(event) => setAvailability(event.target.value)} aria-label="Disponibilité">
                  <option value="">Tous</option>
                  <option value="disponible">Disponibles</option>
                  <option value="epuise">Épuisés</option>
                </Select>
              </div>
            </div>

            {booksQuery.isLoading && <div className="card-pad"><TableSkeleton rows={6} cols={4} /></div>}
            {booksQuery.isError && (
              <div className="card-pad"><EmptyState icon={AlertTriangle} title="Chargement impossible" action={<Button onClick={() => booksQuery.refetch()}>Réessayer</Button>} /></div>
            )}
            {!booksQuery.isLoading && !booksQuery.isError && books.length === 0 && (
              <div className="card-pad">
                <EmptyState
                  icon={LibraryIcon}
                  title="Aucun ouvrage"
                  description={search || category ? 'Aucun résultat pour ces filtres.' : 'Constituez le fonds documentaire de l’établissement.'}
                  action={isAdmin ? <Button variant="primary" icon={Plus} onClick={openCreateBook}>Ajouter un ouvrage</Button> : undefined}
                />
              </div>
            )}

            {!booksQuery.isLoading && books.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ouvrage</th>
                      <th className="hide-sm">Catégorie</th>
                      <th className="hide-sm">Rayon</th>
                      <th>Disponibilité</th>
                      <th>Emprunts</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id}>
                        <td>
                          <div className="cell-main">{book.title}</div>
                          <div className="cell-sub">{book.author ?? 'Auteur inconnu'}{book.isbn ? ` · ${book.isbn}` : ''}</div>
                        </td>
                        <td className="hide-sm">
                          {book.category ? <Badge tone="neutral">{book.category}</Badge> : <span className="muted">—</span>}
                        </td>
                        <td className="hide-sm tiny muted">{book.shelf ?? '—'}</td>
                        <td>
                          <div className="cell-main" style={{ fontWeight: 500 }}>
                            {book.copiesAvailable} / {book.copiesTotal}
                          </div>
                          <div className="cell-sub">
                            {book.copiesAvailable === 0
                              ? 'Tous empruntés'
                              : `${book.copiesAvailable} exemplaire(s) libre(s)`}
                          </div>
                        </td>
                        <td>
                          <Badge tone={book.activeLoans > 0 ? 'info' : 'neutral'}>
                            {book.activeLoans} en cours
                          </Badge>
                        </td>
                        <td>
                          <div className="actions" style={{ opacity: 1 }}>
                            {isAdmin && book.copiesAvailable > 0 && (
                              <IconButton
                                icon={ArrowLeftRight}
                                label="Prêter"
                                onClick={() => {
                                  setLoanBookId(book.id);
                                  setLoanError(null);
                                  setLoanOpen(true);
                                }}
                              />
                            )}
                            {isAdmin && <IconButton icon={Pencil} label="Modifier" onClick={() => openEditBook(book)} />}
                            {isAdmin && <IconButton icon={Trash2} label="Supprimer" tone="danger" onClick={() => setToDelete(book)} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-foot"><span>{books.length} ouvrage(s) · {stats.copies ?? 0} exemplaires au total</span></div>
          </>
        )}

        {tab === 'prets' && (
          <>
            <div className="table-toolbar" style={{ flexWrap: 'wrap' }}>
              <SearchInput value={loanSearch} onChange={setLoanSearch} placeholder="Ouvrage, emprunteur ou matricule…" />
              <div className="filter-bar">
                <Tabs
                  value={loanStatus}
                  onChange={(value) => setLoanStatus(value)}
                  options={[
                    { value: '', label: 'Tous' },
                    { value: 'en_cours', label: 'En cours' },
                    { value: 'retard', label: 'Retards' },
                    { value: 'rendu', label: 'Rendus' },
                  ]}
                />
              </div>
            </div>

            {loansQuery.isLoading && <div className="card-pad"><TableSkeleton rows={6} cols={4} /></div>}
            {!loansQuery.isLoading && loans.length === 0 && (
              <div className="card-pad">
                <EmptyState
                  icon={ArrowLeftRight}
                  title="Aucun prêt"
                  description="Les emprunts enregistrés apparaîtront ici avec leur échéance."
                  action={isAdmin ? <Button variant="primary" icon={Plus} onClick={() => setLoanOpen(true)}>Enregistrer un prêt</Button> : undefined}
                />
              </div>
            )}

            {loans.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ouvrage</th>
                      <th>Emprunteur</th>
                      <th className="hide-sm">Sortie</th>
                      <th>Échéance</th>
                      <th>Statut</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          <div className="cell-main">{loan.bookTitle}</div>
                          <div className="cell-sub">{loan.bookAuthor ?? ''}</div>
                        </td>
                        <td>
                          <div className="cell-main" style={{ fontWeight: 500 }}>{loan.studentName}</div>
                          <div className="cell-sub">
                            {loan.matricule} · {loan.className ?? loan.programName ?? '—'}
                          </div>
                        </td>
                        <td className="hide-sm tiny muted">{formatDate(loan.loanedAt)}</td>
                        <td className="nowrap">
                          <span className={loan.late ? 'strong' : ''} style={loan.late ? { color: 'var(--danger)' } : undefined}>
                            {formatDate(loan.dueAt)}
                          </span>
                        </td>
                        <td>
                          <Badge tone={loan.late ? 'danger' : toneOf(LOAN_STATUS, loan.status)} dot>
                            {loan.late ? 'En retard' : labelOf(LOAN_STATUS, loan.status)}
                          </Badge>
                        </td>
                        <td>
                          <div className="actions" style={{ opacity: 1 }}>
                            {isAdmin && loan.status !== 'rendu' && (
                              <Button
                                size="sm"
                                variant="soft"
                                icon={RotateCcw}
                                loading={returnLoan.isPending && returnLoan.variables === loan.id}
                                onClick={() => returnLoan.mutate(loan.id)}
                              >
                                Retour
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-foot">
              <span>{loans.length} prêt(s) · {stats.retards ?? 0} en retard</span>
            </div>
          </>
        )}
      </Card>

      {/* Formulaire ouvrage */}
      <Modal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        title={editingBook ? "Modifier l'ouvrage" : 'Ajouter un ouvrage'}
        description="Le nombre d'exemplaires détermine les prêts possibles."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setBookOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={saveBook.isPending} onClick={submitBook}>
              {editingBook ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </>
        )}
      >
        <div className="form-grid">
          {bookError && (
            <div className="span-2" style={{ background: 'var(--danger-soft)', color: '#a52f23', padding: '9px 12px', borderRadius: 9, fontSize: 12.5 }}>
              {bookError}
            </div>
          )}
          <Field label="Titre" htmlFor="bTitle" className="span-2">
            <Input id="bTitle" value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} placeholder="Les Bouts de bois de Dieu" />
          </Field>
          <Field label="Auteur" htmlFor="bAuthor">
            <Input id="bAuthor" value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} placeholder="Sembène Ousmane" />
          </Field>
          <Field label="Catégorie" htmlFor="bCat">
            <Input id="bCat" value={bookForm.category} onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })} placeholder="Roman, Sciences…" />
          </Field>
          <Field label="ISBN" htmlFor="bIsbn">
            <Input id="bIsbn" value={bookForm.isbn} onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })} placeholder="978-2-…" />
          </Field>
          <Field label="Rayon" htmlFor="bShelf">
            <Input id="bShelf" value={bookForm.shelf} onChange={(event) => setBookForm({ ...bookForm, shelf: event.target.value })} placeholder="A1" />
          </Field>
          <Field label="Exemplaires" htmlFor="bCopies" className="span-2">
            <Input id="bCopies" type="number" min={1} max={500} value={bookForm.copiesTotal} onChange={(event) => setBookForm({ ...bookForm, copiesTotal: event.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Formulaire prêt */}
      <Modal
        open={loanOpen}
        onClose={() => setLoanOpen(false)}
        title="Enregistrer un prêt"
        description="Un exemplaire sera déduit de la disponibilité jusqu'au retour."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setLoanOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={createLoan.isPending} onClick={submitLoan}>Valider le prêt</Button>
          </>
        )}
      >
        <div className="form-grid">
          {loanError && (
            <div className="span-2" style={{ background: 'var(--danger-soft)', color: '#a52f23', padding: '9px 12px', borderRadius: 9, fontSize: 12.5 }}>
              {loanError}
            </div>
          )}
          <Field label="Ouvrage" htmlFor="lBook" className="span-2" hint={`${availableBooks.length} ouvrage(s) disponible(s)`}>
            <Select id="lBook" value={loanBookId} onChange={(event) => setLoanBookId(event.target.value)}>
              <option value="">Sélectionner un ouvrage…</option>
              {(availableBooks.length ? availableBooks : books).map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} — {book.copiesAvailable}/{book.copiesTotal} disponible(s)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Emprunteur" htmlFor="lStudent" className="span-2">
            <Select id="lStudent" value={loanStudentId} onChange={(event) => setLoanStudentId(event.target.value)}>
              <option value="">Sélectionner un élève ou étudiant…</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} — {student.matricule}{student.className ? ` · ${student.className}` : student.programName ? ` · ${student.programName}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date de retour prévue" htmlFor="lDue" className="span-2">
            <Input id="lDue" type="date" value={toDateInput(loanDueAt)} onChange={(event) => setLoanDueAt(event.target.value)} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteBook.mutate(toDelete.id)}
        loading={deleteBook.isPending}
        title="Supprimer l'ouvrage"
        description={toDelete ? `${toDelete.title} sera retiré du catalogue. Un ouvrage emprunté ne peut pas être supprimé.` : ''}
        confirmLabel="Supprimer"
      />
    </>
  );
}
