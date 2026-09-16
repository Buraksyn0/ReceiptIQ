import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from './OnboardingScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
}));

async function renderScreen() {
  const navigation = { replace: jest.fn() };
  const rendered = await render(<OnboardingScreen navigation={navigation} />);
  return { navigation, ...rendered };
}

beforeEach(() => {
  // Ekranda sürekli devam eden bir salınım animasyonu var (Animated.loop).
  // Gerçek zamanlayıcılarla bu, testler bittikten sonra bile arka planda
  // "tik atmaya" devam edip React'ın "act() dışında güncelleme" uyarısı
  // vermesine yol açıyor. Sahte zamanlayıcı, zamanı sadece biz ilerlettiğimizde
  // akıtır — bu sorunu kökten çözer.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

test('ilk slayt render olunca başlık ve "Geç" butonu görünmeli', async () => {
  const { getByText } = await renderScreen();

  expect(getByText('Fişlerini Saniyeler\nİçinde Tara')).toBeTruthy();
  expect(getByText('Geç')).toBeTruthy();
});

test('"Geç" butonuna basılınca onboarding tamamlandı olarak kaydedilip SignIn\'e yönlendirmeli', async () => {
  AsyncStorage.setItem.mockResolvedValue();
  const { navigation, getByText } = await renderScreen();

  await fireEvent.press(getByText('Geç'));

  await waitFor(() => {
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboarding_done', 'true');
    expect(navigation.replace).toHaveBeenCalledWith('SignIn');
  });
});
