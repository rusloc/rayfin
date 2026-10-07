import { useState } from 'react';

import { applyTheme, readTheme, type Theme } from './theme';

const icon = 'h-4 w-4';

const OPTIONS: { theme: Theme; label: string; glyph: React.ReactNode }[] = [
  {
    theme: 'light',
    label: 'Light theme',
    glyph: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={icon} aria-hidden>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
      </svg>
    ),
  },
  {
    theme: 'dark',
    label: 'Dark theme',
    glyph: (
      <svg viewBox="0 0 20 20" fill="currentColor" className={icon} aria-hidden>
        <path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1Z" />
      </svg>
    ),
  },
  {
    theme: 'dark-gray',
    label: 'Dark gray theme',
    glyph: (
      <svg viewBox="0 0 20 20" className={icon} aria-hidden>
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" />
      </svg>
    ),
  },
];

/** Light / dark / dark-gray segmented switcher; the choice is remembered per browser. */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  return (
    <div role="group" aria-label="Theme" className="flex rounded-lg border border-gray-200 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.theme}
          onClick={() => {
            applyTheme(o.theme);
            setTheme(o.theme);
          }}
          aria-label={o.label}
          aria-pressed={theme === o.theme}
          title={o.label}
          className={`rounded-md p-1 transition-colors ${
            theme === o.theme ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          {o.glyph}
        </button>
      ))}
    </div>
  );
}
