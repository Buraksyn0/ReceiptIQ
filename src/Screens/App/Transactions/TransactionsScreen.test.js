import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TransactionsScreen from './TransactionsScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currencySymbol: '₺', convertAmount: (x) => x }),
}));
jest.mock('../../../Context/DateFormatContext', () => ({
  useDateFormat: () => ({ formatDate: (d) => d }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    require('react').useEffect(() => {
      callback();
    }, []);
  },
}));

const TRANSACTIONS = [
  { id: '1', merchant_name: 'Migros', category: 'market', receipt_type: 'expense', total_amount: '100', receipt_date: '2026-09-01', created_at: '2026-09-01', tags: [] },
  { id: '2', merchant_name: 'Starbucks', category: 'food', receipt_type: 'expense', total_amount: '50', receipt_date: '2026-09-02', created_at: '2026-09-02', tags: [] },
];

function mockFetchByUrl(handlers) {
  return jest.fn((url) => {
    for (const [key, response] of Object.entries(handlers)) {
      if (url.includes(key)) return Promise.resolve(response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
  });
}

async function renderScreen(fetchHandlers) {
  global.fetch = mockFetchByUrl(fetchHandlers);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <TransactionsScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('işlem listesi doğru render edilmeli', async () => {
  const { getByText } = await renderScreen({
    '/receipts/': { ok: true, json: () => Promise.resolve(TRANSACTIONS) },
    '/tags/': { ok: true, json: () => Promise.resolve([]) },
  });

  await waitFor(() => {
    expect(getByText('Migros')).toBeTruthy();
    expect(getByText('Starbucks')).toBeTruthy();
  });
});

test('arama, mağaza adına göre listeyi filtrelemeli', async () => {
  const { getByText, queryByText, getByPlaceholderText } = await renderScreen({
    '/receipts/': { ok: true, json: () => Promise.resolve(TRANSACTIONS) },
    '/tags/': { ok: true, json: () => Promise.resolve([]) },
  });

  await waitFor(() => expect(getByText('Migros')).toBeTruthy());

  await fireEvent.changeText(getByPlaceholderText('Mağaza veya kategori ara...'), 'migros');

  await waitFor(() => {
    expect(getByText('Migros')).toBeTruthy();
    expect(queryByText('Starbucks')).toBeNull();
  });
});

test('eşleşme bulunamazsa boş sonuç mesajı gösterilmeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen({
    '/receipts/': { ok: true, json: () => Promise.resolve(TRANSACTIONS) },
    '/tags/': { ok: true, json: () => Promise.resolve([]) },
  });

  await waitFor(() => expect(getByText('Migros')).toBeTruthy());

  await fireEvent.changeText(getByPlaceholderText('Mağaza veya kategori ara...'), 'hicbirseyeuymaz');

  await waitFor(() => {
    expect(getByText('Bu kritere uygun işlem bulunamadı.')).toBeTruthy();
  });
});
