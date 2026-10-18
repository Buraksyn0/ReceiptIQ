import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import CustomInput from '../../../Components/CustomInput';
import PrimaryButton from '../../../Components/PrimaryButton';

// Sunucu da aynı süreyi uyguluyor (aynı adrese 60 sn içinde tekrar kod göndermez)
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailScreen({ navigation, route }) {
  const email = route.params?.email ?? '';
  // Girişte "doğrulanmamış" hatası alan kullanıcı için ekran açılır açılmaz kod yollanır
  const autoSend = route.params?.autoSend ?? false;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  const requestCode = async () => {
    try {
      const res = await fetch(apiUrl('/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    if (autoSend) {
      requestCode();
    }
    // Yalnızca ekran açılırken bir kez çalışmalı
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Hata', '6 haneli kodu girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('E-posta Doğrulandı', 'Artık giriş yapabilirsiniz.', [
          { text: 'Tamam', onPress: () => navigation.navigate('SignIn') },
        ]);
      } else {
        Alert.alert('Hata', data.detail || 'Bir sorun oluştu.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    const ok = await requestCode();
    if (ok) {
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Kod Gönderildi', 'Yeni kodu e-posta adresinize gönderdik. Spam klasörünüzü de kontrol edin.');
    } else {
      Alert.alert('Hata', 'Kod gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <TouchableOpacity
            testID="verify-back-button"
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-open-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>E-postanı Doğrula</Text>
            <Text style={styles.subtitle}>
              {email} adresine 6 haneli bir kod gönderdik. Spam klasörünü de kontrol et.
            </Text>
          </View>

          <View style={styles.form}>
            <CustomInput
              icon="keypad-outline"
              placeholder="6 haneli kod"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <PrimaryButton onPress={handleVerify} disabled={loading}>
              {loading ? 'Doğrulanıyor...' : 'Doğrula'}
            </PrimaryButton>

            <TouchableOpacity
              testID="verify-resend-button"
              style={styles.resendBtn}
              onPress={handleResend}
              disabled={secondsLeft > 0}
            >
              <Text style={[styles.resendText, secondsLeft > 0 && styles.resendDisabled]}>
                {secondsLeft > 0 ? `Kodu tekrar gönder (${secondsLeft})` : 'Kodu tekrar gönder'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FAFC' },
  container: { flex: 1, padding: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, marginBottom: 24,
  },
  headerSection: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1D1E', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  form: { gap: 12 },
  resendBtn: { alignItems: 'center', marginTop: 8 },
  resendText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  resendDisabled: { color: '#9CA3AF' },
});

export default VerifyEmailScreen;
