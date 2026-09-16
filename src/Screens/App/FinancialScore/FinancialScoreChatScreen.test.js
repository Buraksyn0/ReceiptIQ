import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FinancialScoreChatScreen from './FinancialScoreChatScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));

async function renderScreen() {
  const navigation = { goBack: jest.fn() };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <FinancialScoreChatScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('karşılama mesajı ve hızlı sorular ilk açılışta gösterilmeli', async () => {
  const { getByText } = await renderScreen();

  expect(getByText('Skorumu nasıl A yapabilirim?')).toBeTruthy();
  expect(getByText('Hangi kategoride fazla harcıyorum?')).toBeTruthy();
});

test('hızlı soruya basılınca /chat/financial-score isteği atılıp yanıt gösterilmeli', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ answer: 'Bütçeni aşmıyorsun, harika gidiyor!' }) })
  );

  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Bütçemi aşıyor muyum?'));

  await waitFor(() => {
    expect(getByText('Bütçeni aşmıyorsun, harika gidiyor!')).toBeTruthy();
  });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/chat/financial-score');
  const body = JSON.parse(options.body);
  expect(body.question).toBe('Bütçemi aşıyor muyum?');
});

test('bağlantı hatasında kullanıcıya uygun hata mesajı gösterilmeli', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('network down')));

  const { getByText, getByPlaceholderText } = await renderScreen();

  const input = getByPlaceholderText('Finansal durumun hakkında sor…');
  await fireEvent.changeText(input, 'Bu ay ne durumdayım?');
  await fireEvent(input, 'submitEditing');

  await waitFor(() => {
    expect(getByText('Bağlantı hatası. Lütfen tekrar dene.')).toBeTruthy();
  });
});
