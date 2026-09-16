import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from './SignUpScreen';

async function renderScreen() {
  const navigation = { navigate: jest.fn() };
  const rendered = await render(<SignUpScreen navigation={navigation} />);
  return { navigation, ...rendered };
}

beforeEach(() => {
  global.alert = jest.fn();
});

afterEach(() => {
  delete global.fetch;
  delete global.alert;
});

test('ekran render olunca temel elemanlar görünmeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen();

  expect(getByText('Create Account')).toBeTruthy();
  expect(getByPlaceholderText('Full Name')).toBeTruthy();
  expect(getByPlaceholderText('Email')).toBeTruthy();
  expect(getByPlaceholderText('Password')).toBeTruthy();
  expect(getByPlaceholderText('Confirm Password')).toBeTruthy();
  expect(getByText('Sign Up')).toBeTruthy();
});

test('koşullar kabul edilmeden buton devre dışı olmalı, basınca hiçbir şey olmamalı', async () => {
  global.fetch = jest.fn();
  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Sign Up'));

  expect(global.alert).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('koşullar kabul edilip alanlar boş bırakılırsa uyarı gösterilmeli', async () => {
  global.fetch = jest.fn();
  const { getByText } = await renderScreen();

  // Önce koşulları kabul et (checkbox metnin bir parçası olan satıra basıyoruz)
  await fireEvent.press(getByText(/I have read and accept the/));
  await fireEvent.press(getByText('Sign Up'));

  expect(global.alert).toHaveBeenCalledWith('Lütfen tüm alanları doldur!');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('doğru bilgilerle kayıt başarılı olursa SignIn ekranına yönlendirmeli', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: '1', email: 'test@test.com' }),
    })
  );
  const { navigation, getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.changeText(getByPlaceholderText('Full Name'), 'Test Kullanici');
  await fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'sifre123');
  await fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'sifre123');
  await fireEvent.press(getByText(/I have read and accept the/));
  await fireEvent.press(getByText('Sign Up'));

  await waitFor(() => {
    expect(navigation.navigate).toHaveBeenCalledWith('SignIn', { name: 'Test Kullanici' });
  });
});
