import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (t: Theme) => void;
    toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemPrefersDark() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark());
    root.classList.toggle('dark', isDark);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = React.useState<Theme>(() => {
        if (typeof window === 'undefined') return 'system';
        return (localStorage.getItem('theme') as Theme) || 'system';
    });

    React.useEffect(() => {
        applyTheme(theme);
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', theme);
        }
    }, [theme]);

    React.useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        mq.addEventListener?.('change', handler);
        return () => mq.removeEventListener?.('change', handler);
    }, [theme]);

    const value = React.useMemo<ThemeContextValue>(() => ({
        theme,
        setTheme: (t) => setThemeState(t),
        toggle: () => {
            setThemeState((prev) => {
                if (prev === 'light') return 'dark';
                if (prev === 'dark') return 'system';
                return 'light';
            });
        },
    }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
    const ctx = React.useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
