import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeProvider';
import { Button } from './button';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();

    // Determine the effective current mode (handles 'system')
    const isSystemDark = () =>
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && isSystemDark());

    const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={isDark}
            title="Toggle theme"
            onClick={toggleTheme}
        >
            {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
    );
};

export default ThemeToggle;
