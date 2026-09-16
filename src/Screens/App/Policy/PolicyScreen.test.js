import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PolicyScreen from './PolicyScreen';

let mockLanguage = 'tr';
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));
jest.mock('../../../Context/LanguageContext', () => ({
  useLanguage: () => ({ language: mockLanguage }),
}));

afterEach(() => {
  mockLanguage = 'tr';
});

test('gizlilik politikası (tr) doğru başlık ve KVKK bölümüyle gösterilmeli', async () => {
  const { getByText } = await render(
    <PolicyScreen navigation={{ goBack: jest.fn() }} route={{ params: { type: 'privacy' } }} />
  );

  expect(getByText('Gizlilik Politikası')).toBeTruthy();
  expect(getByText('7. KVKK Kapsamındaki Haklarınız')).toBeTruthy();
});

test('kullanım koşulları (tr) doğru başlık ve bölümlerle gösterilmeli', async () => {
  const { getByText } = await render(
    <PolicyScreen navigation={{ goBack: jest.fn() }} route={{ params: { type: 'terms' } }} />
  );

  expect(getByText('Kullanım Koşulları')).toBeTruthy();
  expect(getByText('2. Hesap Sorumluluğu')).toBeTruthy();
});

test('desteklenmeyen dilde İngilizce içeriğe düşülmeli', async () => {
  mockLanguage = 'xx';
  const { getByText } = await render(
    <PolicyScreen navigation={{ goBack: jest.fn() }} route={{ params: { type: 'privacy' } }} />
  );

  expect(getByText('Privacy Policy')).toBeTruthy();
});

test('geri butonuna basınca önceki ekrana dönülmeli', async () => {
  const navigation = { goBack: jest.fn() };
  const { getByTestId } = await render(
    <PolicyScreen navigation={navigation} route={{ params: { type: 'privacy' } }} />
  );

  await fireEvent.press(getByTestId('policy-back-button'));

  expect(navigation.goBack).toHaveBeenCalled();
});
