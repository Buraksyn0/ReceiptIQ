/**
 * ReceiptIQ — Dil Bağlamı
 *
 * AuthContext'teki user.language_preference'a göre
 * uygulama genelinde çeviri string'leri sağlar.
 *
 * Kullanım:
 *   const { t, language } = useLanguage();
 *   <Text>{t.settings}</Text>
 *   <Text>{t.forecastBasedOn(3)}</Text>
 */

import React, { createContext, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import translations from '../Constants/Translations';

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const { user } = useContext(AuthContext);
  const language = user?.language_preference || 'tr';
  const t = translations[language] || translations.tr;

  const value = useMemo(() => ({ t, language }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
