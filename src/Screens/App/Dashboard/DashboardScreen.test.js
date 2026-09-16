import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DashboardScreen from './DashboardScreen';
import { AuthContext } from '../../../Context/AuthContext';
import translations from '../../../Constants/Translations';

// AuthContext.js native modüller içe aktarıyor — hafif sahtesini koyuyoruz
jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

// Diğer Context'ler de kendi içlerinde AuthContext kullanıyor — karmaşık
// Provider iç içe geçmesinden kaçınmak için hook'ları doğrudan mocklyoruz.
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currencySymbol: '₺', convertAmount: (x) => x }),
}));
jest.mock('../../../Context/DateFormatContext', () => ({
  useDateFormat: () => ({ formatDate: (d) => d }),
}));
jest.mock('../../../Context/LanguageContext', () => ({
  // jest.mock fabrikaları dosyanın en üstüne taşınır (hoisting) — bu yüzden
  // yukarıda import edilen `translations`'a değil, gecikmeli require()'a
  // erişmemiz gerekiyor.
  useLanguage: () => ({ t: require('../../../Constants/Translations').default.tr, language: 'tr' }),
}));

// useFocusEffect gerçek bir NavigationContainer gerektirir — testte sadece
// verilen fonksiyonu ekran açılır açılmaz bir kere çalıştıran basit bir
// sahteyle değiştiriyoruz.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    require('react').useEffect(() => {
      callback();
    }, []);
  },
}));

function mockFetchByUrl(handlers) {
  return jest.fn((url) => {
    for (const [key, response] of Object.entries(handlers)) {
      if (url.includes(key)) return Promise.resolve(response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

async function renderScreen(fetchHandlers) {
  global.fetch = mockFetchByUrl(fetchHandlers);
  const navigation = { navigate: jest.fn() };
  const rendered = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthContext.Provider value={{ userToken: 'sahte-token', user: { full_name: 'Test Kullanici' } }}>
        <DashboardScreen navigation={navigation} />
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('gelir/gider fişlerinden doğru bakiye hesaplayıp göstermeli', async () => {
  const receipts = [
    { id: '1', merchant_name: 'Maaş', total_amount: '1000', receipt_type: 'income', receipt_date: '2026-09-01', is_anomaly: false },
    { id: '2', merchant_name: 'Migros', total_amount: '300', receipt_type: 'expense', receipt_date: '2026-09-02', is_anomaly: false },
  ];

  const { getByText } = await renderScreen({
    '/receipts/': { ok: true, json: () => Promise.resolve(receipts) },
  });

  // Bakiye = 1000 (gelir) - 300 (gider) = 700
  await waitFor(() => {
    expect(getByText('₺700,00')).toBeTruthy();
  });
  expect(getByText('Test Kullanici')).toBeTruthy();
  expect(getByText('Maaş')).toBeTruthy();
  expect(getByText('Migros')).toBeTruthy();
});

test('hiç fiş yoksa "işlem yok" mesajı gösterilmeli', async () => {
  const { getByText } = await renderScreen({
    '/receipts/': { ok: true, json: () => Promise.resolve([]) },
  });

  await waitFor(() => {
    expect(getByText(translations.tr.noTransactions)).toBeTruthy();
  });
});
