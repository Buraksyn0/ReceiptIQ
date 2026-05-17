/**
 * ReceiptIQ — Sayı & Para Formatları
 * Türkçe format: 427590.13 → 427.590,13
 */

// Para miktarı: 427590.13 → 427.590,13
export function formatTR(value, decimals = 2) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value ?? 0);
}

// Kısa format: 1500 → 1.500, 1500000 → 1,5M
export function formatShortTR(value) {
  if (value >= 1000000) return formatTR(value / 1000000, 1) + 'M';
  if (value >= 1000)    return formatTR(value / 1000, 1) + 'K';
  return formatTR(value, 0);
}

// Tam sayı (kuruş yok): 427590 → 427.590
export function formatIntTR(value) {
  return formatTR(value, 0);
}
