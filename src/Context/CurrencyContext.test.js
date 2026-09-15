import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { CurrencyProvider, useCurrency } from './CurrencyContext';
import { AuthContext } from './AuthContext';

// AuthContext.js, expo-notifications gibi native modülleri içe aktarıyor —
// bunlar test ortamında (gerçek cihaz olmadan) çalışmıyor. CurrencyContext'in
// AuthContext'ten gerçekte ihtiyacı olan tek şey Context NESNESİ — bu yüzden
// gerçek dosyanın yerine, native modül içermeyen hafif bir sahtesini koyuyoruz.
jest.mock('./AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

// AuthContext'i sahte bir kullanıcıyla besleyen sarmalayıcı — CurrencyProvider
// bunun İÇİNDE olmalı, çünkü kod useContext(AuthContext) çağırıyor.
function makeWrapper(currencyPreference) {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user: { currency_preference: currencyPreference } }}>
        <CurrencyProvider>{children}</CurrencyProvider>
      </AuthContext.Provider>
    );
  };
}

test('TRY seçiliyken oran 1 olmalı, dönüşüm değeri değiştirmemeli', async () => {
  // Bu kütüphanenin bu sürümünde renderHook bir Promise döndürüyor
  // (React 19'un eşzamanlı render desteği yüzünden) — await gerekiyor.
  const { result } = await renderHook(() => useCurrency(), {
    wrapper: makeWrapper('TRY'),
  });

  expect(result.current.currency).toBe('TRY');
  expect(result.current.rate).toBe(1);
  expect(result.current.convertAmount(100)).toBe(100);
});

afterEach(() => {
  // Her testten sonra sahte fetch'i temizle, testler birbirini etkilemesin
  delete global.fetch;
});

test('USD seçiliyken, fetch başarılı olursa API\'den gelen kuru kullanmalı', async () => {
  // Gerçek ağ isteği atmak yerine, sahte bir "başarılı cevap" kuruyoruz
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ rates: { USD: 0.03 } }),
    })
  );

  const { result } = await renderHook(() => useCurrency(), {
    wrapper: makeWrapper('USD'),
  });

  // useEffect içindeki fetch asenkron tamamlanıyor — sonuç gelene kadar bekle
  await waitFor(() => {
    expect(result.current.rate).toBe(0.03);
  });

  expect(result.current.convertAmount(100)).toBeCloseTo(3);
});

test('USD seçiliyken, fetch başarısız olursa yedek kuru kullanmalı', async () => {
  // fetch'in ağ hatasıyla reddedildiği (reject) durumu simüle ediyoruz
  global.fetch = jest.fn(() => Promise.reject(new Error('ağ hatası')));

  const { result } = await renderHook(() => useCurrency(), {
    wrapper: makeWrapper('USD'),
  });

  await waitFor(() => {
    // CurrencyContext.js'deki FALLBACK_RATES.USD değeri
    expect(result.current.rate).toBe(0.0277);
  });
});
