/** Search criteria of the PO view, kept apart from the panel component for fast refresh. */
export interface PoSearch {
  supplier: string;
  masterLine: string;
  poNo: string;
  /** 'YYYY-MM-DD' or '' */
  needByFrom: string;
  needByTo: string;
  /** Any note on the line flagged ('yes'), none flagged ('no'), or no constraint. */
  flag: 'any' | 'yes' | 'no';
  /** Contains-match over every user's comment on the line. */
  comment: string;
}

/** Criteria backed by a grid column (the rest are matched against notes). */
export type ColumnSearchKey = 'supplier' | 'masterLine' | 'poNo' | 'needByFrom' | 'needByTo';

export const EMPTY_SEARCH: PoSearch = {
  supplier: '',
  masterLine: '',
  poNo: '',
  needByFrom: '',
  needByTo: '',
  flag: 'any',
  comment: '',
};

/** Number of active criteria; the date range counts once. */
export function activeCount(s: PoSearch): number {
  const text = [s.supplier, s.masterLine, s.poNo, s.needByFrom || s.needByTo, s.comment];
  return text.filter((v) => v.trim()).length + (s.flag === 'any' ? 0 : 1);
}
