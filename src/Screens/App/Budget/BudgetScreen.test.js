import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BudgetScreen from './BudgetScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
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
      <BudgetScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('hiç bütçe yoksa boş durum mesajı gösterilmeli', async () => {
  const { getByText } = await renderScreen({ 'GET /budgets/': { ok: true, json: () => Promise.resolve([]) } });

  await waitFor(() => {
    expect(getByText('Limit Belirlenmedi')).toBeTruthy();
  });
});

test('bütçe listesi doğru harcama/limit ve yüzdeyle gösterilmeli', async () => {
  const { getByText, getAllByText } = await renderScreen({
    'GET /budgets/': {
      ok: true,
      json: () => Promise.resolve([
        { id: '1', category: 'market', limit_amount: '500', spent_amount: 250 },
      ]),
    },
  });

  await waitFor(() => {
    expect(getByText('Market')).toBeTruthy();
  });
  // Aynı yüzde hem üstteki toplam özet kartında hem kategori kartında
  // gösteriliyor (tek kategori olduğu için ikisi de %50) — iki eşleşme bekliyoruz.
  expect(getAllByText('%50 Harcandı')).toHaveLength(2);
});

test('yeni bütçe oluşturma akışı doğru istekle POST atmalı', async () => {
  const postSpy = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '2' }) })
  );
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'POST' && url.includes('/budgets/')) return postSpy(url, options);
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });

  const navigation = { goBack: jest.fn() };
  const { getByText, getByPlaceholderText, getByTestId } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <BudgetScreen navigation={navigation} />
    </AuthContext.Provider>
  );

  await fireEvent.press(getByTestId('open-add-budget-modal'));
  await fireEvent.press(getByText('Market'));
  await fireEvent.changeText(getByPlaceholderText('0,00'), '500');
  await fireEvent.press(getByText('Limiti Kaydet'));

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalled();
  });
  const [, options] = postSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body).toEqual({ category: 'market', limit_amount: 500, period: 'monthly' });
});
