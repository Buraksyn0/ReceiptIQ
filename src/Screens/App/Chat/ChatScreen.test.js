import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ChatScreen from './ChatScreen';
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

const insets = { top: 0, left: 0, right: 0, bottom: 0 };

function mockFetchByUrl(handlers) {
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
  global.fetch = mockFetchByUrl(fetchHandlers);
  const rendered = await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets }}>
      <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
        <ChatScreen />
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
  return rendered;
}

afterEach(() => {
  delete global.fetch;
});

test('açılış mesajı /chat/insight üzerinden yüklenip gösterilmeli', async () => {
  const { getByText } = await renderScreen({
    'GET /chat/insight': { ok: true, json: () => Promise.resolve({ message: 'Bu ay market harcamaların %20 arttı.' }) },
  });

  await waitFor(() => {
    expect(getByText('Bu ay market harcamaların %20 arttı.')).toBeTruthy();
  });
});

test('/chat/insight başarısız olursa statik karşılama mesajına düşülmeli', async () => {
  const { getByText } = await renderScreen({
    'GET /chat/insight': { ok: false, json: () => Promise.resolve({}) },
  });

  await waitFor(() => {
    expect(getByText('Merhaba! Harcamalarınla ilgili her şeyi sorabilirsin.')).toBeTruthy();
  });
});

test('mesaj gönderilince kullanıcı mesajı eklenmeli ve asistan yanıtı gösterilmeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen({
    'GET /chat/insight': { ok: true, json: () => Promise.resolve({ message: 'Merhaba!' }) },
    'POST /chat/': { ok: true, json: () => Promise.resolve({ answer: 'Bu ay 1.250 TL harcadın.' }) },
  });

  await waitFor(() => expect(getByText('Merhaba!')).toBeTruthy());

  const input = getByPlaceholderText('Bir şey sor...');
  await fireEvent.changeText(input, 'Bu ay ne kadar harcadım?');
  await fireEvent(input, 'submitEditing');

  await waitFor(() => {
    expect(getByText('Bu ay ne kadar harcadım?')).toBeTruthy();
    expect(getByText('Bu ay 1.250 TL harcadın.')).toBeTruthy();
  });
});

test('kaynaklı yanıt geldiğinde "İLGİLİ FİŞLER" bölümü gösterilmeli', async () => {
  const { getByText, getByPlaceholderText, findByText } = await renderScreen({
    'GET /chat/insight': { ok: true, json: () => Promise.resolve({ message: 'Merhaba!' }) },
    'POST /chat/': {
      ok: true,
      json: () => Promise.resolve({ answer: 'En çok Migros\'ta harcadın.||SOURCES||Migros - 250 TL\nCarrefour - 100 TL' }),
    },
  });

  await waitFor(() => expect(getByText('Merhaba!')).toBeTruthy());

  const input = getByPlaceholderText('Bir şey sor...');
  await fireEvent.changeText(input, 'En çok nereye harcadım?');
  await fireEvent(input, 'submitEditing');

  await waitFor(() => {
    expect(getByText('İLGİLİ FİŞLER')).toBeTruthy();
  });
  expect(getByText('Migros - 250 TL')).toBeTruthy();
  expect(getByText('Carrefour - 100 TL')).toBeTruthy();
});
