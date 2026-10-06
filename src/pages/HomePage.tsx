import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import {
  createPerson,
  deletePerson,
  listPeople,
  renamePerson,
  type PersonItem,
} from '@/services/people';

export function HomePage() {
  const { signOut, user } = useAuth();
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (term: string) => {
    try {
      setPeople(await listPeople(term.trim() || undefined));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load names.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(search);
  }, [refresh, search]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    void run(() => createPerson(name));
  };

  const handleDelete = (person: PersonItem) => {
    if (!window.confirm(`Delete "${person.name}"?`)) return;
    void run(() => deletePerson(person.id));
  };

  const handleRename = (id: string, name: string) =>
    run(() => renamePerson(id, name));

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Names Register</h1>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-gray-600" title={user.email}>
              {user.email}
            </span>
          )}
          <button
            onClick={() => void signOut()}
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <form onSubmit={handleSave} className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter a name"
            maxLength={200}
            aria-label="New name"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-40"
          >
            Save
          </button>
        </form>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          aria-label="Search by name"
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-gray-400 text-sm">Loading...</p>
        ) : people.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">
            {search.trim() ? 'No names match your search.' : 'No names yet. Add one above.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {people.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              {people.length} {people.length === 1 ? 'name' : 'names'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function PersonRow({
  person,
  onRename,
  onDelete,
}: {
  person: PersonItem;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (person: PersonItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.name);

  const commit = async () => {
    const name = draft.trim();
    if (name && name !== person.name) await onRename(person.id, name);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(person.name);
    setEditing(false);
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-900">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commit();
              if (e.key === 'Escape') cancel();
            }}
            aria-label={`Rename ${person.name}`}
            className="w-full rounded-lg border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          person.name
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
        {new Date(person.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {editing ? (
          <>
            <button
              onClick={() => void commit()}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
            >
              Save
            </button>
            <button
              onClick={cancel}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
              aria-label={`Rename ${person.name}`}
            >
              Rename
            </button>
            <button
              onClick={() => onDelete(person)}
              className="text-gray-400 hover:text-red-600 text-xs"
              aria-label={`Delete ${person.name}`}
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
