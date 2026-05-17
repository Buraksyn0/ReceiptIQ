import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { getCurrencySymbol } from '../Constants/Currencies';

const CurrencyContext = createContext({
  currency: 'TRY',
  currencySymbol: '₺',
  convertAmount: (a) => a,
  rate: 1,
});

// Yedek kurlar (TRY bazlı, yaklaşık 2026 değerleri)
const FALLBACK_RATES = {
  TRY: 1,
  USD: 0.0277,
  EUR: 0.0255,
  GBP: 0.0216,
  RUB: 2.55,
  JPY: 4.30,
  CNY: 0.201,
  CHF: 0.0246,
  CAD: 0.0386,
  AUD: 0.0437,
  AED: 0.1018,
  SAR: 0.1039,
  INR: 2.36,
  BRL: 0.163,
  MXN: 0.568,
};

export function CurrencyProvider({ children }) {
  const { user } = useContext(AuthContext);
  const currency = user?.currency_preference || 'TRY';
  const currencySymbol = getCurrencySymbol(currency);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (currency === 'TRY') {
      setRate(1);
      return;
    }

    // Frankfurter API — ücretsiz, API key gerekmez
    fetch(`https://api.frankfurter.app/latest?base=TRY&symbols=${currency}`)
      .then(r => r.json())
      .then(data => {
        if (data?.rates?.[currency]) {
          setRate(data.rates[currency]);
        } else {
          setRate(FALLBACK_RATES[currency] ?? 1);
        }
      })
      .catch(() => {
        // API erişilemezse yedek kur kullan
        setRate(FALLBACK_RATES[currency] ?? 1);
      });
  }, [currency]);

  // TRY cinsinden tutarı seçili para birimine çevirir
  const convertAmount = useCallback((tryAmount) => {
    const n = parseFloat(tryAmount);
    if (isNaN(n)) return 0;
    return n * rate;
  }, [rate]);

  const value = useMemo(
    () => ({ currency, currencySymbol, convertAmount, rate }),
    [currency, currencySymbol, convertAmount, rate]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
