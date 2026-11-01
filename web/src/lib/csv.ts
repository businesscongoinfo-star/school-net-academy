export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[";\n\r]/.test(text) ? `"${text}"` : text;
};

/** Construit un CSV compatible Excel/Calc français (séparateur « ; », BOM UTF-8). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(';');
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(';'));
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

export const datedFilename = (base: string) =>
  `${base}-${new Date().toISOString().slice(0, 10)}.csv`;

/** Déclenche le téléchargement d'un CSV et renvoie le nombre de lignes exportées. */
export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): number {
  const blob = new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return rows.length;
}
