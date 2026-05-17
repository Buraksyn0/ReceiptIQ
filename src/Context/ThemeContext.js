/**
 * ReceiptIQ — Tema Bağlamı
 *
 * AuthContext'teki user.theme_preference'a göre
 * uygulama genelinde light/dark renkleri sağlar.
 *
 * Kullanım:
 *   const { colors, isDarkMode } = useTheme();
 *   <View style={{ backgroundColor: colors.background }} />
 */

import React, { createContext, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';

export const ThemeContext = createContext();

const lightColors = {
  background:      '#F5F7FA',
  card:            '#FFFFFF',
  cardSecondary:   '#F7FAFC',
  textMain:        '#0A2540',
  textSecondary:   '#7B8C9E',
  placeholder:     '#AAB8C2',
  border:          '#E2E8F0',
  inputBackground: '#FFFFFF',
  statusBar:       'dark',
};

const darkColors = {
  background:      '#0F1922',
  card:            '#1A2632',
  cardSecondary:   '#162030',
  textMain:        '#E2E8F0',
  textSecondary:   '#A0AEC0',
  placeholder:     '#718096',
  border:          '#2D3748',
  inputBackground: '#1A2632',
  statusBar:       'light',
};

export function ThemeProvider({ children }) {
  const { user } = useContext(AuthContext);
  const isDarkMode = user?.theme_preference === 'dark';
  const colors = isDarkMode ? darkColors : lightColors;

  const value = useMemo(() => ({ isDarkMode, colors }), [isDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
