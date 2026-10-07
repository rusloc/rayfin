import {
  authenticated,
  boolean,
  date,
  email,
  entity,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * ONE shared note per PO line on the read-only `_PO_VIEW_` rows of the Coms
 * report semantic model (ADR-0005, amended 2026-10-07). `id` is derived
 * client-side as uuidv5(lineId) so a line's note is a stable single row;
 * `lineId` mirrors `_line_id`, `poNo` / `lineNo` are kept for display and
 * later joins.
 *
 * Any signed-in user reads, creates, rewrites or clears the note. `user_id`,
 * `authorEmail` and `updatedAt` record the LAST editor (client-asserted);
 * `createdAt` is set once. Rows whose id is uuidv5(user_id + ':' + lineId)
 * are legacy per-user notes from before the amendment; the service collapses
 * them on read and deletes them on the next write to that line.
 */
@entity()
@authenticated(['create', 'read', 'update', 'delete'])
export class PoLineNote {
  @uuid() id!: string;
  @text({ min: 1, max: 64 }) lineId!: string;
  @text({ max: 50 }) poNo!: string;
  @text({ max: 50, optional: true }) lineNo?: string;
  @boolean() flagged!: boolean;
  @text({ max: 2000, optional: true }) comment?: string;
  @email({ max: 320 }) authorEmail!: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @text({ max: 128 }) user_id!: string;
}
