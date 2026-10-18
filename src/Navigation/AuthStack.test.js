import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthStack from './AuthStack';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

// Gerçek ekranlar ağır ve native modüller içeriyor — burada sadece
// "hangi ekranla açılıyor" sorusunu test ediyoruz, o yüzden sahte ekran koyuyoruz
function mockScreen(label) {
  return () => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  };
}
jest.mock('../Screens/Auth/SignIn', () => mockScreen('SIGNIN_SCREEN'));
jest.mock('../Screens/Auth/SignUp', () => mockScreen('SIGNUP_SCREEN'));
jest.mock('../Screens/Auth/Onboarding/OnboardingScreen', () => mockScreen('ONBOARDING_SCREEN'));
jest.mock('../Screens/Auth/ForgotPassword/ForgotPasswordScreen', () => mockScreen('FORGOT_SCREEN'));
jest.mock('../Screens/Auth/VerifyEmail/VerifyEmailScreen', () => mockScreen('VERIFY_SCREEN'));
jest.mock('../Screens/App/Dashboard', () => mockScreen('DASHBOARD_SCREEN'));
jest.mock('../Screens/App/Scan', () => mockScreen('SCAN_SCREEN'));
jest.mock('../Screens/App/Settings', () => mockScreen('SETTINGS_SCREEN'));
jest.mock('../Screens/App/Chat', () => mockScreen('CHAT_SCREEN'));
jest.mock('../Screens/App/Alerts', () => mockScreen('ALERTS_SCREEN'));
jest.mock('../Screens/App/Policy/PolicyScreen', () => mockScreen('POLICY_SCREEN'));
jest.mock('./TabNavigator', () => mockScreen('TABS_SCREEN'));

async function renderStack() {
  return render(
    <NavigationContainer>
      <AuthStack />
    </NavigationContainer>
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

test('tanıtım daha önce tamamlanmamışsa onboarding ile açılmalı', async () => {
  AsyncStorage.getItem.mockResolvedValue(null);
  const { findByText, queryByText } = await renderStack();

  expect(await findByText('ONBOARDING_SCREEN')).toBeTruthy();
  expect(queryByText('SIGNIN_SCREEN')).toBeNull();
});

test('tanıtım tamamlanmışsa doğrudan giriş ekranıyla açılmalı', async () => {
  AsyncStorage.getItem.mockResolvedValue('true');
  const { findByText, queryByText } = await renderStack();

  expect(await findByText('SIGNIN_SCREEN')).toBeTruthy();
  expect(queryByText('ONBOARDING_SCREEN')).toBeNull();
  expect(AsyncStorage.getItem).toHaveBeenCalledWith('onboarding_done');
});

test('bayrak okunamazsa (hata) güvenli tarafta kalıp onboarding göstermeli', async () => {
  AsyncStorage.getItem.mockRejectedValue(new Error('disk hatası'));
  const { findByText } = await renderStack();

  expect(await findByText('ONBOARDING_SCREEN')).toBeTruthy();
});
