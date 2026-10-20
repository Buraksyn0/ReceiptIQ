import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import AppleSignInButton from './AppleSignInButton';
import { AuthContext } from '../Context/AuthContext';

// AuthContext.js native modüller içe aktarıyor — hafif sahtesini koyuyoruz
jest.mock('../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

// Apple'ın native modülü testte yok — sahtesini koyuyoruz
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return {
    isAvailableAsync: jest.fn(),
    signInAsync: jest.fn(),
    AppleAuthenticationButton: ({ onPress, testID }) => (
      <Pressable testID={testID} onPress={onPress} />
    ),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { BLACK: 2 },
  };
});

const ORIGINAL_OS = Platform.OS;

async function renderButton({ login = jest.fn() } = {}) {
  const rendered = await render(
    <AuthContext.Provider value={{ login }}>
      <AppleSignInButton />
    </AuthContext.Provider>
  );
  return { login, ...rendered };
}

beforeEach(() => {
  global.alert = jest.fn();
  AppleAuthentication.isAvailableAsync.mockResolvedValue(true);
});

afterEach(() => {
  Platform.OS = ORIGINAL_OS;
  delete global.fetch;
  delete global.alert;
  jest.clearAllMocks();
});

test('iOS\'ta ve Apple girişi destekleniyorsa buton görünmeli', async () => {
  const { findByTestId } = await renderButton();
  expect(await findByTestId('apple-sign-in-button')).toBeTruthy();
});

test('cihaz Apple girişini desteklemiyorsa buton görünmemeli', async () => {
  AppleAuthentication.isAvailableAsync.mockResolvedValue(false);
  const { queryByTestId } = await renderButton();

  await waitFor(() => expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled());
  expect(queryByTestId('apple-sign-in-button')).toBeNull();
});

test('Android\'de buton görünmemeli ve Apple\'a sorulmamalı', async () => {
  Platform.OS = 'android';
  const { queryByTestId } = await renderButton();

  expect(queryByTestId('apple-sign-in-button')).toBeNull();
  expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
});

test('başarılı girişte token backend\'e gönderilmeli ve login çağrılmalı', async () => {
  AppleAuthentication.signInAsync.mockResolvedValue({
    identityToken: 'apple-jwt',
    authorizationCode: 'apple-code',
    fullName: { givenName: 'Burak', familyName: 'Sayan' },
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'our-jwt', token_type: 'bearer' }),
  });

  const { login, findByTestId } = await renderButton();
  await fireEvent.press(await findByTestId('apple-sign-in-button'));

  await waitFor(() => expect(login).toHaveBeenCalledWith('our-jwt'));

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/auth/apple');
  expect(JSON.parse(options.body)).toEqual({
    identity_token: 'apple-jwt',
    full_name: 'Burak Sayan',
    authorization_code: 'apple-code',
  });
});

test('Apple ad vermediyse (ikinci giriş) full_name null gitmeli', async () => {
  AppleAuthentication.signInAsync.mockResolvedValue({
    identityToken: 'apple-jwt',
    fullName: null,
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'our-jwt' }),
  });

  const { findByTestId } = await renderButton();
  await fireEvent.press(await findByTestId('apple-sign-in-button'));

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).full_name).toBeNull();
});

test('kullanıcı Apple penceresini kapatırsa sessizce çıkmalı', async () => {
  AppleAuthentication.signInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
  global.fetch = jest.fn();

  const { login, findByTestId } = await renderButton();
  await fireEvent.press(await findByTestId('apple-sign-in-button'));

  await waitFor(() => expect(AppleAuthentication.signInAsync).toHaveBeenCalled());
  expect(global.fetch).not.toHaveBeenCalled();
  expect(global.alert).not.toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
});

test('backend girişi reddederse hata mesajı gösterilmeli, login çağrılmamalı', async () => {
  AppleAuthentication.signInAsync.mockResolvedValue({ identityToken: 'apple-jwt', fullName: null });
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ detail: 'Apple girişi doğrulanamadı.' }),
  });

  const { login, findByTestId } = await renderButton();
  await fireEvent.press(await findByTestId('apple-sign-in-button'));

  await waitFor(() =>
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Apple girişi doğrulanamadı.'))
  );
  expect(login).not.toHaveBeenCalled();
});

test('Apple yetki kodu vermezse authorization_code null gitmeli', async () => {
  AppleAuthentication.signInAsync.mockResolvedValue({
    identityToken: 'apple-jwt',
    fullName: null,
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'our-jwt' }),
  });

  const { findByTestId } = await renderButton();
  await fireEvent.press(await findByTestId('apple-sign-in-button'));

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).authorization_code).toBeNull();
});
