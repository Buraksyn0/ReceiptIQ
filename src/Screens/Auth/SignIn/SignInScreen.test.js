import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignInScreen from './SignInScreen';
import { AuthContext } from '../../../Context/AuthContext';

// AuthContext.js native modüller içe aktarıyor — hafif sahtesini koyuyoruz
jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

async function renderScreen({ login = jest.fn() } = {}) {
  const navigation = { navigate: jest.fn() };
  const route = { params: {} };

  // render() da (renderHook gibi) bu sürümde bir Promise döndürüyor — await şart
  const rendered = await render(
    <AuthContext.Provider value={{ login }}>
      <SignInScreen navigation={navigation} route={route} />
    </AuthContext.Provider>
  );

  return { navigation, ...rendered };
}

beforeEach(() => {
  // Kod düz alert(...) çağırıyor (Alert.alert değil) — test ortamında
  // tanımlı olmayabilir, kendi sahte halimizi koyup çağrıları izliyoruz
  global.alert = jest.fn();
});

afterEach(() => {
  delete global.fetch;
  delete global.alert;
});

test('ekran render olunca temel elemanlar görünmeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen();

  expect(getByText('ReceiptIQ')).toBeTruthy();
  expect(getByPlaceholderText('Email')).toBeTruthy();
  expect(getByPlaceholderText('Password')).toBeTruthy();
  expect(getByText('Sign In')).toBeTruthy();
});

test('boş alanlarla giriş denenirse uyarı gösterilmeli, fetch atılmamalı', async () => {
  global.fetch = jest.fn();
  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Sign In'));

  expect(global.alert).toHaveBeenCalledWith('Email ve şifre boş olamaz!');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('doğru bilgilerle giriş başarılı olursa login() çağrılmalı', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ access_token: 'sahte-token-123' }),
    })
  );
  const loginMock = jest.fn();
  const { getByText, getByPlaceholderText } = await renderScreen({ login: loginMock });

  // Bu kütüphanenin bu sürümünde fireEvent.* de Promise döndürüyor — hepsini await ediyoruz
  await fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'sifre123');
  await fireEvent.press(getByText('Sign In'));

  await waitFor(() => {
    expect(loginMock).toHaveBeenCalledWith('sahte-token-123');
  });
});
