/**
 * TabBar sabitleri ve responsive hook'ları
 *
 * Kullanım:
 *   import { useTabBarPadding, useResponsive } from '../Constants/TabBar';
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

export const TAB_HEIGHT = 62;  // pill görsel yüksekliği
export const TAB_GAP    = 10;  // pill ile ekran alt kenarı arası boşluk
export const TAB_EXTRA  = 32;  // içerik ile pill arası nefes payı

/**
 * FlatList / ScrollView contentContainerStyle paddingBottom'u için kullan.
 * Her cihazın home indicator yüksekliğini (safe area) otomatik hesaplar.
 */
export function useTabBarPadding() {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_HEIGHT + TAB_GAP + TAB_EXTRA;
}

/**
 * Tüm UI bileşenlerinde kullanılacak responsive değerler.
 * Hardcoded genişlik/yükseklik yerine bunu tercih et.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return {
    width,
    height,
    insets,
    isSmallDevice: height < 700,
    isTablet: width >= 768,
    tabBarPadding: insets.bottom + TAB_HEIGHT + TAB_GAP + TAB_EXTRA,
  };
}
