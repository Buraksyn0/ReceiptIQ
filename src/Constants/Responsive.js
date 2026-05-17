/**
 * ReceiptIQ — Responsive Yardımcı Fonksiyonlar
 *
 * Referans cihaz: iPhone 14 (390x844)
 *
 * s(size)         → Yatay scale: padding, margin, genişlik için
 * vs(size)        → Dikey scale: yükseklik, paddingVertical için
 * ms(size, f=0.5) → Orta scale: font boyutları için (daha yumuşak)
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/** Yatay ölçekleme (padding, margin, width, borderRadius) */
export const s = (size) => Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);

/** Dikey ölçekleme (height, paddingVertical) */
export const vs = (size) => Math.round((SCREEN_HEIGHT / BASE_HEIGHT) * size);

/** Orta ölçekleme — font boyutları için idealdir */
export const ms = (size, factor = 0.5) =>
  Math.round(size + (s(size) - size) * factor);
