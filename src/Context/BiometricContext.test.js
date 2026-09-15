import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { BiometricProvider, useBiometric } from './BiometricContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

test('cihaz destekliyor + kayıtlı + saklanan tercih "true" ise biometricEnabled true olmalı', async () => {
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
  AsyncStorage.getItem.mockResolvedValue('true');

  const { result } = await renderHook(() => useBiometric(), {
    wrapper: BiometricProvider,
  });

  await waitFor(() => {
    expect(result.current.isSupported).toBe(true);
    expect(result.current.biometricEnabled).toBe(true);
  });
});

test('cihaz desteklemiyorsa, kayıtlı tercih "true" olsa bile enabled false olmalı', async () => {
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(false);
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
  AsyncStorage.getItem.mockResolvedValue('true');

  const { result } = await renderHook(() => useBiometric(), {
    wrapper: BiometricProvider,
  });

  await waitFor(() => {
    expect(result.current.isSupported).toBe(false);
  });
  expect(result.current.biometricEnabled).toBe(false);
});

test('authenticate() başarılı olursa true dönmeli', async () => {
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
  AsyncStorage.getItem.mockResolvedValue(null);
  LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });

  const { result } = await renderHook(() => useBiometric(), {
    wrapper: BiometricProvider,
  });

  await waitFor(() => expect(result.current.isSupported).toBe(true));

  const success = await result.current.authenticate();
  expect(success).toBe(true);
});

test('authenticate() reddedilirse (exception) false dönmeli', async () => {
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
  AsyncStorage.getItem.mockResolvedValue(null);
  LocalAuthentication.authenticateAsync.mockRejectedValue(new Error('kullanıcı iptal etti'));

  const { result } = await renderHook(() => useBiometric(), {
    wrapper: BiometricProvider,
  });

  await waitFor(() => expect(result.current.isSupported).toBe(true));

  const success = await result.current.authenticate();
  expect(success).toBe(false);
});
