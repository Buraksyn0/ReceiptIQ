import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FinancialScoreScreen from './FinancialScoreScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
}));

const SCORE_DATA = {
  total_score: 72,
  grade: 'B',
  grade_label: 'İyi',
  grade_color: '#2ECC71',
  factors: [
    { id: 'f1', label: 'Bütçe Uyumu', description: 'Bütçe içinde kalma oranın', score: 18, max_score: 25, color: '#2ECC71', icon: 'wallet-outline' },
  ],
  tips: ['Market harcamalarını azaltmayı dene.'],
};

async function renderScreen(fetchImpl, navigationOverrides) {
  global.fetch = fetchImpl;
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), ...navigationOverrides };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <FinancialScoreScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
});

test('skor yüklenince gauge, faktörler ve öneriler gösterilmeli', async () => {
  const { getByText } = await renderScreen(
    jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(SCORE_DATA) }))
  );

  await waitFor(() => {
    expect(getByText('72')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
  });
  expect(getByText('Bütçe Uyumu')).toBeTruthy();
  expect(getByText('18/25')).toBeTruthy();
  expect(getByText('Market harcamalarını azaltmayı dene.')).toBeTruthy();
});

test('istek başarısız olursa hata mesajı gösterilmeli ve tekrar dene çalışmalı', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(SCORE_DATA) });

  const { getByText } = await renderScreen(fetchMock);

  await waitFor(() => {
    expect(getByText('Skor yüklenemedi.')).toBeTruthy();
  });

  await fireEvent.press(getByText('Tekrar Dene'));

  await waitFor(() => {
    expect(getByText('72')).toBeTruthy();
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('asistan butonuna basınca FinancialScoreChat ekranına gidilmeli', async () => {
  const { getByText, navigation } = await renderScreen(
    jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(SCORE_DATA) }))
  );

  await waitFor(() => expect(getByText('72')).toBeTruthy());

  await fireEvent.press(getByText('Asistan'));

  expect(navigation.navigate).toHaveBeenCalledWith('FinancialScoreChat');
});
