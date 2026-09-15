import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { AuthContext } from './AuthContext';
import translations from '../Constants/Translations';

jest.mock('./AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

function makeWrapper(languagePreference) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user: { language_preference: languagePreference } }}>
        <LanguageProvider>{children}</LanguageProvider>
      </AuthContext.Provider>
    );
  };
}

test('kullanıcı tercihi yoksa varsayılan dil "tr" olmalı', async () => {
  const { result } = await renderHook(() => useLanguage(), {
    wrapper: makeWrapper(undefined),
  });

  expect(result.current.language).toBe('tr');
  expect(result.current.t).toBe(translations.tr);
});

test('kullanıcı tercihi "en" ise İngilizce çeviriler kullanılmalı', async () => {
  const { result } = await renderHook(() => useLanguage(), {
    wrapper: makeWrapper('en'),
  });

  expect(result.current.language).toBe('en');
  expect(result.current.t).toBe(translations.en);
});

test('desteklenmeyen bir dil kodu gelirse "tr"ye düşmeli', async () => {
  const { result } = await renderHook(() => useLanguage(), {
    wrapper: makeWrapper('xx'),
  });

  expect(result.current.t).toBe(translations.tr);
});
