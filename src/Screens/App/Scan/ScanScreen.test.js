import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ScanScreen from './ScanScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));

const mockRequestPermission = jest.fn();
let mockPermission = { granted: false, canAskAgain: true };

jest.mock('expo-camera', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return {
    CameraView: ReactActual.forwardRef((props, ref) => ReactActual.createElement(RN.View, { testID: 'camera-view' })),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args) => mockLaunchImageLibraryAsync(...args),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({ uri: 'file://optimized.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

async function renderScreen() {
  return render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <ScanScreen />
    </AuthContext.Provider>
  );
}

afterEach(() => {
  delete global.fetch;
  jest.clearAllMocks();
  mockPermission = { granted: false, canAskAgain: true };
});

test('kamera izni yoksa ve tekrar istenebiliyorsa "İzin ver" butonu requestPermission çağırmalı', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  const { getByText } = await renderScreen();

  expect(getByText('Kamera erişimi gerekli')).toBeTruthy();
  await fireEvent.press(getByText('İzin ver'));

  expect(mockRequestPermission).toHaveBeenCalled();
});

test('kamera izni kalıcı reddedildiyse "Ayarları aç" gösterilmeli ve ayarları açmalı', async () => {
  mockPermission = { granted: false, canAskAgain: false };
  const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockImplementation(() => {});
  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Ayarları aç'));

  expect(openSettingsSpy).toHaveBeenCalled();
});

test('galeri izni yoksa uyarı gösterilmeli ve yükleme yapılmamalı', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  global.fetch = jest.fn();

  const { getByText } = await renderScreen();
  await fireEvent.press(getByText('Galeriden seç'));

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith('İzin gerekli', 'Galeriye erişim izni vermen gerekiyor.');
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('galeriden seçilen görsel başarıyla yüklenince ReviewReceipt ekranına geçmeli', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://secilen.jpg' }],
  });
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 202, json: () => Promise.resolve({ id: 'upload-1' }) })
  );

  const { getByTestId } = await renderScreen();
  await fireEvent.press(getByTestId('scan-gallery-button'));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled();
  });
  expect(mockNavigate).toHaveBeenCalledWith('ReviewReceipt', { uploadId: 'upload-1' });
});
