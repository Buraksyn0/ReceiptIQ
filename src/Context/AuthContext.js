import React, { createContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiUrl } from '../Constants/Config';

// Push token'ı al ve backend'e kaydet
async function registerPushToken(userToken) {
  try {
    if (!Device.isDevice) return; // Simülatörde çalışmaz

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      'b63d0b50-a4cc-4b1b-a3b5-cb557b91e756';

    const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = pushTokenData.data;

    await fetch(apiUrl('/users/me/push-token'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ push_token: pushToken }),
    });
  } catch (e) {
    console.log('Push token hatası:', e?.message);
  }
}

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [user, setUser] = useState(null);

  // Token ile /users/me'yi çek
  const fetchUser = useCallback(async (token) => {
    try {
      const response = await fetch(apiUrl('/users/me'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        return data;
      }
      // Token bozuk veya süresi dolmuş — temizle
      if (response.status === 401) {
        await SecureStore.deleteItemAsync('userToken');
        setUserToken(null);
        setUser(null);
      }
    } catch (e) {
      console.log('AuthContext fetchUser hata:', e?.message);
    }
    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    if (userToken) {
      return fetchUser(userToken);
    }
    return null;
  }, [userToken, fetchUser]);

  // Açılışta kasayı kontrol et + kullanıcıyı çek
  const isLoggedIn = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        setUserToken(token);
        await fetchUser(token);
      }
    } catch (e) {
      console.log('AuthContext kasa okuma hata:', e?.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser]);

  useEffect(() => {
    isLoggedIn();
  }, [isLoggedIn]);

  const login = async (token) => {
    setIsLoading(true);
    try {
      await SecureStore.setItemAsync('userToken', token);
      setUserToken(token);
      await fetchUser(token);
      // Push token'ı arka planda al ve kaydet (hata olsa bile devam et)
      registerPushToken(token);
    } catch (e) {
      console.log('AuthContext login hata:', e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await SecureStore.deleteItemAsync('userToken');
    } catch (e) {
      console.log('AuthContext logout hata:', e?.message);
    } finally {
      setUserToken(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ login, logout, refreshUser, userToken, user, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
