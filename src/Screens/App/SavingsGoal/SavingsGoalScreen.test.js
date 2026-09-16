import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SavingsGoalScreen from './SavingsGoalScreen';
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

async function renderScreen(fetchHandlers, navigationOverrides) {
  global.fetch = mockFetchByUrlAndMethod(fetchHandlers);
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), ...navigationOverrides };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <SavingsGoalScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});

test('hedef yoksa boş durum gösterilmeli', async () => {
  const { getByText } = await renderScreen({
    'GET /goals/progress': { ok: true, json: () => Promise.resolve({ goal: null, saved_amount: 0, progress_percent: 0 }) },
  });

  await waitFor(() => {
    expect(getByText('Henüz hedef yok')).toBeTruthy();
  });
});

test('hedef varsa ilerleme, istatistikler ve rota durumu gösterilmeli', async () => {
  const { getByText, getAllByText } = await renderScreen({
    'GET /goals/progress': {
      ok: true,
      json: () => Promise.resolve({
        goal: { id: 'g1', title: 'Tatil Fonu', target_amount: '10000', deadline: null },
        saved_amount: 4000,
        progress_percent: 40,
        monthly_savings: [],
        avg_monthly_savings: 500,
        estimated_months: 12,
        on_track: 'on_track',
        required_monthly: null,
      }),
    },
  });

  await waitFor(() => {
    expect(getByText('Tatil Fonu')).toBeTruthy();
  });
  expect(getByText('%40')).toBeTruthy();
  expect(getByText('Tam yolundasınız')).toBeTruthy();
  // "Biriktirilen" hem ilerleme etiketinde hem istatistik kartında gösteriliyor
  expect(getAllByText('₺4.000,00').length).toBeGreaterThanOrEqual(1);
  // "Kalan" hem istatistik kartında hem tahmin kartında gösteriliyor
  expect(getAllByText('₺6.000,00').length).toBeGreaterThanOrEqual(1);
});

test('yeni hedef oluşturma akışı doğru POST body ile istek atmalı', async () => {
  const postSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'g2' }) }));
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET' && url.includes('/goals/progress')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ goal: null, saved_amount: 0, progress_percent: 0 }) });
    }
    if (method === 'POST' && url.includes('/goals/')) return postSpy(url, options);
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });

  const { getByText, getByPlaceholderText } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <SavingsGoalScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />
    </AuthContext.Provider>
  );

  await waitFor(() => expect(getByText('Henüz hedef yok')).toBeTruthy());

  await fireEvent.press(getByText('Hedef Oluştur'));
  await fireEvent.changeText(getByPlaceholderText('Örn: Tatil Fonu, Araba, Acil Durum'), 'Araba');
  await fireEvent.changeText(getByPlaceholderText('0'), '50000');
  await fireEvent.press(getByText('Kaydet'));

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalled();
  });
  const [, options] = postSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body.title).toBe('Araba');
  expect(body.target_amount).toBe(50000);
  expect(body.deadline).toBeNull();
});

test('hedefi sil onaylanınca DELETE isteği atmalı', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const deleteBtn = buttons?.find(b => b.text === 'Sil');
    deleteBtn?.onPress?.();
  });
  const deleteSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET' && url.includes('/goals/progress')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          goal: { id: 'g1', title: 'Tatil Fonu', target_amount: '10000', deadline: null },
          saved_amount: 4000,
          progress_percent: 40,
        }),
      });
    }
    if (method === 'DELETE' && url.includes('/goals/g1')) return deleteSpy(url, options);
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });

  const { getByText } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <SavingsGoalScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />
    </AuthContext.Provider>
  );

  await waitFor(() => expect(getByText('Tatil Fonu')).toBeTruthy());
  await fireEvent.press(getByText('Hedefi Sil'));

  await waitFor(() => {
    expect(deleteSpy).toHaveBeenCalled();
  });
});

test('sohbet FAB butonuna basınca SavingsGoalChat ekranına gidilmeli', async () => {
  const { getByText, getByTestId, navigation } = await renderScreen({
    'GET /goals/progress': { ok: true, json: () => Promise.resolve({ goal: null, saved_amount: 0, progress_percent: 0 }) },
  });

  await waitFor(() => expect(getByText('Henüz hedef yok')).toBeTruthy());

  await fireEvent.press(getByTestId('savings-goal-chat-fab'));
  expect(navigation.navigate).toHaveBeenCalledWith('SavingsGoalChat');
});
