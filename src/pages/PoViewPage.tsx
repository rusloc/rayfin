import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClientSideRowModelModule,
  DateFilterModule,
  ExternalFilterModule,
  ModuleRegistry,
  RenderApiModule,
  RowApiModule,
  RowStyleModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type FilterModel,
  type IRowNode,
  type ICellRendererParams,
  type ValueFormatterParams,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

import { AppHeader } from '@/components/AppHeader';
import { ColumnPicker } from '@/components/ColumnPicker';
import { JourneyPanel, RouteIcon } from '@/components/JourneyPanel';
import { DocIcon, LineDetailsPanel } from '@/components/LineDetailsPanel';
import { ChartIcon, LateChart } from '@/components/LateChart';
import { LATE_CHART_DATE_COLUMN } from '@/components/lateCounts';
import { NotePanel } from '@/components/NotePanel';
import { EMPTY_SEARCH, type ColumnSearchKey, type PoSearch } from '@/components/poSearch';
import { SearchPanel } from '@/components/SearchPanel';
import {
  DEFAULT_PO_COLUMNS,
  MAX_PO_COLUMNS,
  PO_COLUMNS,
  PO_COLUMN_BY_NAME,
  columnLabel,
} from '@/services/poColumns';
import { listPoNotes, saveLineNote, type PoLineRef, type PoNote } from '@/services/poNotes';
import { isLateLine, lateCutoff } from '@/services/poRules';
import { getPoLine, listPoRows, type PoRow } from '@/services/poView';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  DateFilterModule,
  ExternalFilterModule, // flag / comment search over notes
  RowApiModule, // api.getDisplayedRowCount()
  RowStyleModule, // rowClassRules: late rows
  RenderApiModule, // api.refreshCells() for note cells
  TooltipModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);

const theme = themeQuartz.withParams({
  accentColor: 'oklch(0.546 0.245 262.9)', // blue-600, matches main.css
  fontFamily: 'inherit',
  fontSize: 13,
  headerFontWeight: 600,
  // Colours follow the app theme (main.css re-maps these variables per `data-theme`).
  backgroundColor: 'var(--color-white)',
  foregroundColor: 'var(--color-gray-900)',
  borderColor: 'var(--color-gray-200)',
  headerBackgroundColor: 'var(--color-gray-50)',
  browserColorScheme: 'inherit',
  borderRadius: 12,
  wrapperBorderRadius: 12,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' → 'dd-Mmm-yyyy', the format the COMS report uses; null when absent. */
function formatIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const [y, m, d] = value.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

function formatDate({ value }: ValueFormatterParams<PoRow>) {
  return formatIsoDate(value) ?? '';
}

/** Columns the shipment path popup reads; always fetched, whatever is picked. */
const JOURNEY_COLUMNS = ['_supplier_name', '_client_name', '_pickup_date', '_etd', '_eta', '_arrival_date_actual'];

/** Columns fetched whatever is picked: shipment path popup + late chart. */
const ALWAYS_COLUMNS = [...JOURNEY_COLUMNS, LATE_CHART_DATE_COLUMN];

const JOURNEY_STEPS: [label: string, column: string][] = [
  ['Pickup date', '_pickup_date'],
  ['ETD', '_etd'],
  ['ETA', '_eta'],
  ['Arrival date (actual)', '_arrival_date_actual'],
];

const text = (v: unknown) => (v == null || v === '' ? null : String(v));

function formatDecimal({ value }: ValueFormatterParams<PoRow>) {
  return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';
}

/** The four searchable columns (driven from the Search panel); every column sorts. */
const SEARCH_COLUMNS: Record<ColumnSearchKey, string> = {
  supplier: '_supplier_name',
  masterLine: '_master_line',
  poNo: '_po_no_ekporef',
  needByFrom: '_po_need_by_date',
  needByTo: '_po_need_by_date',
};
const FILTER_COLUMNS = new Set(Object.values(SEARCH_COLUMNS));

const contains = (filter: string) => ({ filterType: 'text', type: 'contains', filter: filter.trim() });

/** Search criteria → AG Grid filter model. Open-ended date ranges use far bounds. */
function toFilterModel(s: PoSearch): FilterModel {
  const model: FilterModel = {};
  if (s.supplier.trim()) model._supplier_name = contains(s.supplier);
  if (s.masterLine.trim()) model._master_line = contains(s.masterLine);
  if (s.poNo.trim()) model._po_no_ekporef = contains(s.poNo);
  if (s.needByFrom || s.needByTo) {
    model._po_need_by_date = {
      filterType: 'date',
      type: 'inRange',
      dateFrom: `${s.needByFrom || '1900-01-01'} 00:00:00`,
      dateTo: `${s.needByTo || '9999-12-31'} 00:00:00`,
    };
  }
  return model;
}

/** Sorted distinct non-empty values of one column, for search suggestions. */
function distinct(rows: PoRow[] | null, column: string): string[] {
  const values = new Set<string>();
  for (const row of rows ?? []) {
    const v = row[column];
    if (typeof v === 'string' && v) values.add(v);
  }
  return [...values].sort((a, b) => a.localeCompare(b)).slice(0, 500);
}

const WIDTHS: Record<string, number> = {
  _po_no_ekporef: 150,
  _line_no: 90,
  _master_line: 150,
  _supplier_name: 260,
  _po_need_by_date: 170,
  _client_name: 200,
  _commodity: 180,
};

const ALL_NAMES = PO_COLUMNS.map((c) => c.name);

function toColDef(name: string): ColDef<PoRow> {
  const type = PO_COLUMN_BY_NAME.get(name)?.type;
  const def: ColDef<PoRow> = {
    colId: name,
    field: name,
    headerName: columnLabel(name),
    headerTooltip: name,
    width: WIDTHS[name],
    filter: FILTER_COLUMNS.has(name),
    filterParams: name === '_po_need_by_date' ? { inRangeInclusive: true } : undefined,
    pinned: name === '_po_no_ekporef' ? 'left' : undefined,
  };
  if (type === 'dateTime') {
    Object.assign(def, { cellDataType: 'dateString', valueFormatter: formatDate, width: def.width ?? 130 });
  } else if (type === 'double') {
    Object.assign(def, { cellDataType: 'number', valueFormatter: formatDecimal });
  } else if (type === 'int64') {
    def.cellDataType = 'number';
  } else {
    def.cellDataType = 'text';
  }
  return def;
}

/** Grid context read by the note cell renderers; refreshed when notes change. */
interface NotesContext {
  noteByLine: Map<string, PoNote>;
  open: (row: PoRow) => void;
  openJourney: (row: PoRow) => void;
  openDetails: (row: PoRow) => void;
  toggleFlag: (row: PoRow) => void;
}

type NoteCellProps = ICellRendererParams<PoRow, unknown, NotesContext>;

function lineNote({ data, context }: NoteCellProps): PoNote | null {
  return context.noteByLine.get(String(data?._line_id)) ?? null;
}

function FlagCell(params: NoteCellProps) {
  const { data, context } = params;
  if (!data) return null;
  const note = lineNote(params);
  const flagged = note?.flagged ?? false;
  return (
    <button
      onClick={() => context.toggleFlag(data)}
      aria-pressed={flagged}
      aria-label={flagged ? 'Remove the flag' : 'Flag this line'}
      title={flagged && note ? `Flag set by ${note.authorEmail}` : undefined}
      className={`text-base leading-none ${flagged ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
    >
      ⚑
    </button>
  );
}

function NotesCell(params: NoteCellProps) {
  const { data, context } = params;
  if (!data) return null;
  const comment = lineNote(params)?.comment;
  return (
    <button
      onClick={() => context.open(data)}
      title={comment ?? 'Add a note'}
      className={`text-xs font-medium ${comment ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 hover:text-blue-500'}`}
    >
      {comment ? '💬 note' : '+ note'}
    </button>
  );
}

function JourneyCell({ data, context }: NoteCellProps) {
  if (!data) return null;
  return (
    <button
      onClick={() => context.openJourney(data)}
      aria-label="Show shipment path"
      title="Shipment path"
      className="flex h-full cursor-pointer items-center text-gray-400 hover:text-blue-600"
    >
      <RouteIcon />
    </button>
  );
}

function DetailsCell({ data, context }: NoteCellProps) {
  if (!data) return null;
  return (
    <button
      onClick={() => context.openDetails(data)}
      aria-label="Show all columns of this line"
      title="All columns"
      className="flex h-full items-center text-gray-400 hover:text-blue-600"
    >
      <DocIcon />
    </button>
  );
}

const NOTE_COLUMNS: ColDef<PoRow>[] = [
  { colId: '__journey', headerName: '', cellRenderer: JourneyCell, width: 48, pinned: 'left', sortable: false, resizable: false },
  { colId: '__details', headerName: '', cellRenderer: DetailsCell, width: 48, pinned: 'left', sortable: false, resizable: false },
  { colId: '__flag', headerName: '', cellRenderer: FlagCell, width: 56, pinned: 'left', sortable: false, resizable: false },
  { colId: '__notes', headerName: 'Notes', cellRenderer: NotesCell, width: 90, pinned: 'left', sortable: false },
];

function toLineRef(row: PoRow): PoLineRef {
  return {
    lineId: String(row._line_id),
    poNo: String(row._po_no_ekporef ?? ''),
    lineNo: row._line_no == null ? null : String(row._line_no),
  };
}

export function PoViewPage() {
  const gridRef = useRef<AgGridReact<PoRow>>(null);
  const [columns, setColumns] = useState<string[]>([...DEFAULT_PO_COLUMNS]);
  const [rows, setRows] = useState<PoRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [shown, setShown] = useState(0);
  const [filtered, setFiltered] = useState(false);
  const [notes, setNotes] = useState<PoNote[]>([]);
  const [openRow, setOpenRow] = useState<PoRow | null>(null);
  const [journeyRow, setJourneyRow] = useState<PoRow | null>(null);
  const [detailsRow, setDetailsRow] = useState<PoRow | null>(null);
  const [search, setSearch] = useState<PoSearch>(EMPTY_SEARCH);

  useEffect(() => {
    listPoNotes()
      .then(setNotes)
      .catch((err: unknown) =>
        setNotesError(err instanceof Error ? `Notes unavailable: ${err.message}` : 'Notes unavailable.')
      );
  }, []);

  // One shared note per line (the service returns at most one per lineId).
  const noteByLine = useMemo(() => new Map(notes.map((n) => [n.lineId, n])), [notes]);

  /** Save the line's shared note and swap it into local state (null = deleted). */
  const saveNote = useCallback(async (line: PoLineRef, state: { flagged: boolean; comment: string | null }) => {
    const saved = await saveLineNote(line, state);
    setNotes((cur) => {
      const rest = cur.filter((n) => n.lineId !== line.lineId);
      return saved ? [...rest, saved] : rest;
    });
  }, []);

  const toggleFlag = useCallback(
    (row: PoRow) => {
      const line = toLineRef(row);
      const note = noteByLine.get(line.lineId);
      saveNote(line, { flagged: !note?.flagged, comment: note?.comment ?? null }).catch((err: unknown) =>
        setNotesError(err instanceof Error ? err.message : 'Could not save the flag.')
      );
    },
    [noteByLine, saveNote]
  );

  // AG Grid reads `context` once (@initial), so keep one object and mutate it,
  // then repaint the note cells.
  // Notes and line details share the right-hand slot: opening one closes the other.
  const context = useRef<NotesContext>({
    noteByLine,
    open: (row) => {
      setDetailsRow(null);
      setOpenRow(row);
    },
    openJourney: setJourneyRow,
    openDetails: (row) => {
      setOpenRow(null);
      setDetailsRow(row);
    },
    toggleFlag,
  }).current;
  useEffect(() => {
    Object.assign(context, { noteByLine, toggleFlag });
    gridRef.current?.api?.refreshCells({ columns: ['__flag', '__notes'], force: true });
  }, [context, noteByLine, toggleFlag]);

  // Re-query on every applied column change; a stale response is dropped.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    listPoRows(columns, ALWAYS_COLUMNS)
      .then((data) => {
        if (stale) return;
        setRows(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (stale) return;
        setRows((prev) => prev ?? []);
        setError(err instanceof Error ? err.message : 'Failed to load PO lines.');
      })
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [columns]);

  const columnDefs = useMemo(() => [...NOTE_COLUMNS, ...columns.map(toColDef)], [columns]);

  // Filters live only in the Search panel; re-apply after columns or data change.
  useEffect(() => {
    gridRef.current?.api?.setFilterModel(toFilterModel(search));
  }, [search, columnDefs, rows]);

  // Flag / comment criteria match notes, not row data, so they run as AG Grid's
  // external filter. The callbacks read refs and the grid is told to re-filter
  // whenever the criteria or the notes change.
  const searchRef = useRef(search);
  const notesRef = useRef(noteByLine);
  useEffect(() => {
    searchRef.current = search;
    notesRef.current = noteByLine;
    gridRef.current?.api?.onFilterChanged();
  }, [search, noteByLine]);

  const isExternalFilterPresent = useCallback(() => {
    const { flag, late, comment, createdMonth } = searchRef.current;
    return flag !== 'any' || late !== 'any' || comment.trim() !== '' || createdMonth !== '';
  }, []);
  const doesExternalFilterPass = useCallback((node: IRowNode<PoRow>) => {
    const { flag, late, comment, createdMonth } = searchRef.current;
    if (late !== 'any' && node.data && isLateLine(node.data, lateCutoff()) !== (late === 'yes')) return false;
    // Creation month is always fetched (late chart), so it filters whatever columns are picked.
    if (createdMonth && String(node.data?.[LATE_CHART_DATE_COLUMN] ?? '').slice(0, 7) !== createdMonth) return false;
    const note = notesRef.current.get(String(node.data?._line_id));
    const flagged = note?.flagged ?? false;
    if (flag === 'yes' && !flagged) return false;
    if (flag === 'no' && flagged) return false;
    const term = comment.trim().toLowerCase();
    return !term || (note?.comment?.toLowerCase().includes(term) ?? false);
  }, []);

  // Pale red: ETA more than 7 days ago and no actual arrival (services/poRules).
  const rowClassRules = useMemo(() => {
    const cutoff = lateCutoff();
    return { 'po-row-late': ({ data }: { data?: PoRow }) => !!data && isLateLine(data, cutoff) };
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps -- recompute the cutoff when data reloads

  const searchEnabled = useMemo(() => {
    const shown = new Set(columns);
    const entries = Object.entries(SEARCH_COLUMNS).map(([key, col]) => [key, shown.has(col)]);
    return Object.fromEntries(entries) as Record<ColumnSearchKey, boolean>;
  }, [columns]);

  const suggestions = useMemo(
    () => ({ supplier: distinct(rows, '_supplier_name'), masterLine: distinct(rows, '_master_line') }),
    [rows]
  );

  const defaultColDef = useMemo<ColDef<PoRow>>(
    () => ({
      resizable: true,
      width: 140,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      // One header row that only sorts: filtering happens in the Search panel.
      suppressHeaderMenuButton: true,
      suppressHeaderFilterButton: true,
    }),
    []
  );

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      <AppHeader title="COMS" />

      <main className="flex-1 min-h-0 flex flex-col gap-3 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Purchase order lines</h2>
            <button
              onClick={() => setChartOpen(true)}
              disabled={!rows?.length}
              aria-label="Late lines chart"
              title="Late lines by PO creation date"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40"
            >
              <ChartIcon />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {rows !== null && !error && (
              <span>
                {shown.toLocaleString()} of {rows.length.toLocaleString()} lines
              </span>
            )}
            {filtered && (
              <button
                onClick={() => setSearch(EMPTY_SEARCH)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}
            <SearchPanel value={search} enabled={searchEnabled} suggestions={suggestions} onApply={setSearch} />
            <ColumnPicker
              all={ALL_NAMES}
              selected={columns}
              defaults={DEFAULT_PO_COLUMNS}
              max={MAX_PO_COLUMNS}
              label={columnLabel}
              onApply={(next) => setColumns((cur) => (cur.join() === next.join() ? cur : next))}
            />
          </div>
        </div>

        {[error, notesError].filter(Boolean).map((message) => (
          <p key={message} role="alert" className="text-sm text-red-600">
            {message}
          </p>
        ))}

        <div className="flex-1 min-h-0">
          <AgGridReact<PoRow>
            ref={gridRef}
            theme={theme}
            rowData={rows}
            loading={loading}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            context={context}
            getRowId={({ data }) => String(data._line_id)}
            onGridReady={({ api }) => api.setFilterModel(toFilterModel(search))}
            rowClassRules={rowClassRules}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            onModelUpdated={({ api }) => {
              setShown(api.getDisplayedRowCount());
              setFiltered(api.isAnyFilterPresent());
            }}
          />
        </div>
      </main>

      {journeyRow && (
        <JourneyPanel
          title={`PO ${text(journeyRow._po_no_ekporef) ?? '—'} · line ${text(journeyRow._line_no) ?? '—'}`}
          supplier={text(journeyRow._supplier_name)}
          client={text(journeyRow._client_name)}
          steps={JOURNEY_STEPS.map(([label, column]) => ({ label, date: formatIsoDate(journeyRow[column]) }))}
          onClose={() => setJourneyRow(null)}
        />
      )}

      {chartOpen && rows && (
        <LateChart
          rows={rows}
          onClose={() => setChartOpen(false)}
          onSelectMonth={(month) => {
            // Show exactly the bar's lines: other criteria are dropped.
            setChartOpen(false);
            setSearch({ ...EMPTY_SEARCH, late: 'yes', createdMonth: month });
          }}
        />
      )}

      {detailsRow && (
        <LineDetailsPanel
          key={String(detailsRow._line_id)}
          lineId={String(detailsRow._line_id)}
          title={`PO ${text(detailsRow._po_no_ekporef) ?? '—'} · line ${text(detailsRow._line_no) ?? '—'}`}
          subtitle={text(detailsRow._supplier_name)}
          load={getPoLine}
          onClose={() => setDetailsRow(null)}
        />
      )}

      {openRow && (
        <NotePanel
          key={String(openRow._line_id)}
          line={toLineRef(openRow)}
          subtitle={openRow._supplier_name == null ? null : String(openRow._supplier_name)}
          note={noteByLine.get(String(openRow._line_id)) ?? null}
          onSave={saveNote}
          onClose={() => setOpenRow(null)}
        />
      )}
    </div>
  );
}
