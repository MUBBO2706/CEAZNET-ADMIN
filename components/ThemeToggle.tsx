import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: string;
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark and light theme"
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        focus:ring-offset-[var(--sidebar-bg)]
        ${isDark ? 'bg-indigo-600' : 'bg-gray-400'}
      `}
    >
      <span className="sr-only">Use setting</span>
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow ring-0 
          transition duration-200 ease-in-out
          ${isDark ? 'translate-x-5' : 'translate-x-0'}
        `}
      >
        {isDark ? (
            <Moon size={14} className="text-indigo-600" />
        ) : (
            <Sun size={14} className="text-yellow-500" />
        )}
      </span>
    </button>
  );
};

export default ThemeToggle;
