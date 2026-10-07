import { getRayfinClient } from './rayfinClient';

/** A PO line note as shown in the grid; dates are ISO strings as delivered by the API. */
export interface PoNote {
  id: string;
  lineId: string;
  poNo: string;
  lineNo: string | null;
  flagged: boolean;
  comment: string | null;
  authorEmail: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** The `_PO_VIEW_` key columns a note attaches to (see `PO_KEY_COLUMNS` in poView.ts). */
export interface PoLineRef {
  lineId: string;
  poNo: string;
  lineNo: string | null;
}

const PAGE_SIZE = 500;

const NOTE_FIELDS = [
  'id',
  'lineId',
  'poNo',
  'lineNo',
  'flagged',
  'comment',
  'authorEmail',
  'user_id',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Namespace for the uuidv5 note ids. NEVER change it: every stored note id is
 * derived from it, and a different namespace would orphan all existing rows.
 */
const PO_NOTE_NAMESPACE = '6f1c2a9e-4b7d-4e0a-9c3f-2d8b5a7e1f40';

/** Every user's notes, loaded to completion page by page (joined on `lineId` in the browser). */
export async function listPoNotes(): Promise<PoNote[]> {
  const client = getRayfinClient();
  const notes: PoNote[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = client.data.PoLineNote.select([...NOTE_FIELDS]).first(PAGE_SIZE);
    if (cursor) query = query.after(cursor);
    const page = await query.executePaginated();
    notes.push(...page.items.map(toPoNote));
    if (!page.hasNextPage || !page.endCursor) break;
    cursor = page.endCursor;
  }
  return notes;
}

/**
 * Create, update or delete the signed-in user's note for a PO line.
 *
 * `patch` merges onto the user's existing note (fetched by its deterministic
 * id): an omitted key keeps the stored value, `comment: null` clears it.
 * When the result has `flagged === false` and no comment, the note is deleted
 * (if it exists) and `null` is returned. Otherwise the note is created
 * (`createdAt` set once) or updated (`updatedAt` refreshed every time) and
 * the saved note is returned.
 */
export async function saveMyNote(
  line: PoLineRef,
  patch: { flagged?: boolean; comment?: string | null }
): Promise<PoNote | null> {
  const client = getRayfinClient();
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('Sign in to save a note.');
  }
  const { id: userId, email } = session.user;
  const id = await poNoteId(userId, line.lineId);
  const existing = await client.data.PoLineNote.findById(id);

  const flagged = patch.flagged ?? existing?.flagged ?? false;
  const comment = normalizeComment(
    patch.comment !== undefined ? patch.comment : existing?.comment
  );

  if (!flagged && comment === null) {
    if (existing) await client.data.PoLineNote.delete({ id });
    return null;
  }

  const now = new Date();
  if (existing) {
    // `UpdateInput` types optional text as `string | undefined`, but only an
    // explicit `null` clears a stored comment (`undefined` is dropped from the
    // mutation; the runtime sends `null` as GraphQL null).
    const data = { flagged, comment, authorEmail: email, updatedAt: now };
    const saved = await client.data.PoLineNote.update(
      { id },
      data as Parameters<typeof client.data.PoLineNote.update>[1]
    );
    return toPoNote(saved);
  }

  const saved = await client.data.PoLineNote.create({
    id,
    lineId: line.lineId,
    poNo: line.poNo,
    lineNo: line.lineNo ?? undefined,
    flagged,
    comment: comment ?? undefined,
    authorEmail: email,
    user_id: userId,
    createdAt: now,
    updatedAt: now,
  });
  return toPoNote(saved);
}

/** The signed-in user's id (what `PoNote.userId` is compared against), or `null` when signed out. */
export function currentUserId(): string | null {
  const session = getRayfinClient().auth.getSession();
  return session.isAuthenticated && session.user ? session.user.id : null;
}

/** Deterministic note id: uuidv5 (SHA-1) of `user_id + ':' + lineId` under {@link PO_NOTE_NAMESPACE}. */
export async function poNoteId(userId: string, lineId: string): Promise<string> {
  const name = new TextEncoder().encode(`${userId}:${lineId}`);
  const input = new Uint8Array(16 + name.length);
  input.set(uuidToBytes(PO_NOTE_NAMESPACE));
  input.set(name, 16);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', input));
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(hash.subarray(0, 16), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  return Uint8Array.from({ length: 16 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  );
}

function normalizeComment(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

type PoLineNoteRecord = {
  id: string;
  lineId: string;
  poNo: string;
  lineNo?: string | null;
  flagged: boolean;
  comment?: string | null;
  authorEmail: string;
  user_id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toPoNote(record: PoLineNoteRecord): PoNote {
  return {
    id: record.id,
    lineId: record.lineId,
    poNo: record.poNo,
    lineNo: record.lineNo ?? null,
    flagged: Boolean(record.flagged),
    comment: record.comment ?? null,
    authorEmail: record.authorEmail,
    userId: record.user_id,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
