import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WeeklySummaryScreen from './WeeklySummaryScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));
jest.mock('../../../Context/LanguageContext', () => ({
  useLanguage: () => ({ t: {} }),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currencySymbol: '₺', convertAmount: (x) => x }),
}));

const SUMMARY_DATA = {
  this_week: { start_date: '2026-09-07', end_date: '2026-09-13', total: 1500, transaction_count: 8 },
  last_week: { start_date: '2026-08-31', end_date: '2026-09-06', total: 1000, transaction_count: 5 },
  change_percent: 50,
  top_categories: [
    { category: 'market', total: 800, percentage: 53.3 },
    { category: 'food', total: 400, percentage: 26.7 },
  ],
  budget_status: { total_spent: 1500, total_limit: 3000, percentage: 50 },
};

async function renderScreen(fetchImpl, navigationOverrides) {
  global.fetch = fetchImpl;
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), ...navigationOverrides };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <WeeklySummaryScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('bu hafta toplamı ve geçen haftaya göre değişim doğru gösterilmeli', async () => {
  const { getByText } = await renderScreen(
    jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(SUMMARY_DATA) }))
  );

  await waitFor(() => {
    expect(getByText('₺1.500,00')).toBeTruthy();
  });
  expect(getByText('8 işlem')).toBeTruthy();
  expect(getByText('Geçen haftadan %50 fazla')).toBeTruthy();
});

test('istek başarısız olursa hata mesajı gösterilmeli ve tekrar dene çalışmalı', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(SUMMARY_DATA) });

  const { getByText } = await renderScreen(fetchMock);

  await waitFor(() => {
    expect(getByText('Özet yüklenemedi.')).toBeTruthy();
  });

  await fireEvent.press(getByText('Tekrar dene'));

  await waitFor(() => {
    expect(getByText('₺1.500,00')).toBeTruthy();
  });
});

test('en çok harcanan kategoriler ve bütçe durumu doğru gösterilmeli', async () => {
  const { getByText } = await renderScreen(
    jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(SUMMARY_DATA) }))
  );

  await waitFor(() => expect(getByText('Market')).toBeTruthy());
  expect(getByText('%53.3')).toBeTruthy();
  expect(getByText('Gıda')).toBeTruthy();
  expect(getByText('%50 kullanıldı')).toBeTruthy();
});

test('"Tüm İşlemleri Gör" butonuna basınca Transactions ekranına gidilmeli', async () => {
  const { getByText, navigation } = await renderScreen(
    jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(SUMMARY_DATA) }))
  );

  await waitFor(() => expect(getByText('Tüm İşlemleri Gör')).toBeTruthy());
  await fireEvent.press(getByText('Tüm İşlemleri Gör'));

  expect(navigation.navigate).toHaveBeenCalledWith('Transactions');
});
