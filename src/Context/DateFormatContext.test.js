import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { DateFormatProvider, useDateFormat } from './DateFormatContext';
import { AuthContext } from './AuthContext';

jest.mock('./AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

// Saat dilimi belirsizliğinden kaçınmak için gün ortası bir saat kullanıyoruz
// (gece yarısına yakın saatler, bilgisayarın saat dilimine göre bir gün
// kayabilir — bunu node'da önceden test edip doğruladık).
const SAMPLE_DATE = '2026-05-15T12:00:00';

function makeWrapper(dateFormatPreference) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user: { date_format_preference: dateFormatPreference } }}>
        <DateFormatProvider>{children}</DateFormatProvider>
      </AuthContext.Provider>
    );
  };
}

test('varsayılan format DD/MM/YYYY olmalı', async () => {
  const { result } = await renderHook(() => useDateFormat(), {
    wrapper: makeWrapper(undefined),
  });

  expect(result.current.formatDate(SAMPLE_DATE)).toBe('15/05/2026');
});

test('geçersiz tarih string\'i olduğu gibi geri dönmeli', async () => {
  const { result } = await renderHook(() => useDateFormat(), {
    wrapper: makeWrapper(undefined),
  });

  expect(result.current.formatDate('gecersiz-tarih')).toBe('gecersiz-tarih');
});

test('boş/null tarih için "—" dönmeli', async () => {
  const { result } = await renderHook(() => useDateFormat(), {
    wrapper: makeWrapper(undefined),
  });

  expect(result.current.formatDate(null)).toBe('—');
});

test('user.date_format_preference varsa, o format kullanılmalı (YYYY-MM-DD)', async () => {
  const { result } = await renderHook(() => useDateFormat(), {
    wrapper: makeWrapper('YYYY-MM-DD'),
  });

  await waitFor(() => {
    expect(result.current.formatDate(SAMPLE_DATE)).toBe('2026-05-15');
  });
});
