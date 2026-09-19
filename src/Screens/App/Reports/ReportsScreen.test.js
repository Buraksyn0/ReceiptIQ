import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ReportsScreen from './ReportsScreen';
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
  useLanguage: () => ({ t: require('../../../Constants/Translations').default.tr }),
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
jest.mock('react-native-gifted-charts', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return {
    PieChart: (props) => ReactActual.createElement(RN.View, { testID: 'pie-chart' }),
    BarChart: (props) => ReactActual.createElement(RN.View, { testID: 'bar-chart' }),
  };
});

function mockFetchByUrl(handlers) {
  return jest.fn((url) => {
    for (const [key, response] of Object.entries(handlers)) {
      if (url.includes(key)) return Promise.resolve(response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
  });
}

async function renderScreen(receipts, monthly = { months: [] }) {
  global.fetch = mockFetchByUrl({
    '/receipts/': { ok: true, json: () => Promise.resolve(receipts) },
    '/analytics/monthly': { ok: true, json: () => Promise.resolve(monthly) },
  });
  const navigation = { goBack: jest.fn() };
  return render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <ReportsScreen navigation={navigation} />
    </AuthContext.Provider>
  );
}

afterEach(() => {
  delete global.fetch;
});

test('gelir/gider toplamları ve tasarruf oranı doğru hesaplanmalı', async () => {
  const receipts = [
    { total_amount: '3000', receipt_type: 'income', category: 'salary' },
    { total_amount: '600', receipt_type: 'expense', category: 'market' },
    { total_amount: '400', receipt_type: 'expense', category: 'food' },
  ];
  const { getByText } = await renderScreen(receipts);

  await waitFor(() => {
    expect(getByText('₺3.000')).toBeTruthy();
  });
  // gelir 3000, gider 1000, tasarruf oranı = (3000-1000)/3000*100 = %66,7
  expect(getByText('%66,7')).toBeTruthy();
  // Market en yüksek gider (600), listede ilk sırada olmalı
  expect(getByText('Market')).toBeTruthy();
  expect(getByText('₺600,00')).toBeTruthy();
});

test('hiç gider yoksa "Gider Yok" boş durumu gösterilmeli', async () => {
  const receipts = [
    { total_amount: '1000', receipt_type: 'income', category: 'salary' },
  ];
  const { getByText } = await renderScreen(receipts);

  await waitFor(() => {
    expect(getByText('Gider Yok')).toBeTruthy();
  });
  // "Gider Yok" satırındaki tutar, pasta grafiğin iç çizim değeri (1) değil,
  // gerçek gider tutarı (0) olmalı — bkz. displayValue düzeltmesi.
  expect(getByText('₺0,00')).toBeTruthy();
});
