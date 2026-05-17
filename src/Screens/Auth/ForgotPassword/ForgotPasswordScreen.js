import React, { useState } from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import CustomInput from '../../../Components/CustomInput';
import PrimaryButton from '../../../Components/PrimaryButton';

function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: email, 2: kod + yeni şifre
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen e-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          'Kod Gönderildi',
          'E-posta adresinize 6 haneli sıfırlama kodu gönderdik. Spam klasörünüzü de kontrol edin.',
          [{ text: 'Tamam', onPress: () => setStep(2) }]
        );
      } else {
        Alert.alert('Hata', data.detail || 'Bir sorun oluştu.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword || !confirmPassword) {
      Alert.alert('Hata', 'Tüm alanları doldurun.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Başarılı', 'Şifreniz güncellendi. Giriş yapabilirsiniz.', [
          { text: 'Tamam', onPress: () => navigation.navigate('SignIn') }
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

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Geri butonu */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>

          {/* Başlık */}
          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-open-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>
              {step === 1 ? 'Şifremi Unuttum' : 'Yeni Şifre'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Kayıtlı e-posta adresinizi girin. Size sıfırlama kodu göndereceğiz.'
                : 'E-postanıza gelen kodu ve yeni şifrenizi girin.'}
            </Text>
          </View>

          {/* Form */}
          {step === 1 ? (
            <View style={styles.form}>
              <CustomInput
                icon="mail-outline"
                placeholder="E-posta adresiniz"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <PrimaryButton onPress={handleSendCode} disabled={loading}>
                {loading ? 'Gönderiliyor...' : 'Kod Gönder'}
              </PrimaryButton>
            </View>
          ) : (
            <View style={styles.form}>
              <CustomInput
                icon="keypad-outline"
                placeholder="Sıfırlama kodu"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
              <CustomInput
                icon="lock-closed-outline"
                placeholder="Yeni şifre"
                isPassword={true}
                secureTextEntry={!showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <CustomInput
                icon="lock-closed-outline"
                placeholder="Yeni şifre (tekrar)"
                isPassword={true}
                secureTextEntry={!showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <PrimaryButton onPress={handleResetPassword} disabled={loading}>
                {loading ? 'Güncelleniyor...' : 'Şifremi Sıfırla'}
              </PrimaryButton>

              <TouchableOpacity style={styles.resendBtn} onPress={() => setStep(1)}>
                <Text style={styles.resendText}>Kodu tekrar gönder</Text>
              </TouchableOpacity>
            </View>
          )}
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
});

export default ForgotPasswordScreen;
