import { getRayfinClient, isLocalBackend } from './rayfinClient';

export interface PersonItem {
  id: string;
  name: string;
  createdAt: Date;
}

const PAGE_SIZE = 200;

// Local-dev fallback: when no Fabric backend is configured, keep people in
// memory so the app (and Vitest) work without a database.
let inMemoryPeople: PersonItem[] = [];

const byName = (a: PersonItem, b: PersonItem) => a.name.localeCompare(b.name);

export async function listPeople(search?: string): Promise<PersonItem[]> {
  const term = search?.trim() ?? '';

  if (isLocalBackend()) {
    const lower = term.toLowerCase();
    return inMemoryPeople
      .filter((p) => !lower || p.name.toLowerCase().includes(lower))
      .sort(byName)
      .slice(0, PAGE_SIZE);
  }

  const client = getRayfinClient();
  let query = client.data.Person.select(['id', 'name', 'createdAt']);
  if (term) {
    query = query.where({ name: { contains: term } });
  }
  const results = await query
    .orderBy({ name: 'asc' })
    .first(PAGE_SIZE)
    .execute();
  return results as PersonItem[];
}

export async function createPerson(name: string): Promise<PersonItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name is required.');

  if (isLocalBackend()) {
    const person: PersonItem = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date(),
    };
    inMemoryPeople.push(person);
    return person;
  }

  const client = getRayfinClient();
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('Cannot create person: user is not authenticated.');
  }
  const person = await client.data.Person.create({
    name: trimmed,
    createdAt: new Date(),
    user_id: session.user.id,
  });
  return person as PersonItem;
}

export async function renamePerson(
  id: string,
  name: string
): Promise<PersonItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name is required.');

  if (isLocalBackend()) {
    const person = inMemoryPeople.find((p) => p.id === id);
    if (!person) throw new Error('Person not found');
    person.name = trimmed;
    return { ...person };
  }

  const client = getRayfinClient();
  const person = await client.data.Person.update({ id }, { name: trimmed });
  return person as PersonItem;
}

export async function deletePerson(id: string): Promise<void> {
  if (isLocalBackend()) {
    inMemoryPeople = inMemoryPeople.filter((p) => p.id !== id);
    return;
  }

  const client = getRayfinClient();
  await client.data.Person.delete({ id });
}
