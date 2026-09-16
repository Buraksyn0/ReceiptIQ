import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AlertsScreen from './AlertsScreen';
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
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    require('react').useEffect(() => {
      callback();
    }, []);
  },
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
  return render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <AlertsScreen navigation={navigation} />
    </AuthContext.Provider>
  );
}

afterEach(() => {
  delete global.fetch;
});

test('bildirim yoksa boş durum mesajı gösterilmeli', async () => {
  const { getByText } = await renderScreen({
    'GET /notifications/': { ok: true, json: () => Promise.resolve([]) },
  });

  await waitFor(() => {
    expect(getByText('Henüz bildirim yok')).toBeTruthy();
  });
});

test('okunmamış sayısı başlıkta gösterilmeli', async () => {
  const notifications = [
    { id: '1', title: 'Bütçe Aşıldı', message: 'Market bütçeni aştın.', notification_type: 'budget_exceeded', is_read: false, created_at: new Date().toISOString() },
    { id: '2', title: 'Anomali', message: 'Olağandışı harcama.', notification_type: 'anomaly', is_read: true, created_at: new Date().toISOString() },
  ];
  const { getByText } = await renderScreen({
    'GET /notifications/': { ok: true, json: () => Promise.resolve(notifications) },
  });

  await waitFor(() => {
    expect(getByText('Bildirimler (1)')).toBeTruthy();
  });
});

test('okunmamış bildirime basınca okundu işaretlenmeli', async () => {
  const notifications = [
    { id: '1', title: 'Bütçe Aşıldı', message: 'Market bütçeni aştın.', notification_type: 'budget_exceeded', is_read: false, created_at: new Date().toISOString() },
  ];
  const readSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET' && url.includes('/notifications/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(notifications) });
    }
    if (method === 'PATCH' && url.includes('/notifications/1/read')) return readSpy(url, options);
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });

  const { getByText } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <AlertsScreen navigation={{ goBack: jest.fn() }} />
    </AuthContext.Provider>
  );

  await waitFor(() => expect(getByText('Bütçe Aşıldı')).toBeTruthy());
  await fireEvent.press(getByText('Bütçe Aşıldı'));

  await waitFor(() => {
    expect(readSpy).toHaveBeenCalled();
  });
});

test('"Tümünü Oku" butonuna basınca tüm bildirimler okundu işaretlenmeli', async () => {
  const notifications = [
    { id: '1', title: 'Bütçe Aşıldı', message: 'Market bütçeni aştın.', notification_type: 'budget_exceeded', is_read: false, created_at: new Date().toISOString() },
    { id: '2', title: 'Anomali', message: 'Olağandışı harcama.', notification_type: 'anomaly', is_read: false, created_at: new Date().toISOString() },
  ];
  const readAllSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET' && url.includes('/notifications/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(notifications) });
    }
    if (method === 'PATCH' && url.includes('/notifications/read-all')) return readAllSpy(url, options);
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });

  const { getByText, queryByText } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <AlertsScreen navigation={{ goBack: jest.fn() }} />
    </AuthContext.Provider>
  );

  await waitFor(() => expect(getByText('Bildirimler (2)')).toBeTruthy());
  await fireEvent.press(getByText('Tümünü Oku'));

  await waitFor(() => {
    expect(readAllSpy).toHaveBeenCalled();
  });
  expect(queryByText('Bildirimler (2)')).toBeNull();
  expect(getByText('Bildirimler')).toBeTruthy();
});
