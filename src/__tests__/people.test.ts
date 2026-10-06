import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => true,
  getRayfinClient: vi.fn(),
}));

import {
  createPerson,
  deletePerson,
  listPeople,
  renamePerson,
} from '@/services/people';

describe('people service (in-memory mode)', () => {
  beforeEach(async () => {
    // Drain any in-memory state left over from a previous test.
    for (const person of await listPeople()) {
      await deletePerson(person.id);
    }
  });

  it('creates a person with a trimmed name', async () => {
    const created = await createPerson('  Ada Lovelace  ');
    expect(created.name).toBe('Ada Lovelace');
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a blank name', async () => {
    await expect(createPerson('   ')).rejects.toThrow();
    expect(await listPeople()).toEqual([]);
  });

  it('lists people sorted by name ascending', async () => {
    await createPerson('Charlie');
    await createPerson('alice');
    await createPerson('Bob');

    const names = (await listPeople()).map((p) => p.name);
    expect(names).toEqual(['alice', 'Bob', 'Charlie']);
  });

  it('searches by case-insensitive substring', async () => {
    await createPerson('Grace Hopper');
    await createPerson('Alan Turing');
    await createPerson('Margaret Hamilton');

    const hits = (await listPeople('hop')).map((p) => p.name);
    expect(hits).toEqual(['Grace Hopper']);
    expect(await listPeople('zzz')).toEqual([]);
    expect(await listPeople('  ')).toHaveLength(3);
  });

  it('renames a person', async () => {
    const created = await createPerson('Linus');
    const renamed = await renamePerson(created.id, ' Linus Torvalds ');
    expect(renamed.id).toBe(created.id);
    expect(renamed.name).toBe('Linus Torvalds');
    expect((await listPeople())[0]?.name).toBe('Linus Torvalds');
    await expect(renamePerson('missing', 'x')).rejects.toThrow();
  });

  it('deletes a person', async () => {
    const created = await createPerson('Temp');
    await deletePerson(created.id);
    expect(await listPeople()).toEqual([]);
  });
});
