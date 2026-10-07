/** Search criteria of the PO view, kept apart from the panel component for fast refresh. */
export interface PoSearch {
  supplier: string;
  masterLine: string;
  poNo: string;
  /** 'YYYY-MM-DD' or '' */
  needByFrom: string;
  needByTo: string;
}

export const EMPTY_SEARCH: PoSearch = { supplier: '', masterLine: '', poNo: '', needByFrom: '', needByTo: '' };

/** Number of active criteria; the date range counts once. */
export function activeCount(s: PoSearch): number {
  return [s.supplier, s.masterLine, s.poNo, s.needByFrom || s.needByTo].filter((v) => v.trim()).length;
}
