import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from './ForgotPasswordScreen';

async function renderScreen() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const rendered = await render(<ForgotPasswordScreen navigation={navigation} />);
  return { navigation, ...rendered };
}

beforeEach(() => {
  // Alert.alert'i mock'luyoruz — eğer butonlar varsa, ilkinin onPress'ini
  // otomatik tetikleyerek "kullanıcı Tamam'a bastı" senaryosunu simüle ediyoruz.
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    if (buttons && buttons[0] && buttons[0].onPress) {
      buttons[0].onPress();
    }
  });
});

afterEach(() => {
  delete global.fetch;
  Alert.alert.mockRestore();
});

test('1. adım render olunca e-posta kutusu ve buton görünmeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen();

  expect(getByText('Şifremi Unuttum')).toBeTruthy();
  expect(getByPlaceholderText('E-posta adresiniz')).toBeTruthy();
  expect(getByText('Kod Gönder')).toBeTruthy();
});

test('boş e-posta ile "Kod Gönder" basılırsa uyarı gösterilmeli', async () => {
  global.fetch = jest.fn();
  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Kod Gönder'));

  expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Lütfen e-posta adresinizi girin.');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('geçerli e-posta ile kod isteği başarılı olursa 2. adıma geçmeli', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: 'Eğer bu e-posta kayıtlıysa, kod gönderildi.' }),
    })
  );
  const { getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.changeText(getByPlaceholderText('E-posta adresiniz'), 'test@test.com');
  await fireEvent.press(getByText('Kod Gönder'));

  // Alert.alert'in mock'u otomatik "Tamam"a bastığı için 2. adıma geçmiş olmalı
  await waitFor(() => {
    expect(getByText('Yeni Şifre')).toBeTruthy();
    expect(getByPlaceholderText('Sıfırlama kodu')).toBeTruthy();
  });
});

test('2. adımda şifreler eşleşmezse uyarı gösterilmeli', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: 'kod gönderildi' }),
    })
  );
  const { getByText, getByPlaceholderText } = await renderScreen();

  // 1. adımı geçip 2. adıma ulaş
  await fireEvent.changeText(getByPlaceholderText('E-posta adresiniz'), 'test@test.com');
  await fireEvent.press(getByText('Kod Gönder'));
  await waitFor(() => expect(getByPlaceholderText('Sıfırlama kodu')).toBeTruthy());

  await fireEvent.changeText(getByPlaceholderText('Sıfırlama kodu'), '123456');
  await fireEvent.changeText(getByPlaceholderText('Yeni şifre'), 'sifre123');
  await fireEvent.changeText(getByPlaceholderText('Yeni şifre (tekrar)'), 'FARKLI123');
  await fireEvent.press(getByText('Şifremi Sıfırla'));

  expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Şifreler eşleşmiyor.');
});
