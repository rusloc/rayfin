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

/** Upper bound on rows per line: one shared row plus the legacy per-user rows. */
const LINE_ROWS = 100;

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

/**
 * Every line's shared note, loaded to completion page by page and joined on
 * `lineId` in the browser. At most ONE note per line: the shared row (id =
 * {@link poNoteId}) when present, otherwise the most recently updated legacy
 * per-user row (ids were uuidv5(user_id + ':' + lineId) before 2026-10-07).
 */
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

  const byLine = new Map<string, PoNote[]>();
  for (const note of notes) byLine.set(note.lineId, [...(byLine.get(note.lineId) ?? []), note]);
  return Promise.all(
    [...byLine].map(async ([lineId, group]) => {
      const sharedId = await poNoteId(lineId);
      return group.find((n) => n.id === sharedId) ?? latest(group);
    })
  );
}

/**
 * Create, update or clear THE shared note of a PO line.
 *
 * `patch` merges onto the note currently shown for the line (the shared row,
 * else the latest legacy row): an omitted key keeps the stored value,
 * `comment: null` clears it. When the result has `flagged === false` and no
 * comment, the line's note is deleted and `null` is returned. Otherwise the
 * shared row is created (`createdAt` set once) or updated, stamped with the
 * signed-in user as last editor (`authorEmail`, `user_id`, `updatedAt`), and
 * returned. Legacy per-user rows of the line are deleted after the write.
 */
export async function saveLineNote(
  line: PoLineRef,
  patch: { flagged?: boolean; comment?: string | null }
): Promise<PoNote | null> {
  const client = getRayfinClient();
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('Sign in to save a note.');
  }
  const { id: userId, email } = session.user;
  const id = await poNoteId(line.lineId);
  const rows = (
    await client.data.PoLineNote.select([...NOTE_FIELDS])
      .where({ lineId: { eq: line.lineId } })
      .first(LINE_ROWS)
      .execute()
  ).map(toPoNote);
  const shared = rows.find((r) => r.id === id) ?? null;
  const legacy = rows.filter((r) => r.id !== id);
  const current = shared ?? (legacy.length ? latest(legacy) : null);

  const flagged = patch.flagged ?? current?.flagged ?? false;
  const comment = normalizeComment(
    patch.comment !== undefined ? patch.comment : current?.comment
  );

  const now = new Date();
  let saved: PoNote | null = null;
  if (!flagged && comment === null) {
    if (shared) await client.data.PoLineNote.delete({ id });
  } else if (shared) {
    // `UpdateInput` types optional text as `string | undefined`, but only an
    // explicit `null` clears a stored comment (`undefined` is dropped from the
    // mutation; the runtime sends `null` as GraphQL null).
    const data = { flagged, comment, authorEmail: email, user_id: userId, updatedAt: now };
    saved = toPoNote(
      await client.data.PoLineNote.update(
        { id },
        data as Parameters<typeof client.data.PoLineNote.update>[1]
      )
    );
  } else {
    saved = toPoNote(
      await client.data.PoLineNote.create({
        id,
        lineId: line.lineId,
        poNo: line.poNo,
        lineNo: line.lineNo ?? undefined,
        flagged,
        comment: comment ?? undefined,
        authorEmail: email,
        user_id: userId,
        createdAt: current ? new Date(current.createdAt) : now,
        updatedAt: now,
      })
    );
  }

  // The shared row is written first so the line is never left without its note.
  for (const row of legacy) await client.data.PoLineNote.delete({ id: row.id });
  return saved;
}

/** The signed-in user's id (what `PoNote.userId` is compared against), or `null` when signed out. */
export function currentUserId(): string | null {
  const session = getRayfinClient().auth.getSession();
  return session.isAuthenticated && session.user ? session.user.id : null;
}

/** Deterministic shared-note id: uuidv5 (SHA-1) of `lineId` under {@link PO_NOTE_NAMESPACE}. */
export async function poNoteId(lineId: string): Promise<string> {
  const name = new TextEncoder().encode(lineId);
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

/** The most recently updated note of a non-empty group. */
function latest(group: PoNote[]): PoNote {
  return group.reduce((a, b) => (Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a));
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
