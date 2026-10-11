import React, { useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthContext } from '../Context/AuthContext';
import { apiUrl } from '../Constants/Config';

// Apple, kendi resmi butonunu (yazı, logo, köşe yuvarlaklığı) kullanmamızı şart koşuyor.
function AppleSignInButton() {
  const { login } = useContext(AuthContext);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Android'de ve desteklemeyen cihazlarda buton hiç gösterilmez
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, []);

  if (!isAvailable) return null;

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Apple adı sadece ilk girişte verir, token'ın içinde yoktur
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');

      const response = await fetch(apiUrl('/auth/apple'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          full_name: fullName || null,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        login(data.access_token);
      } else {
        alert('Apple ile giriş başarısız: ' + (data.detail || 'Bilinmeyen hata'));
      }
    } catch (e) {
      // Kullanıcı Apple penceresini kapattıysa hata değil, sessizce çık
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      alert('Apple ile giriş sırasında bir hata oluştu.');
    }
  };

  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        testID="apple-sign-in-button"
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={styles.button}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Ekranlardaki buton satırı yatay (row) — flex: 1 ile satırı doldurur
  container: { flex: 1, paddingHorizontal: 6 },
  // Apple'ın izin verdiği minimum yükseklik 44pt
  button: { width: '100%', height: 44 },
});

export default AppleSignInButton;
