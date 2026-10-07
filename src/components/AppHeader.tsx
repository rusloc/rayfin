import { NavLink } from 'react-router-dom';

import { useAuth } from '@/hooks/AuthContext';

const NAV = [
  { to: '/', label: 'Names' },
  { to: '/po', label: 'PO view' },
];

export function AppHeader({ title }: { title: string }) {
  const { signOut, user } = useAuth();

  return (
    <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-200">
      <div className="flex items-center gap-8">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <nav className="flex gap-1 text-sm">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-500 hover:text-gray-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
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
  );
}
