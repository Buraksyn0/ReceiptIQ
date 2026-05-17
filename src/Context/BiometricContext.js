import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BiometricContext = createContext({
  biometricEnabled: false,
  isSupported: false,
  isLocked: false,
  toggleBiometric: async () => {},
  authenticate: async () => false,
  lock: () => {},
  unlock: () => {},
});

const STORAGE_KEY = '@receiptiq_biometric_enabled';

export function BiometricProvider({ children }) {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Cihaz biyometrik destekliyor mu ve kayıtlı mı?
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = hasHardware && isEnrolled;
      setIsSupported(supported);

      // Kaydedilmiş tercihi yükle
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const enabled = saved === 'true' && supported;
      setBiometricEnabled(enabled);
    };
    init();
  }, []);

  const toggleBiometric = useCallback(async (enabled) => {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    setBiometricEnabled(enabled);
  }, []);

  const authenticate = useCallback(async (promptMessage = 'ReceiptIQ\'a giriş yap') => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'İptal',
        disableDeviceFallback: false,  // PIN fallback açık
        requireConfirmation: false,    // Face ID'de "onay" adımını atla
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => setIsLocked(true), []);
  const unlock = useCallback(() => setIsLocked(false), []);

  return (
    <BiometricContext.Provider value={{
      biometricEnabled,
      isSupported,
      isLocked,
      toggleBiometric,
      authenticate,
      lock,
      unlock,
    }}>
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  return useContext(BiometricContext);
}
