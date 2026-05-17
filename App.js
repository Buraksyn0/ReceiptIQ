import React, { useContext, useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, AppState, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

export const navigationRef = createNavigationContainerRef();

// Uygulama ön plandayken bildirimleri göster
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import ErrorBoundary from './src/Components/ErrorBoundary';
import { AuthProvider, AuthContext } from './src/Context/AuthContext';
import { ThemeProvider, useTheme } from './src/Context/ThemeContext';
import { LanguageProvider, useLanguage } from './src/Context/LanguageContext';
import { CurrencyProvider } from './src/Context/CurrencyContext';
import { BiometricProvider, useBiometric } from './src/Context/BiometricContext';
import { DateFormatProvider } from './src/Context/DateFormatContext';
import AuthStack from './src/Navigation/AuthStack';
import MainStack from './src/Navigation/MainStack';
import Colors from './src/Constants/Colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

const setDefaultFont = () => {
  const TextAny = Text;
  TextAny.defaultProps = TextAny.defaultProps || {};
  TextAny.defaultProps.style = [
    { fontFamily: 'Inter_400Regular' },
    TextAny.defaultProps.style,
  ];
};

// Kilit ekranı
function LockScreen({ isAuthenticating }) {
  const { authenticate, unlock } = useBiometric();
  const { colors } = useTheme();
  const { t } = useLanguage();

  const handleUnlock = async () => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    try {
      const success = await authenticate(t.biometricPrompt);
      if (success) unlock();
    } finally {
      isAuthenticating.current = false;
    }
  };

  // Ekran açılınca otomatik biyometrik sor
  useEffect(() => {
    handleUnlock();
  }, []);

  return (
    <View style={[lockStyles.container, { backgroundColor: colors.background }]}>
      <View style={lockStyles.iconWrap}>
        <Ionicons name="lock-closed" size={56} color={Colors.primary} />
      </View>
      <Text style={[lockStyles.title, { color: colors.textMain }]}>ReceiptIQ</Text>
      <Text style={[lockStyles.subtitle, { color: colors.textSecondary }]}>
        {t.biometricPrompt}
      </Text>
      <TouchableOpacity style={lockStyles.btn} onPress={handleUnlock}>
        <Ionicons name="finger-print-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={lockStyles.btnText}>{t.unlockApp}</Text>
      </TouchableOpacity>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 48, textAlign: 'center' },
  btn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 16,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

function AppNav() {
  const { isLoading, userToken } = useContext(AuthContext);
  const { isDarkMode, colors } = useTheme();
  const { biometricEnabled, isLocked, lock, unlock } = useBiometric();
  const appState = useRef(AppState.currentState);
  const isAuthenticating = useRef(false);

  // Bildirime tıklanınca deep link
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!navigationRef.isReady()) return;
      if (data?.type === 'weekly_summary') {
        navigationRef.navigate('WeeklySummary');
      } else if (data?.type === 'recurring') {
        navigationRef.navigate('Transactions');
      }
    });
    return () => sub.remove();
  }, []);

  // Arka plandan ön plana gelince kilitle
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appState.current;
      appState.current = nextState;

      // Sadece gerçekten arka plana gidip geri gelince kilitle.
      // inactive → active: sistem diyaloğu, Face ID ekranı vb. — KİLİTLEME
      // background → active: kullanıcı home'a basıp geri döndü — KİLİTLE
      if (
        prev === 'background' &&
        nextState === 'active' &&
        biometricEnabled &&
        userToken &&
        !isAuthenticating.current
      ) {
        lock();
      }
    });
    return () => sub.remove();
  }, [biometricEnabled, userToken]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      {userToken !== null ? <MainStack /> : <AuthStack />}
      {/* Kilit ekranı — giriş yapılmışsa ve kilitliyse üstüne yaz */}
      {isLocked && userToken && <View style={StyleSheet.absoluteFill}><LockScreen isAuthenticating={isAuthenticating} /></View>}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) setDefaultFont();
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <CurrencyProvider>
                <DateFormatProvider>
                  <BiometricProvider>
                    <AppNav />
                  </BiometricProvider>
                </DateFormatProvider>
              </CurrencyProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </View>
    </ErrorBoundary>
  );
}
