/**
 * ReceiptIQ — Tek noktadan API URL yönetimi
 *
 * Kullanım:
 *   import { API_BASE_URL, apiUrl } from '../Constants/Config';
 *   fetch(apiUrl('/receipts/'))
 *
 * baseURL'i değiştirmek için:
 *   1) Expo tunnel kullanıyorsan: `expo start --tunnel`. Tunnel URL'sini buraya yazma —
 *      backend'in localde 127.0.0.1:8000'da koşmaya devam etmeli, tunnel sadece RN bundle'ını taşır.
 *      Bu durumda telefon → bilgisayar erişimi için fiziksel cihazda LAN IP gerekir.
 *   2) LAN üzerinden test ediyorsan, EXPO_PUBLIC_API_URL'yi kabuğunda export et:
 *        EXPO_PUBLIC_API_URL=http://192.168.1.45:8000 npx expo start
 *   3) Hiçbiri yoksa platforma göre akıllı default seçer:
 *        - Android emulator: 10.0.2.2  (host'a bu IP üzerinden erişir)
 *        - iOS simulator    : 127.0.0.1
 *        - Diğer            : 127.0.0.1 (sadece web/bundler için)
 */
import { Platform } from 'react-native';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL;

function getDefaultBaseUrl() {
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = (ENV_URL && ENV_URL.trim()) || getDefaultBaseUrl();

export const API_PREFIX = '/api/v1';

export function apiUrl(path) {
  // path "/receipts/" gibi başlangıç slash'ıyla gelmeli
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${normalized}`;
}

export default { API_BASE_URL, API_PREFIX, apiUrl };
