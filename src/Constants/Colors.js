/**
 * ReceiptIQ — Renk Paleti
 *
 * Gereksinim 2.6: Vurgulu yeşil (#00A878) veya teal (#008080).
 * Ana vurgu: TEAL.
 */
const Colors = {
  // Ana marka rengi (vurgu)
  primary: '#008080',
  primaryDark: '#006666',
  primaryLight: '#33A6A6',
  primarySoft: '#E0F2F1', // Açık zemin tinti

  // İkincil aksanlar
  accent: '#00A878', // Yeşil — pozitif/income için kullanılabilir

  // Yüzeyler ve metin
  background: '#F5F7FA',
  card: '#FFFFFF',
  textMain: '#0A2540',
  textSecondary: '#7B8C9E',
  placeholder: '#AAB8C2',
  inputBackground: '#FFFFFF',

  // Durum renkleri
  error: '#E53935',
  success: '#00C853',
  warning: '#FFA726',
  warningBackground: '#FFF9C4',

  // Light mode (varsayılan)
  light: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#0A2540',
    textSecondary: '#7B8C9E',
    border: '#E2E8F0',
  },

  // Dark mode (Faz 0'da hazır iskelet, ileride context'e bağlanacak)
  dark: {
    background: '#0F1922',
    surface: '#1A2632',
    text: '#E2E8F0',
    textSecondary: '#A0AEC0',
    border: '#2D3748',
  },
};

export default Colors;
