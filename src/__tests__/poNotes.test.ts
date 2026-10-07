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
  saveMyNote,
  type PoLineRef,
} from '@/services/poNotes';

const ALICE = { id: 'user-alice', email: 'alice@iss-gf.com' };
const BOB = { id: 'user-bob', email: 'bob@iss-gf.com' };
const LINE: PoLineRef = { lineId: 'a'.repeat(64), poNo: '4500001234', lineNo: '10' };
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

/** Query builder mock whose `executePaginated` serves the given pages in order. */
function pages(...results: { items: unknown[]; hasNextPage: boolean; endCursor?: string }[]) {
  const executePaginated = vi.fn();
  for (const page of results) executePaginated.mockResolvedValueOnce(page);
  const builder = { first: vi.fn(), after: vi.fn(), executePaginated };
  builder.first.mockReturnValue(builder);
  builder.after.mockReturnValue(builder);
  entity.select.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  entity.update.mockImplementation(async (_w: unknown, data: object) => ({ ...stored(), ...data }));
  entity.create.mockImplementation(async (data: object) => ({ ...stored(), ...data }));
  entity.delete.mockResolvedValue(stored());
  signedIn(ALICE);
});

describe('poNoteId', () => {
  it('is a deterministic RFC 4122 v5 uuid of user + line', async () => {
    const a = await poNoteId(ALICE.id, LINE.lineId);
    expect(a).toMatch(UUID_V5);
    expect(await poNoteId(ALICE.id, LINE.lineId)).toBe(a);
  });

  it('differs per user and per line', async () => {
    const a = await poNoteId(ALICE.id, LINE.lineId);
    expect(await poNoteId(BOB.id, LINE.lineId)).not.toBe(a);
    expect(await poNoteId(ALICE.id, 'b'.repeat(64))).not.toBe(a);
    // The ':' separator keeps (user, line) pairs from colliding on concatenation.
    expect(await poNoteId('ab', 'c')).not.toBe(await poNoteId('a', 'bc'));
  });

  it('is pinned: changing the namespace or input format would orphan stored notes', async () => {
    expect(await poNoteId('user-alice', 'line-1')).toBe(
      await poNoteId('user-alice', 'line-1')
    );
    // Golden value (= uuid.v5('user-alice:line-1', PO_NOTE_NAMESPACE)); a change here orphans stored notes.
    await expect(poNoteId('user-alice', 'line-1')).resolves.toBe(
      '497d478a-f0c5-5646-ab1c-f393f0ecf086'
    );
  });
});

describe('listPoNotes', () => {
  it('selects only the note fields and walks every page to completion', async () => {
    const builder = pages(
      { items: [stored({ id: 'n1' }), stored({ id: 'n2', user_id: BOB.id })], hasNextPage: true, endCursor: 'c1' },
      { items: [stored({ id: 'n3' })], hasNextPage: true, endCursor: 'c2' },
      { items: [stored({ id: 'n4', comment: ' hi ' })], hasNextPage: false }
    );

    const notes = await listPoNotes();

    expect(notes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(entity.select).toHaveBeenCalledWith([
      'id', 'lineId', 'poNo', 'lineNo', 'flagged', 'comment',
      'authorEmail', 'user_id', 'createdAt', 'updatedAt',
    ]);
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
});

describe('saveMyNote', () => {
  it('throws a readable error when not signed in, without touching the API', async () => {
    signedIn(null);
    await expect(saveMyNote(LINE, { flagged: true })).rejects.toThrow('Sign in to save a note.');
    expect(entity.findById).not.toHaveBeenCalled();
    expect(entity.create).not.toHaveBeenCalled();
  });

  it('creates a note with id, keys, session identity and both timestamps', async () => {
    entity.findById.mockResolvedValue(null);
    const before = Date.now();

    const note = await saveMyNote(LINE, { flagged: true, comment: '  late delivery  ' });

    const expectedId = await poNoteId(ALICE.id, LINE.lineId);
    expect(entity.findById).toHaveBeenCalledWith(expectedId);
    expect(entity.create).toHaveBeenCalledTimes(1);
    expect(entity.update).not.toHaveBeenCalled();
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
    entity.findById.mockResolvedValue(null);
    await saveMyNote({ ...LINE, lineNo: null }, { flagged: true, comment: '   ' });
    const payload = entity.create.mock.calls[0][0];
    expect(payload.lineNo).toBeUndefined();
    expect(payload.comment).toBeUndefined();
    expect(payload.flagged).toBe(true);
  });

  it('does not create anything when the patch leaves nothing to store', async () => {
    entity.findById.mockResolvedValue(null);
    await expect(saveMyNote(LINE, { flagged: false, comment: '' })).resolves.toBeNull();
    await expect(saveMyNote(LINE, {})).resolves.toBeNull();
    expect(entity.create).not.toHaveBeenCalled();
    expect(entity.update).not.toHaveBeenCalled();
    expect(entity.delete).not.toHaveBeenCalled();
  });

  it('updates an existing note: merges the patch, refreshes updatedAt only, keeps user_id/createdAt', async () => {
    entity.findById.mockResolvedValue(stored({ flagged: true, comment: 'old' }));

    const note = await saveMyNote(LINE, { comment: ' new text ' });

    const expectedId = await poNoteId(ALICE.id, LINE.lineId);
    expect(entity.create).not.toHaveBeenCalled();
    expect(entity.update).toHaveBeenCalledTimes(1);
    const [where, data] = entity.update.mock.calls[0];
    expect(where).toEqual({ id: expectedId });
    expect(data).toEqual({
      flagged: true,
      comment: 'new text',
      authorEmail: ALICE.email,
      updatedAt: expect.any(Date),
    });
    expect(data).not.toHaveProperty('createdAt');
    expect(data).not.toHaveProperty('user_id');
    expect(note).toMatchObject({ flagged: true, comment: 'new text', userId: ALICE.id });
  });

  it('clears a stored comment with an explicit null while the flag stays on', async () => {
    entity.findById.mockResolvedValue(stored({ flagged: true, comment: 'old' }));
    await saveMyNote(LINE, { comment: null });
    expect(entity.update.mock.calls[0][1]).toMatchObject({ flagged: true, comment: null });
    expect(entity.delete).not.toHaveBeenCalled();
  });

  it('keeps the stored comment when only the flag changes', async () => {
    entity.findById.mockResolvedValue(stored({ flagged: false, comment: 'keep me' }));
    await saveMyNote(LINE, { flagged: true });
    expect(entity.update.mock.calls[0][1]).toMatchObject({ flagged: true, comment: 'keep me' });
  });

  it('deletes the own note when the flag goes off and no comment remains', async () => {
    entity.findById.mockResolvedValue(stored({ flagged: true, comment: null }));
    await expect(saveMyNote(LINE, { flagged: false })).resolves.toBeNull();
    expect(entity.delete).toHaveBeenCalledWith({ id: await poNoteId(ALICE.id, LINE.lineId) });
    expect(entity.update).not.toHaveBeenCalled();

    entity.delete.mockClear();
    entity.findById.mockResolvedValue(stored({ flagged: false, comment: 'x' }));
    await expect(saveMyNote(LINE, { comment: '  ' })).resolves.toBeNull();
    expect(entity.delete).toHaveBeenCalledTimes(1);
  });

  it('looks up and writes under the signed-in user, not the note author of another user', async () => {
    signedIn(BOB);
    entity.findById.mockResolvedValue(null);
    await saveMyNote(LINE, { flagged: true });
    const payload = entity.create.mock.calls[0][0];
    expect(payload.id).toBe(await poNoteId(BOB.id, LINE.lineId));
    expect(payload.id).not.toBe(await poNoteId(ALICE.id, LINE.lineId));
    expect(payload.user_id).toBe(BOB.id);
    expect(payload.authorEmail).toBe(BOB.email);
  });
});

describe('currentUserId', () => {
  it('returns the session user id, or null when signed out', () => {
    expect(currentUserId()).toBe(ALICE.id);
    signedIn(null);
    expect(currentUserId()).toBeNull();
  });
});
