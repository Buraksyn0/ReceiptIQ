import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TagsScreen from './TagsScreen';
import { AuthContext } from '../../../Context/AuthContext';

jest.mock('../../../Context/AuthContext', () => ({
  AuthContext: require('react').createContext({}),
}));
jest.mock('../../../Context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', card: '#fff', border: '#eee', textMain: '#000', textSecondary: '#666', placeholder: '#999' },
  }),
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

async function renderScreen(fetchHandlers) {
  global.fetch = mockFetchByUrlAndMethod(fetchHandlers);
  const navigation = { goBack: jest.fn() };
  const rendered = await render(
    <AuthContext.Provider value={{ userToken: 'sahte-token' }}>
      <TagsScreen navigation={navigation} />
    </AuthContext.Provider>
  );
  return { navigation, ...rendered };
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    const destructiveButton = buttons?.find((b) => b.style === 'destructive');
    if (destructiveButton?.onPress) destructiveButton.onPress();
  });
});

afterEach(() => {
  delete global.fetch;
  Alert.alert.mockRestore();
});

test('hiç etiket yoksa boş durum mesajı gösterilmeli', async () => {
  const { getByText } = await renderScreen({ 'GET /tags/': { ok: true, json: () => Promise.resolve([]) } });

  await waitFor(() => {
    expect(getByText('Henüz etiket yok')).toBeTruthy();
  });
});

test('var olan etiketler listelenmeli', async () => {
  const { getByText } = await renderScreen({
    'GET /tags/': {
      ok: true,
      json: () => Promise.resolve([{ id: '1', name: 'İş', color: '#008080' }]),
    },
  });

  await waitFor(() => {
    expect(getByText('İş')).toBeTruthy();
  });
});

test('yeni etiket oluşturulunca listeye eklenmeli', async () => {
  const { getByText, getByPlaceholderText } = await renderScreen({
    'GET /tags/': { ok: true, json: () => Promise.resolve([]) },
    'POST /tags/': {
      ok: true,
      json: () => Promise.resolve({ id: '2', name: 'Tatil', color: '#008080' }),
    },
  });

  await waitFor(() => expect(getByText('İlk Etiketi Oluştur')).toBeTruthy());
  await fireEvent.press(getByText('İlk Etiketi Oluştur'));
  await fireEvent.changeText(getByPlaceholderText('Etiket adı (örn: İş, Tatil, Aile)'), 'Tatil');
  await fireEvent.press(getByText('Oluştur'));

  await waitFor(() => {
    expect(getByText('Tatil')).toBeTruthy();
  });
});

test('etiket silme onaylanınca DELETE isteği atılıp listeden kaldırılmalı', async () => {
  const { getByText, queryByText, getByTestId } = await renderScreen({
    'GET /tags/': {
      ok: true,
      json: () => Promise.resolve([{ id: '1', name: 'İş', color: '#008080' }]),
    },
    'DELETE /tags/1': { ok: true, status: 204, json: () => Promise.resolve({}) },
  });

  await waitFor(() => expect(getByText('İş')).toBeTruthy());

  await fireEvent.press(getByTestId('delete-tag-1'));

  await waitFor(() => {
    expect(queryByText('İş')).toBeNull();
  });
});
