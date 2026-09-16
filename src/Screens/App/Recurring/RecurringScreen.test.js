import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecurringScreen from './RecurringScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currencySymbol: '₺', convertAmount: (x) => x }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    require('react').useEffect(() => {
      callback();
    }, []);
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

function mockFetchByUrlAndMethod(handlers) {
  return jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    for (const [key, response] of Object.entries(handlers)) {
      const [keyMethod, keyUrl] = key.split(' ');
      if (method === keyMethod && url.includes(keyUrl)) return Promise.resolve(response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

async function renderScreen(fetchHandlers) {
  global.fetch = mockFetchByUrlAndMethod(fetchHandlers);
  const navigation = { goBack: jest.fn() };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <RecurringScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('hiç tekrar yoksa boş durum mesajı gösterilmeli', async () => {
  const { getByText } = await renderScreen({ 'GET /recurring/': { ok: true, json: () => Promise.resolve([]) } });

  await waitFor(() => {
    expect(getByText('Tekrar Eklenmedi')).toBeTruthy();
  });
});

test('farklı sıklıklardaki giderler doğru aylık toplama çevrilmeli (gelir hariç)', async () => {
  // monthly 100 -> 100, weekly 50 -> 50*4=200, yearly 1200 -> 1200/12=100
  // toplam = 400. income kalemi (ne kadar büyük olursa olsun) hariç tutulmalı.
  const items = [
    { id: '1', merchant_name: 'Kira', amount: '100', category: 'rent', receipt_type: 'expense', frequency: 'monthly', next_date: '2026-10-01', is_active: true },
    { id: '2', merchant_name: 'Temizlikçi', amount: '50', category: 'other', receipt_type: 'expense', frequency: 'weekly', next_date: '2026-09-20', is_active: true },
    { id: '3', merchant_name: 'Sigorta', amount: '1200', category: 'other', receipt_type: 'expense', frequency: 'yearly', next_date: '2027-01-01', is_active: true },
    { id: '4', merchant_name: 'Maaş', amount: '99999', category: 'salary', receipt_type: 'income', frequency: 'monthly', next_date: '2026-10-01', is_active: true },
  ];

  const { getByText } = await renderScreen({ 'GET /recurring/': { ok: true, json: () => Promise.resolve(items) } });

  await waitFor(() => {
    expect(getByText('₺400,00')).toBeTruthy();
  });
});

test('yeni tekrar oluşturma akışı doğru istekle POST atmalı', async () => {
  const postSpy = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '5' }) })
  );
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'POST' && url.includes('/recurring/')) return postSpy(url, options);
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });

  const navigation = { goBack: jest.fn() };
  const { getByText, getByPlaceholderText, getByTestId } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <RecurringScreen navigation={navigation} />
    </AuthContext.Provider>
  );

  await fireEvent.press(getByTestId('open-add-recurring-modal'));
  await fireEvent.changeText(getByPlaceholderText('Netflix, Kira, Spor Salonu...'), 'Netflix');
  await fireEvent.changeText(getByPlaceholderText('0.00'), '150');
  await fireEvent.press(getByText('Haftalık'));
  await fireEvent.press(getByText('Market'));
  await fireEvent.press(getByText('Kaydet'));

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalled();
  });
  const [, options] = postSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body.merchant_name).toBe('Netflix');
  expect(body.amount).toBe(150);
  expect(body.frequency).toBe('weekly');
  expect(body.category).toBe('market');
});
