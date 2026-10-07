import { getRayfinClient } from './rayfinClient';
import { MAX_PO_COLUMNS, PO_COLUMN_BY_NAME, type PoColumnType } from './poColumns';

/** Keys are model column names (e.g. '_po_no_ekporef'); dateTime → 'YYYY-MM-DD'; blank/whitespace string → null. */
export type PoRow = Record<string, string | number | null>;

/** Hard cap passed to Analysis Services; exceeding it fails the query with an `overflow` error. */
export const PO_ROW_LIMIT = 50_000;

/**
 * Key columns every row carries regardless of the caller's pick, so PO line
 * notes can attach to any row (ADR-0005). `_line_id` is the unique row key;
 * the other two are kept on the note for display.
 */
export const PO_KEY_COLUMNS: readonly string[] = [
  '_line_id',
  '_po_no_ekporef',
  '_line_no',
];

/**
 * Fetch every `_PO_VIEW_` row (up to {@link PO_ROW_LIMIT}) for the given
 * columns plus {@link PO_KEY_COLUMNS}, as the signed-in user. The caller's
 * list is validated and capped on its own; the key columns are appended
 * afterwards (de-duplicated) and never count against {@link MAX_PO_COLUMNS}.
 * `extra` names columns a feature always needs (e.g. the shipment path popup);
 * they are checked against the catalog like any column and are not capped.
 * Throws an `Error` with a user-readable message on invalid input or any
 * query failure.
 */
export async function listPoRows(
  columns: readonly string[],
  extra: readonly string[] = []
): Promise<PoRow[]> {
  const unknownExtra = extra.filter((n) => !PO_COLUMN_BY_NAME.has(n));
  if (unknownExtra.length > 0) {
    throw new Error(`Unknown PO view column(s): ${unknownExtra.join(', ')}.`);
  }
  const names = [...new Set([...validateColumns(columns), ...PO_KEY_COLUMNS, ...extra])];
  const client = getRayfinClient();

  let result: Awaited<
    ReturnType<typeof client.connectors.comsreport.executeQuery>
  >;
  try {
    result = await client.connectors.comsreport.executeQuery({
      query: buildPoDax(names),
      resultSetRowCountLimit: PO_ROW_LIMIT,
    });
  } catch (err) {
    throw new Error(
      `Could not reach the Coms report model: ${errorMessage(err)}`
    );
  }

  if (result.status !== 'success') {
    throw new Error(toUserMessage(result.error.category, result.error.message));
  }

  const { columns: resultColumns, rows } = result.table;
  // Power BI names SELECTCOLUMNS aliases `[alias]`; accept the bare form too.
  const index = new Map<string, number>();
  resultColumns.forEach((col, i) => index.set(stripBrackets(col.name), i));

  const mappers = names.map((name) => ({
    name,
    at: index.get(name),
    convert: CONVERTERS[PO_COLUMN_BY_NAME.get(name)!.type],
  }));

  return rows.map((row) => {
    const out: PoRow = {};
    for (const { name, at, convert } of mappers) {
      out[name] = at === undefined ? null : convert(row[at]);
    }
    return out;
  });
}

/**
 * Whitelist check against the column catalog. This is also the DAX-injection
 * guard: only catalog names ever reach the query text. Duplicates collapse.
 */
function validateColumns(columns: readonly string[]): string[] {
  const names = [...new Set(columns)];
  if (names.length === 0) {
    throw new Error('Pick at least one column.');
  }
  if (names.length > MAX_PO_COLUMNS) {
    throw new Error(
      `Pick at most ${MAX_PO_COLUMNS} columns (you picked ${names.length}).`
    );
  }
  const unknown = names.filter((n) => !PO_COLUMN_BY_NAME.has(n));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown PO view column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`
    );
  }
  return names;
}

/** `EVALUATE SELECTCOLUMNS ( '_PO_VIEW_', "<name>", '_PO_VIEW_'[<name>], ... )`, alias = model column name. */
function buildPoDax(names: readonly string[]): string {
  const lines = names.map((n) => `    ,"${n}", '_PO_VIEW_'[${n}]`);
  return ['EVALUATE', 'SELECTCOLUMNS (', "    '_PO_VIEW_'", ...lines, ')'].join(
    '\n'
  );
}

const CONVERTERS: Record<PoColumnType, (value: unknown) => string | number | null> = {
  string: toText,
  int64: toNumber,
  double: toNumber,
  dateTime: toDateOnly,
};

function toUserMessage(category: string, message: string): string {
  switch (category) {
    case 'overflow':
      return `The PO view returned more than ${PO_ROW_LIMIT.toLocaleString('en-US')} rows — narrow the query.`;
    case 'api':
      return (
        `The Coms report model rejected the request: ${message} ` +
        'Check that you have Build permission on the semantic model and that the tenant setting ' +
        '"Dataset Execute Queries REST API" is enabled.'
      );
    default:
      return message;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stripBrackets(name: string): string {
  return name.startsWith('[') && name.endsWith(']') ? name.slice(1, -1) : name;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 'YYYY-MM-DD' from a timezone-unaware DateTime. The connector delivers ISO
 * strings without a zone ('2026-03-05T00:00:00' or '...T00:00:00.000'), so the
 * date part is taken verbatim — never via a local `Date`, which could shift the day.
 */
function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}
