// src/app/modules/ui/theme.ts

export const lightTheme = {
    background: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    foreground: '#0f172a',
    muted: '#64748b',
    mutedForeground: '#94a3b8',
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#f1f5f9',
    secondaryForeground: '#0f172a',
    accent: '#8b5cf6',
    accentForeground: '#ffffff',
    success: '#22c55e',
    warning: '#eab308',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    subtext: '#64748b',
};

export const darkTheme = {
    background: '#020617',
    card: '#0f172a',
    border: '#1e293b',
    foreground: '#f8fafc',
    muted: '#334155',
    mutedForeground: '#94a3b8',
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#1e293b',
    secondaryForeground: '#f8fafc',
    accent: '#8b5cf6',
    accentForeground: '#ffffff',
    success: '#22c55e',
    warning: '#eab308',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    subtext: '#94a3b8',
};

export const getTheme = (isDark: boolean) => (isDark ? darkTheme : lightTheme);
