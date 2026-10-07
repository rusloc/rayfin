import { getRayfinClient } from './rayfinClient';

/** One purchase-order line from the `_PO_VIEW_` table of the "Coms report" semantic model. */
export interface PoLine {
  poNo: string | null; // _po_no_ekporef
  lineNo: number | null; // _line_no
  masterLine: string | null; // _master_line
  supplierName: string | null; // _supplier_name
  clientName: string | null; // _client_name
  branchBu: string | null; // _branch_bu
  itemCode: string | null; // _item_code
  commodity: string | null; // _commodity
  poStatus: string | null; // _po_status
  poCreationDate: string | null; // _po_creation_date as 'YYYY-MM-DD'
  poNeedByDate: string | null; // _po_need_by_date as 'YYYY-MM-DD'
  etd: string | null; // 'YYYY-MM-DD'
  eta: string | null; // 'YYYY-MM-DD'
  transportMode: string | null;
  originCountry: string | null;
  destinationCountry: string | null; // _destination_country_dest
}

/** Hard cap passed to Analysis Services; exceeding it fails the query with an `overflow` error. */
export const PO_ROW_LIMIT = 50_000;

/**
 * The only DAX in the app. Aliases are the {@link PoLine} property names so
 * the result columns (`[poNo]`, ...) map back without a lookup table.
 */
export const PO_VIEW_DAX = `
EVALUATE
SELECTCOLUMNS (
    '_PO_VIEW_'
    ,"poNo", '_PO_VIEW_'[_po_no_ekporef]
    ,"lineNo", '_PO_VIEW_'[_line_no]
    ,"masterLine", '_PO_VIEW_'[_master_line]
    ,"supplierName", '_PO_VIEW_'[_supplier_name]
    ,"clientName", '_PO_VIEW_'[_client_name]
    ,"branchBu", '_PO_VIEW_'[_branch_bu]
    ,"itemCode", '_PO_VIEW_'[_item_code]
    ,"commodity", '_PO_VIEW_'[_commodity]
    ,"poStatus", '_PO_VIEW_'[_po_status]
    ,"poCreationDate", '_PO_VIEW_'[_po_creation_date]
    ,"poNeedByDate", '_PO_VIEW_'[_po_need_by_date]
    ,"etd", '_PO_VIEW_'[_etd]
    ,"eta", '_PO_VIEW_'[_eta]
    ,"transportMode", '_PO_VIEW_'[_transport_mode]
    ,"originCountry", '_PO_VIEW_'[_origin_country]
    ,"destinationCountry", '_PO_VIEW_'[_destination_country_dest]
)
`.trim();

const STRING_KEYS = [
  'poNo',
  'masterLine',
  'supplierName',
  'clientName',
  'branchBu',
  'itemCode',
  'commodity',
  'poStatus',
  'transportMode',
  'originCountry',
  'destinationCountry',
] as const;

const DATE_KEYS = ['poCreationDate', 'poNeedByDate', 'etd', 'eta'] as const;

/**
 * Fetch every PO line (up to {@link PO_ROW_LIMIT}) as the signed-in user.
 * Throws an `Error` with a user-readable message on any failure.
 */
export async function listPoLines(): Promise<PoLine[]> {
  const client = getRayfinClient();

  let result: Awaited<
    ReturnType<typeof client.connectors.comsreport.executeQuery>
  >;
  try {
    result = await client.connectors.comsreport.executeQuery({
      query: PO_VIEW_DAX,
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

  const { columns, rows } = result.table;
  // Power BI names SELECTCOLUMNS aliases `[alias]`; accept the bare form too.
  const index = new Map<string, number>();
  columns.forEach((col, i) => index.set(stripBrackets(col.name), i));
  const at = (row: unknown[], key: string): unknown => {
    const i = index.get(key);
    return i === undefined ? null : row[i];
  };

  return rows.map((row) => {
    const line = {} as PoLine;
    for (const key of STRING_KEYS) line[key] = toText(at(row, key));
    for (const key of DATE_KEYS) line[key] = toDateOnly(at(row, key));
    line.lineNo = toNumber(at(row, 'lineNo'));
    return line;
  });
}

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
