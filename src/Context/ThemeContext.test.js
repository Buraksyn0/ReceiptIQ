import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from './ThemeContext';
import { AuthContext } from './AuthContext';

// Aynı kalıp: AuthContext'in native modül içeren gerçek halini değil,
// hafif sahte halini kullanıyoruz.
jest.mock('./AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

function makeWrapper(themePreference) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user: { theme_preference: themePreference } }}>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthContext.Provider>
    );
  };
}

test('theme_preference "dark" ise koyu tema renkleri kullanılmalı', async () => {
  const { result } = await renderHook(() => useTheme(), {
    wrapper: makeWrapper('dark'),
  });

  expect(result.current.isDarkMode).toBe(true);
  expect(result.current.colors.background).toBe('#0F1922');
});

test('theme_preference "light" ise açık tema renkleri kullanılmalı', async () => {
  const { result } = await renderHook(() => useTheme(), {
    wrapper: makeWrapper('light'),
  });

  expect(result.current.isDarkMode).toBe(false);
  expect(result.current.colors.background).toBe('#F5F7FA');
});
