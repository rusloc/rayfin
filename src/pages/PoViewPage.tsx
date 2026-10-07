import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClientSideRowModelModule,
  DateFilterModule,
  ModuleRegistry,
  RenderApiModule,
  RowApiModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type ValueFormatterParams,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

import { AppHeader } from '@/components/AppHeader';
import { ColumnPicker } from '@/components/ColumnPicker';
import { NotePanel } from '@/components/NotePanel';
import { useAuth } from '@/hooks/AuthContext';
import {
  DEFAULT_PO_COLUMNS,
  MAX_PO_COLUMNS,
  PO_COLUMNS,
  PO_COLUMN_BY_NAME,
  columnLabel,
} from '@/services/poColumns';
import { listPoNotes, saveMyNote, type PoLineRef, type PoNote } from '@/services/poNotes';
import { listPoRows, type PoRow } from '@/services/poView';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  DateFilterModule,
  RowApiModule, // api.getDisplayedRowCount()
  RenderApiModule, // api.refreshCells() for note cells
  TooltipModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);

const theme = themeQuartz.withParams({
  accentColor: 'oklch(0.546 0.245 262.9)', // blue-600, matches main.css
  fontFamily: 'inherit',
  fontSize: 13,
  headerFontWeight: 600,
  headerBackgroundColor: '#f9fafb',
  borderRadius: 12,
  wrapperBorderRadius: 12,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' → 'dd-Mmm-yyyy', the format the COMS report uses. */
function formatDate({ value }: ValueFormatterParams<PoRow>) {
  if (typeof value !== 'string') return '';
  const [y, m, d] = value.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

function formatDecimal({ value }: ValueFormatterParams<PoRow>) {
  return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';
}

/** The four requested filter columns; every column sorts. */
const FILTER_COLUMNS = new Set(['_supplier_name', '_master_line', '_po_no_ekporef', '_po_need_by_date']);

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
  notesByLine: Map<string, PoNote[]>;
  userId: string | null;
  open: (row: PoRow) => void;
  toggleFlag: (row: PoRow) => void;
}

type NoteCellProps = ICellRendererParams<PoRow, unknown, NotesContext>;

function lineNotes({ data, context }: NoteCellProps): PoNote[] {
  return context.notesByLine.get(String(data?._line_id)) ?? [];
}

function FlagCell(params: NoteCellProps) {
  const { data, context } = params;
  if (!data) return null;
  const notes = lineNotes(params);
  const mine = notes.find((n) => n.userId === context.userId)?.flagged ?? false;
  const others = notes.filter((n) => n.flagged && n.userId !== context.userId).length;
  return (
    <button
      onClick={() => context.toggleFlag(data)}
      aria-pressed={mine}
      aria-label={mine ? 'Remove my flag' : 'Flag this line'}
      title={others ? `Flagged by ${others} other user(s)` : undefined}
      className={`text-base leading-none ${mine ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
    >
      ⚑{others > 0 && <sup className="ml-0.5 text-[10px] text-amber-600">{others}</sup>}
    </button>
  );
}

function NotesCell(params: NoteCellProps) {
  const { data, context } = params;
  if (!data) return null;
  const withText = lineNotes(params).filter((n) => n.comment);
  return (
    <button
      onClick={() => context.open(data)}
      title={withText[0]?.comment ?? 'Add a note'}
      className={`text-xs font-medium ${withText.length ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 hover:text-blue-500'}`}
    >
      {withText.length ? `💬 ${withText.length}` : '+ note'}
    </button>
  );
}

const NOTE_COLUMNS: ColDef<PoRow>[] = [
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const gridRef = useRef<AgGridReact<PoRow>>(null);
  const [columns, setColumns] = useState<string[]>([...DEFAULT_PO_COLUMNS]);
  const [rows, setRows] = useState<PoRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [filtered, setFiltered] = useState(false);
  const [notes, setNotes] = useState<PoNote[]>([]);
  const [openRow, setOpenRow] = useState<PoRow | null>(null);

  useEffect(() => {
    listPoNotes()
      .then(setNotes)
      .catch((err: unknown) =>
        setError(err instanceof Error ? `Notes unavailable: ${err.message}` : 'Notes unavailable.')
      );
  }, []);

  const notesByLine = useMemo(() => {
    const map = new Map<string, PoNote[]>();
    for (const n of notes) map.set(n.lineId, [...(map.get(n.lineId) ?? []), n]);
    return map;
  }, [notes]);

  /** Save my note on a line and swap it into local state (null = deleted). */
  const saveNote = useCallback(
    async (line: PoLineRef, state: { flagged: boolean; comment: string | null }) => {
      const saved = await saveMyNote(line, state);
      setNotes((cur) => {
        const rest = cur.filter((n) => !(n.lineId === line.lineId && n.userId === userId));
        return saved ? [...rest, saved] : rest;
      });
    },
    [userId]
  );

  const toggleFlag = useCallback(
    (row: PoRow) => {
      const line = toLineRef(row);
      const mine = notesByLine.get(line.lineId)?.find((n) => n.userId === userId);
      saveNote(line, { flagged: !mine?.flagged, comment: mine?.comment ?? null }).catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not save the flag.')
      );
    },
    [notesByLine, userId, saveNote]
  );

  // AG Grid reads `context` once (@initial), so keep one object and mutate it,
  // then repaint the note cells.
  const context = useRef<NotesContext>({ notesByLine, userId, open: setOpenRow, toggleFlag }).current;
  useEffect(() => {
    Object.assign(context, { notesByLine, userId, toggleFlag });
    gridRef.current?.api?.refreshCells({ columns: ['__flag', '__notes'], force: true });
  }, [context, notesByLine, userId, toggleFlag]);

  // Re-query on every applied column change; a stale response is dropped.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    listPoRows(columns)
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

  const defaultColDef = useMemo<ColDef<PoRow>>(
    () => ({ floatingFilter: true, resizable: true, width: 140, wrapHeaderText: true, autoHeaderHeight: true }),
    []
  );

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      <AppHeader title="COMS" />

      <main className="flex-1 min-h-0 flex flex-col gap-3 px-8 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Purchase order lines</h2>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {rows !== null && !error && (
              <span>
                {shown.toLocaleString()} of {rows.length.toLocaleString()} lines
              </span>
            )}
            {filtered && (
              <button
                onClick={() => gridRef.current?.api.setFilterModel(null)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}
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

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

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
            onModelUpdated={({ api }) => {
              setShown(api.getDisplayedRowCount());
              setFiltered(api.isAnyFilterPresent());
            }}
          />
        </div>
      </main>

      {openRow && (
        <NotePanel
          key={String(openRow._line_id)}
          line={toLineRef(openRow)}
          subtitle={openRow._supplier_name == null ? null : String(openRow._supplier_name)}
          notes={notesByLine.get(String(openRow._line_id)) ?? []}
          userId={userId}
          onSave={saveNote}
          onClose={() => setOpenRow(null)}
        />
      )}
    </div>
  );
}
