import React, { useState, useContext } from 'react'; 
import { View, Text, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import CustomInput from '../../../Components/CustomInput';
import PrimaryButton from '../../../Components/PrimaryButton';
import SocialButton from '../../../Components/SocialButton';
import styles from './SignInStyles';

// BEYNİ İÇERİ AKTARIYORUZ
import { AuthContext } from '../../../Context/AuthContext'; 

function SignInScreen({ navigation, route }) {
  // SİNİR SİSTEMİNİ BAĞLIYORUZ (Beyindeki 'login' fonksiyonunu çektik)
  const { login } = useContext(AuthContext);

  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState(''); // Doğru kullanım
  const [password, setPassword] = useState('');
  
  const welcomeMessage = route.params?.name ? `, ${route.params.name}` : " Back";

  const handleLogin = async () => {
    console.log("1. Butona basıldı, giriş deneniyor...");

    if (!email || !password) {
      alert("Email ve şifre boş olamaz!");
      return;
    }

    try {
      const url = apiUrl('/auth/login');
      
      const formData = new URLSearchParams();
      formData.append('username', email.trim().toLowerCase()); 
      formData.append('password', password);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("2. BAŞARILI! Token kasaya gönderiliyor...");
        // ALTIN VURUŞ: Token'ı beynin içine (SecureStore'a) atıyoruz!
        login(data.access_token); 
      } else {
        alert("Giriş başarısız: " + (data.detail || "Hatalı email veya şifre"));
      }

    } catch (error) {
      console.log("!!! BAĞLANTI HATASI !!!", error.message);
      alert("Sunucuya bağlanılamadı.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <View style={styles.headerContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="receipt-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>ReceiptIQ</Text>
            <Text style={styles.welcomeText}>Welcome{welcomeMessage}</Text>
            <Text style={styles.subText}>Log in to manage your expenses securely.</Text>
          </View>

          <View style={styles.formContainer}>
            <CustomInput 
              icon="mail-outline"
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail} // 👈 DÜZELTİLDİ: Gereksiz (text) => setemail(text) ameleliği silindi. Direkt referans verdik.
            />
            <CustomInput
              icon="lock-closed-outline"
              placeholder="Password"
              isPassword={true}
              secureTextEntry={!isPasswordVisible}
              onTogglePassword={() => setPasswordVisible(!isPasswordVisible)}
              value={password}
              onChangeText={setPassword}
              textContentType="password"
            />
            <TouchableOpacity style={styles.forgotContainer} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <PrimaryButton onPress={handleLogin}>
              Sign In
            </PrimaryButton>
          </View>

          <View style={styles.footerContainer}>
             <View style={styles.dividerContainer}>
                <View style={styles.divider} /><Text style={styles.dividerText}>OR</Text><View style={styles.divider} />
             </View>
             <View style={styles.socialButtonsContainer}>
                <SocialButton iconName="logo-google" text="Google" iconColor="#DB4437" />
                <SocialButton iconName="logo-apple" text="Apple" iconColor="#000000" />
             </View>
             <View style={styles.signUpContainer}>
                <Text style={styles.subText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                  <Text style={styles.signUpText}>Sign Up</Text>
                </TouchableOpacity>
             </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
    </TouchableWithoutFeedback>
  );
}

export default SignInScreen;