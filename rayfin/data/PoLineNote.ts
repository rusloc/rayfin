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
 * One note per (user, PO line) on the read-only `_PO_VIEW_` rows of the
 * Coms report semantic model (ADR-0005). `id` is derived client-side as
 * uuidv5(user_id + ':' + lineId) so a user's note for a line is a stable
 * single row; `lineId` mirrors `_line_id`, `poNo` / `lineNo` are kept for
 * display and later joins.
 *
 * Shared visibility: every signed-in user reads every note; writes are
 * restricted to the note's owner.
 */
@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
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
