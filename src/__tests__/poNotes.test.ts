import { beforeEach, describe, expect, it, vi } from 'vitest';

const { entity, getSession } = vi.hoisted(() => ({
  entity: {
    select: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  getSession: vi.fn(),
}));

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => false,
  getRayfinClient: () => ({
    auth: { getSession },
    data: { PoLineNote: entity },
  }),
}));

import {
  currentUserId,
  listPoNotes,
  poNoteId,
  saveLineNote,
  type PoLineRef,
} from '@/services/poNotes';

const ALICE = { id: 'user-alice', email: 'alice@iss-gf.com' };
const BOB = { id: 'user-bob', email: 'bob@iss-gf.com' };
const LINE: PoLineRef = { lineId: 'a'.repeat(64), poNo: '4500001234', lineNo: '10' };
const LINE_B: PoLineRef = { lineId: 'b'.repeat(64), poNo: '4500009999', lineNo: '20' };
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function signedIn(user: { id: string; email: string } | null) {
  getSession.mockReturnValue(
    user ? { isAuthenticated: true, user } : { isAuthenticated: false, user: null }
  );
}

/** A stored row as the API returns it (optional text as null, dates as ISO strings). */
function stored(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    lineId: LINE.lineId,
    poNo: LINE.poNo,
    lineNo: LINE.lineNo,
    flagged: true,
    comment: null,
    authorEmail: ALICE.email,
    user_id: ALICE.id,
    createdAt: '2026-10-07T08:00:00.000Z',
    updatedAt: '2026-10-07T08:00:00.000Z',
    ...overrides,
  };
}

/** The shared row of a line, with its canonical id. */
async function shared(line: PoLineRef, overrides: Record<string, unknown> = {}) {
  return stored({ id: await poNoteId(line.lineId), lineId: line.lineId, poNo: line.poNo, lineNo: line.lineNo, ...overrides });
}

/** Query builder mock: `executePaginated` serves the pages in order, `execute` serves `rows`. */
function builderMock(
  results: { items: unknown[]; hasNextPage: boolean; endCursor?: string }[],
  rows: unknown[] = []
) {
  const executePaginated = vi.fn();
  for (const page of results) executePaginated.mockResolvedValueOnce(page);
  const builder = {
    where: vi.fn(),
    first: vi.fn(),
    after: vi.fn(),
    execute: vi.fn(async () => rows),
    executePaginated,
  };
  builder.where.mockReturnValue(builder);
  builder.first.mockReturnValue(builder);
  builder.after.mockReturnValue(builder);
  entity.select.mockReturnValue(builder);
  return builder;
}

const pages = (...results: { items: unknown[]; hasNextPage: boolean; endCursor?: string }[]) =>
  builderMock(results);

/** Rows the line query (`where lineId eq`) returns for `saveLineNote`. */
const lineRows = (...rows: unknown[]) => builderMock([], rows);

beforeEach(() => {
  vi.clearAllMocks();
  entity.update.mockImplementation(async (w: { id: string }, data: object) => ({ ...stored(), id: w.id, ...data }));
  entity.create.mockImplementation(async (data: object) => ({ ...stored(), ...data }));
  entity.delete.mockResolvedValue(stored());
  signedIn(ALICE);
});

describe('poNoteId', () => {
  it('is a deterministic RFC 4122 v5 uuid of the line id', async () => {
    const a = await poNoteId(LINE.lineId);
    expect(a).toMatch(UUID_V5);
    expect(await poNoteId(LINE.lineId)).toBe(a);
    expect(await poNoteId(LINE_B.lineId)).not.toBe(a);
  });

  it('is pinned: changing the namespace or input format would orphan stored notes', async () => {
    // Golden value (= uuid.v5('line-1', PO_NOTE_NAMESPACE)); a change here orphans stored notes.
    await expect(poNoteId('line-1')).resolves.toBe('0c17bb0b-40e9-509b-9975-f56163f56c3a');
    // Legacy per-user ids were uuid.v5('<user_id>:<lineId>') under the same namespace and never collide.
    await expect(poNoteId('user-alice:line-1')).resolves.toBe('497d478a-f0c5-5646-ab1c-f393f0ecf086');
  });
});

describe('listPoNotes', () => {
  it('selects only the note fields and walks every page to completion', async () => {
    const builder = pages(
      {
        items: [stored({ id: 'n1' }), stored({ id: 'n2', lineId: LINE_B.lineId, user_id: BOB.id })],
        hasNextPage: true,
        endCursor: 'c1',
      },
      { items: [stored({ id: 'n3', lineId: 'c'.repeat(64) })], hasNextPage: true, endCursor: 'c2' },
      { items: [stored({ id: 'n4', lineId: 'd'.repeat(64), comment: ' hi ' })], hasNextPage: false }
    );

    const notes = await listPoNotes();

    expect(notes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(entity.select).toHaveBeenCalledWith([
      'id', 'lineId', 'poNo', 'lineNo', 'flagged', 'comment',
      'authorEmail', 'user_id', 'createdAt', 'updatedAt',
    ]);
    expect(builder.where).not.toHaveBeenCalled();
    expect(builder.executePaginated).toHaveBeenCalledTimes(3);
    expect(builder.after).toHaveBeenCalledTimes(2);
    expect(builder.after).toHaveBeenNthCalledWith(1, 'c1');
    expect(builder.after).toHaveBeenNthCalledWith(2, 'c2');
    // Every user's notes come back, not just the caller's.
    expect(notes[1].userId).toBe(BOB.id);
  });

  it('stops when a page claims a next page but gives no cursor', async () => {
    const builder = pages({ items: [stored()], hasNextPage: true });
    await expect(listPoNotes()).resolves.toHaveLength(1);
    expect(builder.executePaginated).toHaveBeenCalledTimes(1);
  });

  it('maps rows to the PoNote contract (nulls, userId, ISO dates)', async () => {
    pages({
      items: [
        stored({ lineNo: null, comment: null, createdAt: new Date('2026-10-07T09:00:00Z') }),
      ],
      hasNextPage: false,
    });
    const [note] = await listPoNotes();
    expect(note).toEqual({
      id: 'note-1',
      lineId: LINE.lineId,
      poNo: LINE.poNo,
      lineNo: null,
      flagged: true,
      comment: null,
      authorEmail: ALICE.email,
      userId: ALICE.id,
      createdAt: '2026-10-07T09:00:00.000Z',
      updatedAt: '2026-10-07T08:00:00.000Z',
    });
  });

  it('returns an empty list when there are no notes', async () => {
    pages({ items: [], hasNextPage: false });
    await expect(listPoNotes()).resolves.toEqual([]);
  });

  it('collapses legacy per-user rows of a line to the most recently updated one', async () => {
    pages({
      items: [
        stored({ id: 'alice-old', comment: 'old', updatedAt: '2026-10-07T08:00:00.000Z' }),
        stored({ id: 'bob-new', user_id: BOB.id, authorEmail: BOB.email, comment: 'newer', updatedAt: '2026-10-07T10:00:00.000Z' }),
        stored({ id: 'carol-mid', user_id: 'user-carol', comment: 'mid', updatedAt: '2026-10-07T09:00:00.000Z' }),
        stored({ id: 'other-line', lineId: LINE_B.lineId }),
      ],
      hasNextPage: false,
    });

    const notes = await listPoNotes();

    expect(notes).toHaveLength(2);
    expect(notes.find((n) => n.lineId === LINE.lineId)).toMatchObject({ id: 'bob-new', comment: 'newer', userId: BOB.id });
    expect(notes.find((n) => n.lineId === LINE_B.lineId)?.id).toBe('other-line');
  });

  it('prefers the shared row of a line over newer legacy rows', async () => {
    pages({
      items: [
        stored({ id: 'legacy-newest', comment: 'legacy', updatedAt: '2026-10-07T12:00:00.000Z' }),
        await shared(LINE, { comment: 'shared', updatedAt: '2026-10-07T08:00:00.000Z' }),
      ],
      hasNextPage: false,
    });

    const notes = await listPoNotes();

    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id: await poNoteId(LINE.lineId), comment: 'shared' });
  });
});

describe('saveLineNote', () => {
  it('throws a readable error when not signed in, without touching the API', async () => {
    signedIn(null);
    await expect(saveLineNote(LINE, { flagged: true })).rejects.toThrow('Sign in to save a note.');
    expect(entity.select).not.toHaveBeenCalled();
    expect(entity.create).not.toHaveBeenCalled();
  });

  it('creates the shared note with its line id, keys, session identity and both timestamps', async () => {
    const builder = lineRows();
    const before = Date.now();

    const note = await saveLineNote(LINE, { flagged: true, comment: '  late delivery  ' });

    const expectedId = await poNoteId(LINE.lineId);
    expect(builder.where).toHaveBeenCalledWith({ lineId: { eq: LINE.lineId } });
    expect(entity.findById).not.toHaveBeenCalled();
    expect(entity.create).toHaveBeenCalledTimes(1);
    expect(entity.update).not.toHaveBeenCalled();
    expect(entity.delete).not.toHaveBeenCalled();
    const payload = entity.create.mock.calls[0][0];
    expect(payload).toEqual({
      id: expectedId,
      lineId: LINE.lineId,
      poNo: LINE.poNo,
      lineNo: '10',
      flagged: true,
      comment: 'late delivery',
      authorEmail: ALICE.email,
      user_id: ALICE.id,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(payload.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(payload.updatedAt).toEqual(payload.createdAt);
    expect(note).toMatchObject({
      id: expectedId,
      comment: 'late delivery',
      flagged: true,
      userId: ALICE.id,
      authorEmail: ALICE.email,
    });
    expect(note?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('omits a null line number and an empty comment from the create payload', async () => {
    lineRows();
    await saveLineNote({ ...LINE, lineNo: null }, { flagged: true, comment: '   ' });
    const payload = entity.create.mock.calls[0][0];
    expect(payload.lineNo).toBeUndefined();
    expect(payload.comment).toBeUndefined();
    expect(payload.flagged).toBe(true);
  });

  it('does not create anything when the patch leaves nothing to store', async () => {
    lineRows();
    await expect(saveLineNote(LINE, { flagged: false, comment: '' })).resolves.toBeNull();
    await expect(saveLineNote(LINE, {})).resolves.toBeNull();
    expect(entity.create).not.toHaveBeenCalled();
    expect(entity.update).not.toHaveBeenCalled();
    expect(entity.delete).not.toHaveBeenCalled();
  });

  it("rewrites another user's shared note in place and stamps the signed-in user as last editor", async () => {
    signedIn(BOB);
    lineRows(await shared(LINE, { flagged: true, comment: 'old' }));

    const note = await saveLineNote(LINE, { comment: ' new text ' });

    const expectedId = await poNoteId(LINE.lineId);
    expect(entity.create).not.toHaveBeenCalled();
    expect(entity.delete).not.toHaveBeenCalled();
    expect(entity.update).toHaveBeenCalledTimes(1);
    const [where, data] = entity.update.mock.calls[0];
    expect(where).toEqual({ id: expectedId });
    expect(data).toEqual({
      flagged: true,
      comment: 'new text',
      authorEmail: BOB.email,
      user_id: BOB.id,
      updatedAt: expect.any(Date),
    });
    expect(data).not.toHaveProperty('createdAt');
    expect(note).toMatchObject({ id: expectedId, flagged: true, comment: 'new text', userId: BOB.id, authorEmail: BOB.email });
  });

  it('clears a stored comment with an explicit null while the flag stays on', async () => {
    lineRows(await shared(LINE, { flagged: true, comment: 'old' }));
    await saveLineNote(LINE, { comment: null });
    expect(entity.update.mock.calls[0][1]).toMatchObject({ flagged: true, comment: null });
    expect(entity.delete).not.toHaveBeenCalled();
  });

  it('keeps the stored comment when only the flag changes', async () => {
    lineRows(await shared(LINE, { flagged: false, comment: 'keep me' }));
    await saveLineNote(LINE, { flagged: true });
    expect(entity.update.mock.calls[0][1]).toMatchObject({ flagged: true, comment: 'keep me' });
  });

  it('deletes the shared note when the flag goes off and no comment remains', async () => {
    lineRows(await shared(LINE, { flagged: true, comment: null }));
    await expect(saveLineNote(LINE, { flagged: false })).resolves.toBeNull();
    expect(entity.delete).toHaveBeenCalledWith({ id: await poNoteId(LINE.lineId) });
    expect(entity.update).not.toHaveBeenCalled();

    entity.delete.mockClear();
    lineRows(await shared(LINE, { flagged: false, comment: 'x' }));
    await expect(saveLineNote(LINE, { comment: '  ' })).resolves.toBeNull();
    expect(entity.delete).toHaveBeenCalledTimes(1);
  });

  it('converges legacy per-user rows: patch merges onto the latest one, shared row written first, legacy rows deleted', async () => {
    signedIn(BOB);
    lineRows(
      stored({ id: 'alice-old', flagged: true, comment: 'alice says', createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-07T08:00:00.000Z' }),
      stored({ id: 'carol-new', user_id: 'user-carol', authorEmail: 'carol@iss-gf.com', flagged: false, comment: 'carol says', createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-10-07T11:00:00.000Z' })
    );

    const note = await saveLineNote(LINE, { flagged: true });

    expect(entity.update).not.toHaveBeenCalled();
    expect(entity.create).toHaveBeenCalledTimes(1);
    const payload = entity.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: await poNoteId(LINE.lineId),
      flagged: true,
      comment: 'carol says',
      authorEmail: BOB.email,
      user_id: BOB.id,
      createdAt: new Date('2026-10-02T08:00:00.000Z'),
    });
    expect(entity.delete.mock.calls.map(([w]) => w)).toEqual([{ id: 'alice-old' }, { id: 'carol-new' }]);
    expect(entity.create.mock.invocationCallOrder[0]).toBeLessThan(entity.delete.mock.invocationCallOrder[0]);
    expect(note).toMatchObject({ comment: 'carol says', flagged: true, userId: BOB.id });
  });

  it('clearing a line that only has legacy rows deletes them all and returns null', async () => {
    lineRows(
      stored({ id: 'alice-old', flagged: true, comment: null }),
      stored({ id: 'bob-old', user_id: BOB.id, flagged: true, comment: null, updatedAt: '2026-10-07T09:00:00.000Z' })
    );
    await expect(saveLineNote(LINE, { flagged: false })).resolves.toBeNull();
    expect(entity.create).not.toHaveBeenCalled();
    expect(entity.update).not.toHaveBeenCalled();
    expect(entity.delete.mock.calls.map(([w]) => w)).toEqual([{ id: 'alice-old' }, { id: 'bob-old' }]);
  });
});

describe('currentUserId', () => {
  it('returns the session user id, or null when signed out', () => {
    expect(currentUserId()).toBe(ALICE.id);
    signedIn(null);
    expect(currentUserId()).toBeNull();
  });
});
