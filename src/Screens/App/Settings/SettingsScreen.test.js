import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from './SettingsScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));
jest.mock('../../../Context/LanguageContext', () => ({
  useLanguage: () => ({ t: require('../../../Constants/Translations').default.tr, language: 'tr' }),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'TRY', currencySymbol: '₺' }),
}));
jest.mock('../../../Context/BiometricContext', () => ({
  useBiometric: () => ({ biometricEnabled: false, isSupported: false, toggleBiometric: jest.fn() }),
}));
jest.mock('../../../Context/DateFormatContext', () => ({
  useDateFormat: () => ({ dateFormat: 'DD/MM/YYYY', setDateFormat: jest.fn() }),
  DATE_FORMATS: [{ key: 'DD/MM/YYYY', example: '31/12/2026' }],
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

const insets = { top: 0, left: 0, right: 0, bottom: 0 };

const USER = {
  full_name: 'Burak Sayan',
  email: 'burak@example.com',
  city: 'İzmir',
  phone: '+90 555 123 4567',
  created_at: '2026-01-15T00:00:00.000Z',
};

async function renderScreen({ user = USER, logout = jest.fn(), refreshUser = jest.fn(), fetchImpl } = {}) {
  global.fetch = fetchImpl || jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  const navigation = { navigate: jest.fn() };
  const rendered = await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets }}>
      <AuthContext.Provider value={{ user, userToken: 'sahte-token', logout, refreshUser }}>
        <SettingsScreen navigation={navigation} />
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
  return { navigation, logout, refreshUser, ...rendered };
}

afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});

test('profil bilgileri (ad, e-posta, şehir, telefon) doğru gösterilmeli', async () => {
  const { getByText } = await renderScreen();

  expect(getByText('Burak Sayan')).toBeTruthy();
  expect(getByText('burak@example.com')).toBeTruthy();
});

test('hesabı sil onaylanınca DELETE isteği atılıp çıkış yapılmalı', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const confirmBtn = buttons?.find(b => b.style === 'destructive');
    confirmBtn?.onPress?.();
  });
  const deleteSpy = jest.fn(() => Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) }));
  const logout = jest.fn();

  const { getByText } = await renderScreen({
    logout,
    fetchImpl: jest.fn((url, options = {}) => {
      const method = options.method || 'GET';
      if (method === 'DELETE' && url.includes('/users/me')) return deleteSpy(url, options);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }),
  });

  await fireEvent.press(getByText('Hesabımı Sil'));

  await waitFor(() => {
    expect(deleteSpy).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });
});

test('çıkış yap onaylanınca logout çağrılmalı', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const confirmBtn = buttons?.find(b => b.style === 'destructive');
    confirmBtn?.onPress?.();
  });
  const logout = jest.fn();

  const { getByText } = await renderScreen({ logout });

  await fireEvent.press(getByText('Çıkış Yap'));

  expect(logout).toHaveBeenCalled();
});

test('şifre değiştir: yeni şifreler eşleşmezse hata gösterilmeli ve istek atılmamalı', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const patchSpy = jest.fn();

  const { getByText, getAllByText, getAllByPlaceholderText } = await renderScreen({
    fetchImpl: jest.fn((url, options = {}) => {
      const method = options.method || 'GET';
      if (method === 'PATCH') return patchSpy(url, options);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }),
  });

  await fireEvent.press(getByText('Şifre Değiştir'));

  // Her changeText sonrası elemanları yeniden sorguluyoruz — RTL'de eski referanslar
  // yeniden render sonrası bayatlıyor (props güncellenmiyor).
  let passwordFields = getAllByPlaceholderText('••••••');
  await fireEvent.changeText(passwordFields[0], 'eskisifre');
  passwordFields = getAllByPlaceholderText('••••••');
  await fireEvent.changeText(passwordFields[1], 'yenisifre1');
  passwordFields = getAllByPlaceholderText('••••••');
  await fireEvent.changeText(passwordFields[2], 'yenisifre2');

  // Sadece açık olan modal ağaçta render edildiği için "Kaydet" burada tek eşleşme.
  const saveButtons = getAllByText('Kaydet');
  await fireEvent.press(saveButtons[saveButtons.length - 1]);

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith('Hata', 'Yeni şifreler eşleşmiyor.');
  });
  expect(patchSpy).not.toHaveBeenCalled();
});

test('profili düzenle: yeni ad ile doğru PATCH isteği atılmalı', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const patchSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

  const { getByText, getAllByText, getByTestId, getByDisplayValue } = await renderScreen({
    fetchImpl: jest.fn((url, options = {}) => {
      const method = options.method || 'GET';
      if (method === 'PATCH' && url.includes('/users/me')) return patchSpy(url, options);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }),
  });

  await fireEvent.press(getByTestId('edit-profile-button'));

  const nameInput = getByDisplayValue('Burak Sayan');
  await fireEvent.changeText(nameInput, 'Burak Sayan Test');

  // EditProfileModal ve ChangePasswordModal ikisi de her zaman ağaçta, ilki EditProfileModal'a ait.
  const saveButtons = getAllByText('Kaydet');
  await fireEvent.press(saveButtons[0]);

  await waitFor(() => {
    expect(patchSpy).toHaveBeenCalled();
  });
  const [, options] = patchSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body.full_name).toBe('Burak Sayan Test');
});
