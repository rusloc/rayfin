import { PO_COLUMNS } from '@/services/poColumns';
import type { PoRow } from '@/services/poView';

export type DetailsFormat = 'text' | 'json';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function display(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const type = PO_COLUMNS.find((c) => c.name === name)?.type;
  if (type === 'dateTime' && typeof value === 'string') {
    const [y, m, d] = value.split('-');
    return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
  }
  return String(value);
}

/** One `Label: value` line per catalog column, in catalog order; empty values show as '—'. */
export function lineAsText(row: PoRow): string {
  return PO_COLUMNS.map((c) => `${c.label}: ${display(c.name, row[c.name])}`).join('\n');
}

/** The record as pretty JSON: model column names as keys (catalog order), raw values, null when empty. */
export function lineAsJson(row: PoRow): string {
  const ordered = Object.fromEntries(PO_COLUMNS.map((c) => [c.name, row[c.name] ?? null]));
  return JSON.stringify(ordered, null, 2);
}
