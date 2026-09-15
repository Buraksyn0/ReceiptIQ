import React, { useContext } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, AuthContext } from './AuthContext';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Device.isDevice = false -> registerPushToken erken çıkar, push bildirim
// mantığına hiç girmeyiz (o ayrı, çok daha karmaşık bir konu — bilerek dışarıda bıraktık)
jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 4 },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}));

function useAuth() {
  return useContext(AuthContext);
}

afterEach(() => {
  delete global.fetch;
  jest.clearAllMocks();
});

test('saklı token yoksa, isLoading false olmalı ve userToken null kalmalı', async () => {
  SecureStore.getItemAsync.mockResolvedValue(null);

  const { result } = await renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
  expect(result.current.userToken).toBe(null);
});

test('login() çağrılınca token SecureStore\'a kaydedilmeli ve kullanıcı verisi çekilmeli', async () => {
  SecureStore.getItemAsync.mockResolvedValue(null);
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: '1', email: 'test@test.com' }),
    })
  );

  const { result } = await renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  await act(async () => {
    await result.current.login('sahte-token-123');
  });

  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userToken', 'sahte-token-123');
  expect(result.current.userToken).toBe('sahte-token-123');
  expect(result.current.user).toEqual({ id: '1', email: 'test@test.com' });
});

test('logout() çağrılınca token silinmeli ve state sıfırlanmalı', async () => {
  SecureStore.getItemAsync.mockResolvedValue(null);

  const { result } = await renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  await act(async () => {
    await result.current.logout();
  });

  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('userToken');
  expect(result.current.userToken).toBe(null);
  expect(result.current.user).toBe(null);
});
