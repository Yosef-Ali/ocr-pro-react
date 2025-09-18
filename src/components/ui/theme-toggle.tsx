import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeProvider';
import { Button } from './button';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();
    return (
        <div className="inline-flex items-center gap-1">
            <Button
                variant={theme === 'light' ? 'default' : 'ghost'}
                size="icon"
                aria-label="Light theme"
                onClick={() => setTheme('light')}
            >
                <Sun className="h-5 w-5" />
            </Button>
            <Button
                variant={theme === 'dark' ? 'default' : 'ghost'}
                size="icon"
                aria-label="Dark theme"
                onClick={() => setTheme('dark')}
            >
                <Moon className="h-5 w-5" />
            </Button>
        </div>
    );
};

export default ThemeToggle;
