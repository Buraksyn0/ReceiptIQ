import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import VerifyEmailScreen from './VerifyEmailScreen';

async function renderScreen(params = { email: 'test@test.com' }) {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const rendered = await render(
    <VerifyEmailScreen navigation={navigation} route={{ params }} />
  );
  return { navigation, ...rendered };
}

function mockFetch(response) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}), ...response })
  );
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete global.fetch;
});

test('ekran adresi ve temel elemanları göstermeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen();

  expect(getByText('E-postanı Doğrula')).toBeTruthy();
  expect(getByText(/test@test\.com/)).toBeTruthy();
  expect(getByPlaceholderText('6 haneli kod')).toBeTruthy();
  expect(getByText('Doğrula')).toBeTruthy();
});

test('autoSend verilmemişse açılışta kod yeniden gönderilmemeli (kayıt zaten gönderdi)', async () => {
  mockFetch({});
  await renderScreen({ email: 'test@test.com' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('autoSend verilirse açılışta kod istenmeli', async () => {
  mockFetch({});
  await renderScreen({ email: 'test@test.com', autoSend: true });

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/auth/resend-verification');
  expect(JSON.parse(options.body)).toEqual({ email: 'test@test.com' });
});

test('6 haneden kısa kodla backend\'e gitmeden uyarı vermeli', async () => {
  mockFetch({});
  const { getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.changeText(getByPlaceholderText('6 haneli kod'), '123');
  await fireEvent.press(getByText('Doğrula'));

  expect(Alert.alert).toHaveBeenCalledWith('Hata', '6 haneli kodu girin.');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('doğru kodla doğrulama başarılı olursa giriş ekranına yönlendirmeli', async () => {
  mockFetch({});
  const { navigation, getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.changeText(getByPlaceholderText('6 haneli kod'), '123456');
  await fireEvent.press(getByText('Doğrula'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const [, , buttons] = Alert.alert.mock.calls[0];
  buttons[0].onPress();

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/auth/verify-email');
  expect(JSON.parse(options.body)).toEqual({ email: 'test@test.com', code: '123456' });
  expect(navigation.navigate).toHaveBeenCalledWith('SignIn');
});

test('yanlış kodda backend hata mesajı gösterilmeli, yönlendirme olmamalı', async () => {
  mockFetch({ ok: false, json: () => Promise.resolve({ detail: 'Hatalı kod.' }) });
  const { navigation, getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.changeText(getByPlaceholderText('6 haneli kod'), '000000');
  await fireEvent.press(getByText('Doğrula'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Hatalı kod.'));
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('tekrar gönder butonu 60 saniye boyunca kapalı, sonra çalışmalı', async () => {
  jest.useFakeTimers();
  mockFetch({});
  const { getByText, getByTestId } = await renderScreen();

  // İlk anda geri sayım var ve basmak istek atmamalı
  expect(getByText('Kodu tekrar gönder (60)')).toBeTruthy();
  await fireEvent.press(getByTestId('verify-resend-button'));
  expect(global.fetch).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(60000);
  });
  expect(getByText('Kodu tekrar gönder')).toBeTruthy();

  await fireEvent.press(getByTestId('verify-resend-button'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(global.fetch.mock.calls[0][0]).toContain('/auth/resend-verification');
  // Gönderince geri sayım yeniden başlar
  await waitFor(() => expect(getByText('Kodu tekrar gönder (60)')).toBeTruthy());
});

test('geri butonu önceki ekrana dönmeli', async () => {
  const { navigation, getByTestId } = await renderScreen();
  await fireEvent.press(getByTestId('verify-back-button'));
  expect(navigation.goBack).toHaveBeenCalled();
});
