'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDefaultTheme, getAllThemes, type ThemeConfig } from '@/lib/themes';

interface CustomThemeContextType {
  currentTheme: ThemeConfig;
  setTheme: (themeName: string) => void;
  availableThemes: ThemeConfig[];
}

const CustomThemeContext = createContext<CustomThemeContextType | undefined>(
  undefined
);

const THEME_STORAGE_KEY = 'custom-theme';

/**
 * Provides a context for managing and applying custom themes in a React application.
 *
 * This component initializes the current theme based on the default theme and checks for a saved theme in localStorage upon mounting.
 * It allows for setting a new theme, which updates both the state and localStorage, and applies the theme to the document.
 * The component also provides a context to its children, exposing the current theme, a function to set a new theme, and the list of available themes.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered within the theme provider.
 */
export function CustomThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentTheme, setCurrentTheme] =
    useState<ThemeConfig>(getDefaultTheme());
  const [availableThemes] = useState<ThemeConfig[]>(getAllThemes());

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      const theme = availableThemes.find(t => t.name === savedTheme);
      if (theme) {
        setCurrentTheme(theme);
        applyThemeToDocument(theme.name);
      }
    }
  }, [availableThemes]);

  const setTheme = (themeName: string) => {
    const theme = availableThemes.find(t => t.name === themeName);
    if (theme) {
      setCurrentTheme(theme);
      localStorage.setItem(THEME_STORAGE_KEY, themeName);
      applyThemeToDocument(themeName);
    }
  };

  const applyThemeToDocument = (themeName: string) => {
    const updateTheme = () => {
      // Remove existing theme classes
      document.documentElement.removeAttribute('data-theme');

      // Apply new theme
      if (themeName !== 'default') {
        document.documentElement.setAttribute('data-theme', themeName);
      }
    };

    // Use View Transition API if supported for smoother animations
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(updateTheme);
    } else {
      updateTheme();
    }
  };

  return (
    <CustomThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        availableThemes,
      }}
    >
      {children}
    </CustomThemeContext.Provider>
  );
}

export function useCustomTheme() {
  const context = useContext(CustomThemeContext);
  if (context === undefined) {
    throw new Error('useCustomTheme must be used within a CustomThemeProvider');
  }
  return context;
}
