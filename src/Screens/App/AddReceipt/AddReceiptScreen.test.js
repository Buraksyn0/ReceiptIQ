import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddReceiptScreen from './AddReceiptScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currencySymbol: '₺' }),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

async function renderScreen() {
  const navigation = { goBack: jest.fn() };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <AddReceiptScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});

test('tutar alanı binlik nokta ve ondalık virgülle doğru formatlanmalı', async () => {
  const { getByPlaceholderText } = await renderScreen();

  const amountInput = getByPlaceholderText('0,00');
  await fireEvent.changeText(amountInput, '300000,50');

  expect(amountInput.props.value).toBe('300.000,50');
});

test('mağaza adı ve tutar boşken kaydet, uyarı göstermeli ve istek atmamalı', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  global.fetch = jest.fn();

  const { getByText } = await renderScreen();

  await fireEvent.press(getByText('Kaydet'));

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith('Eksik Bilgi', 'Lütfen tüm alanları doldur!');
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('geçerli bilgilerle kaydet, doğru POST body ile istek atmalı', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const postSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '1' }) }));
  global.fetch = postSpy;

  const { getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.changeText(getByPlaceholderText('Örn: Starbucks, Migros...'), 'Migros');
  await fireEvent.changeText(getByPlaceholderText('0,00'), '150,25');
  await fireEvent.press(getByText('Kaydet'));

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalled();
  });
  const [, options] = postSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body.merchant_name).toBe('Migros');
  expect(body.total_amount).toBe(150.25);
  expect(body.receipt_type).toBe('expense');
  expect(body.category).toBe('food');
});

test('"Diğer" kategorisi seçilip özel kategori girildiğinde bu değer kaydedilmeli', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const postSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '1' }) }));
  global.fetch = postSpy;

  const { getByText, getByPlaceholderText } = await renderScreen();

  await fireEvent.press(getByText('Gıda'));
  await fireEvent.press(getByText('Diğer'));
  await fireEvent.changeText(getByPlaceholderText('Kendi kategorinizi yazın...'), 'Evcil Hayvan');
  await fireEvent.changeText(getByPlaceholderText('Örn: Starbucks, Migros...'), 'Petshop');
  await fireEvent.changeText(getByPlaceholderText('0,00'), '80');
  await fireEvent.press(getByText('Kaydet'));

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalled();
  });
  const [, options] = postSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body.category).toBe('Evcil Hayvan');
});
