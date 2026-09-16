import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SavingsGoalChatScreen from './SavingsGoalChatScreen';
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
      <SavingsGoalChatScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('karşılama mesajı ve hızlı sorular ilk açılışta gösterilmeli', async () => {
  const { getByText } = await renderScreen();

  expect(getByText('Merhaba! 👋 Tasarruf hedefin hakkında sormak istediğin bir şey var mı?')).toBeTruthy();
  expect(getByText('Nasıl daha hızlı biriktirebilirim?')).toBeTruthy();
});

test('hızlı soruya basılınca /chat/savings isteği atılıp yanıt gösterilmeli', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ answer: 'Ayda 1000 TL ayırırsan 5 ayda ulaşırsın.' }) })
  );

  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Hedefe ulaşmam ne kadar sürer?'));

  await waitFor(() => {
    expect(getByText('Ayda 1000 TL ayırırsan 5 ayda ulaşırsın.')).toBeTruthy();
  });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/chat/savings');
  const body = JSON.parse(options.body);
  expect(body.question).toBe('Hedefe ulaşmam ne kadar sürer?');
});

test('bağlantı hatasında kullanıcıya uygun hata mesajı gösterilmeli', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('network down')));

  const { getByText, getByPlaceholderText, getByTestId } = await renderScreen();

  const input = getByPlaceholderText('Bir şey sor...');
  await fireEvent.changeText(input, 'Bu ay ne durumdayım?');
  await fireEvent.press(getByTestId('savings-chat-send-button'));

  await waitFor(() => {
    expect(getByText('Bağlantı hatası. Tekrar dene.')).toBeTruthy();
  });
});
