import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ReviewReceiptScreen from './ReviewReceiptScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/CurrencyContext', () => ({
  useCurrency: () => ({ currencySymbol: '₺' }),
}));
jest.mock('../../../Context/DateFormatContext', () => ({
  useDateFormat: () => ({ formatDate: (d) => d }),
}));

function mockFetchByUrlAndMethod(handlers) {
  return jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    for (const [key, response] of Object.entries(handlers)) {
      const [keyMethod, keyUrl] = key.split(' ');
      if (method === keyMethod && url.includes(keyUrl)) return Promise.resolve(response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

async function renderScreen({ route, fetchHandlers, navigation: navOverrides }) {
  global.fetch = mockFetchByUrlAndMethod(fetchHandlers);
  const navigation = { goBack: jest.fn(), dispatch: jest.fn(), ...navOverrides };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <ReviewReceiptScreen navigation={navigation} route={route} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});

test('uploadId yoksa hata gösterip önceki ekrana dönmeli', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { navigation } = await renderScreen({ route: { params: {} }, fetchHandlers: {} });

  expect(alertSpy).toHaveBeenCalledWith('Hata', 'Upload ID yok.');
  expect(navigation.goBack).toHaveBeenCalled();
});

test('OCR tamamlanınca form alanları ve önerilen kategori otomatik doldurulmalı', async () => {
  const { getByPlaceholderText, getByText } = await renderScreen({
    route: { params: { uploadId: 'up-1' } },
    fetchHandlers: {
      'GET /receipts/upload/up-1': {
        ok: true,
        json: () => Promise.resolve({
          status: 'done',
          ocr_provider: 'google-vision',
          ocr_confidence: 0.92,
          parsed_data: {
            merchant_name: 'Migros',
            total_amount: 125.5,
            receipt_date: '2026-09-10T00:00:00.000Z',
            suggested_category: 'market',
          },
          text_content: 'MIGROS\nTOPLAM 125.50',
        }),
      },
    },
  });

  await waitFor(() => {
    expect(getByPlaceholderText('Migros, Starbucks...').props.value).toBe('Migros');
  });
  expect(getByPlaceholderText('0.00').props.value).toBe('125.5');
  expect(getByText('Market')).toBeTruthy();
});

test('tarama başarısız olursa hata ekranı gösterilmeli', async () => {
  const { getByText } = await renderScreen({
    route: { params: { uploadId: 'up-2' } },
    fetchHandlers: {
      'GET /receipts/upload/up-2': {
        ok: true,
        json: () => Promise.resolve({ status: 'failed', error_message: 'Görsel okunamadı' }),
      },
    },
  });

  await waitFor(() => {
    expect(getByText('Tarama başarısız')).toBeTruthy();
    expect(getByText('Görsel okunamadı')).toBeTruthy();
  });
});

test('kaydet, doğru onay isteğini doğru body ile atmalı', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    buttons?.[0]?.onPress?.();
  });
  const postSpy = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'r-1' }) }));

  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET' && url.includes('/receipts/upload/up-3')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'done',
          parsed_data: { merchant_name: 'Starbucks', total_amount: 80, receipt_date: '2026-09-10T00:00:00.000Z' },
        }),
      });
    }
    if (method === 'POST' && url.includes('/receipts/upload/up-3/confirm')) {
      return postSpy(url, options);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });

  const navigation = { goBack: jest.fn(), dispatch: jest.fn() };
  const { getByText, getByPlaceholderText } = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <ReviewReceiptScreen navigation={navigation} route={{ params: { uploadId: 'up-3' } }} />
    </AuthContext.Provider>
  );

  await waitFor(() => {
    expect(getByPlaceholderText('Migros, Starbucks...').props.value).toBe('Starbucks');
  });

  await fireEvent.press(getByText('Kaydet'));

  await waitFor(() => {
    expect(postSpy).toHaveBeenCalled();
  });
  const [, options] = postSpy.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(body.merchant_name).toBe('Starbucks');
  expect(body.total_amount).toBe(80);
  expect(body.receipt_type).toBe('expense');
  expect(navigation.dispatch).toHaveBeenCalled();
});
