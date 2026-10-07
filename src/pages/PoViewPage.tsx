import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClientSideRowModelModule,
  DateFilterModule,
  ModuleRegistry,
  TextFilterModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type ValueFormatterParams,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

import { AppHeader } from '@/components/AppHeader';
import { listPoLines, type PoLine } from '@/services/poView';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  DateFilterModule,
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
function formatDate({ value }: ValueFormatterParams<PoLine, string | null>) {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

const dateCol = { cellDataType: 'dateString', valueFormatter: formatDate, width: 130 } as const;

/** The four requested filter columns carry `filter: true`; every column sorts. */
const COLUMNS: ColDef<PoLine>[] = [
  { field: 'poNo', headerName: 'PO no', filter: true, pinned: 'left', width: 150 },
  { field: 'lineNo', headerName: 'Line', width: 80 },
  { field: 'masterLine', headerName: 'Master line', filter: true, width: 160 },
  { field: 'supplierName', headerName: 'Supplier', filter: true, width: 260 },
  { field: 'poNeedByDate', headerName: 'Need-by date', filter: true, ...dateCol, width: 170 },
  { field: 'poStatus', headerName: 'PO status' },
  { field: 'clientName', headerName: 'Client', width: 200 },
  { field: 'branchBu', headerName: 'Branch / BU' },
  { field: 'itemCode', headerName: 'Item code' },
  { field: 'commodity', headerName: 'Commodity', width: 180 },
  { field: 'poCreationDate', headerName: 'PO created', ...dateCol },
  { field: 'etd', headerName: 'ETD', ...dateCol },
  { field: 'eta', headerName: 'ETA', ...dateCol },
  { field: 'transportMode', headerName: 'Mode', width: 110 },
  { field: 'originCountry', headerName: 'Origin' },
  { field: 'destinationCountry', headerName: 'Destination' },
];

export function PoViewPage() {
  const gridRef = useRef<AgGridReact<PoLine>>(null);
  const [rows, setRows] = useState<PoLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [filtered, setFiltered] = useState(false);

  useEffect(() => {
    listPoLines()
      .then(setRows)
      .catch((err: unknown) => {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Failed to load PO lines.');
      });
  }, []);

  const defaultColDef = useMemo<ColDef<PoLine>>(
    () => ({ floatingFilter: true, resizable: true, width: 140 }),
    []
  );

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      <AppHeader title="COMS" />

      <main className="flex-1 min-h-0 flex flex-col gap-3 px-8 py-6">
        <div className="flex items-baseline justify-between">
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
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex-1 min-h-0">
          <AgGridReact<PoLine>
            ref={gridRef}
            theme={theme}
            rowData={rows}
            loading={rows === null}
            columnDefs={COLUMNS}
            defaultColDef={defaultColDef}
            onModelUpdated={({ api }) => {
              setShown(api.getDisplayedRowCount());
              setFiltered(api.isAnyFilterPresent());
            }}
          />
        </div>
      </main>
    </div>
  );
}
