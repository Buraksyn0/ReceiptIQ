import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import CustomInput from '../../../Components/CustomInput';
import PrimaryButton from '../../../Components/PrimaryButton';
import SocialButton from '../../../Components/SocialButton';
import styles from './SignUpStyles';

function SignUpScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isConfirmVisible, setConfirmVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSignUp = async () => {
    console.log("1. Kayıt butonu tetiklendi.");

    // 1. Temel Validasyonlar (Kapı Koruması)
    if (!fullName || !email || !password || !confirmPassword) {
      alert("Lütfen tüm alanları doldur!");
      return;
    }

    if (password !== confirmPassword) {
      alert("Şifreler eşleşmiyor! Şifreni doğru yazdığından emin ol.");
      return;
    }

    if (password.length < 6) {
      alert("Şifren en az 6 karakter olmalı!");
      return;
    }

    if (!termsAccepted) {
      alert("Devam etmek için Kullanım Koşulları ve Gizlilik Politikası'nı kabul etmen gerekiyor.");
      return;
    }

    try {
      console.log("2. Backend'e JSON paketi gönderiliyor...");
      
      // Tek merkezden URL yönetimi — Constants/Config.js
      const url = apiUrl('/auth/signup');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // DÜNKÜ GİBİ FORM DEĞİL, JSON GÖNDERİYORUZ!
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
          full_name: fullName.trim(), // Backend'de isim alanı 'full_name' ise bunu yollarız.
        }),
      });

      console.log("3. Backend'den cevap geldi! Statü:", response.status);
      const data = await response.json();

      if (response.ok) {
        console.log("BAŞARILI KAYIT:", data);
        alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
        // Başarılıysa, adamın ismini de alarak Login ekranına uçur
        navigation.navigate('SignIn', { name: fullName });
      } else {
        console.log("HATA VERİSİ:", data);
        // Backend'den gelen spesifik hatayı ekrana bas (Örn: "Bu email zaten kayıtlı")
        alert("Kayıt başarısız: " + (data.detail || JSON.stringify(data)));
      }

    } catch (error) {
      console.log("!!! BAĞLANTI HATASI !!!");
      console.error("Detay:", error.message);
      alert("Sunucuya bağlanılamadı. Backend'in açık olduğundan emin ol!");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={styles.screen}>
        {/* ❌ <StatusBar /> bileşeni buradan kaldırıldı. App.js yönetiyor. */}
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.headerContainer}>
              <View style={styles.logoIcon}>
                <Ionicons name="person-add-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subText}>Sign up to start tracking your expenses.</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <CustomInput 
                icon="person-outline" placeholder="Full Name" autoCapitalize="words"
                value={fullName} onChangeText={setFullName}
              />
              <CustomInput icon="mail-outline" placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <CustomInput
                icon="lock-closed-outline" placeholder="Password" isPassword={true}
                secureTextEntry={!isPasswordVisible} onTogglePassword={() => setPasswordVisible(!isPasswordVisible)}
                value={password} onChangeText={setPassword}
                textContentType="newPassword"
              />
              <CustomInput
                icon="shield-checkmark-outline" placeholder="Confirm Password" isPassword={true}
                secureTextEntry={!isConfirmVisible} onTogglePassword={() => setConfirmVisible(!isConfirmVisible)}
                value={confirmPassword} onChangeText={setConfirmPassword}
                textContentType="newPassword"
              />

              {/* Kullanım Koşulları onay kutusu */}
              <TouchableOpacity
                style={signUpLocalStyles.termsRow}
                onPress={() => setTermsAccepted(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[
                  signUpLocalStyles.checkbox,
                  termsAccepted && signUpLocalStyles.checkboxChecked,
                ]}>
                  {termsAccepted && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={signUpLocalStyles.termsText}>
                  {'I have read and accept the '}
                  <Text
                    style={signUpLocalStyles.termsLink}
                    onPress={() => navigation.navigate('Policy', { type: 'terms' })}
                  >
                    Terms of Service
                  </Text>
                  {' and '}
                  <Text
                    style={signUpLocalStyles.termsLink}
                    onPress={() => navigation.navigate('Policy', { type: 'privacy' })}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </TouchableOpacity>

              <PrimaryButton onPress={handleSignUp} disabled={!termsAccepted}>Sign Up</PrimaryButton>
            </View>

            {/* Footer */}
            <View style={styles.footerContainer}>
               <View style={styles.dividerContainer}>
                  <View style={styles.divider} /><Text style={styles.dividerText}>OR</Text><View style={styles.divider} />
               </View>
               <View style={styles.socialButtonsContainer}>
                  <SocialButton iconName="logo-google" text="Google" iconColor="#DB4437" />
                  <SocialButton iconName="logo-apple" text="Apple" iconColor="#000000" />
               </View>
               <View style={styles.loginContainer}>
                  <Text style={styles.subText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                    <Text style={styles.loginText}>Log In</Text>
                  </TouchableOpacity>
               </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const signUpLocalStyles = StyleSheet.create({
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 4,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen;