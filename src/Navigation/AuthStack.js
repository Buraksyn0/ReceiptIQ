import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../Constants/Colors';
import SignInScreen from '../Screens/Auth/SignIn';
import SignUpScreen from '../Screens/Auth/SignUp';
import OnboardingScreen from '../Screens/Auth/Onboarding/OnboardingScreen';
import DashboardScreen from '../Screens/App/Dashboard';
import ScanScreen from '../Screens/App/Scan';
import SettingsScreen from '../Screens/App/Settings';
import ChatScreen from '../Screens/App/Chat';
import TabNavigator from './TabNavigator';
import AlertsScreen from '../Screens/App/Alerts';
import PolicyScreen from '../Screens/App/Policy/PolicyScreen';
import ForgotPasswordScreen from '../Screens/Auth/ForgotPassword/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

function AuthStack() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    // TEST: onboarding'i sıfırla — test bittikten sonra bu satırı sil
    AsyncStorage.removeItem('onboarding_done').then(() => {
      setInitialRoute('Onboarding');
    });
  }, []);

  // AsyncStorage kontrolü bitmeden ekran açma
  if (!initialRoute) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
      initialRouteName={initialRoute}
    >
      {/* Onboarding */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* Auth Ekranları */}
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

      {/* App Ekranları */}
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="AppTabs" component={TabNavigator} />
      <Stack.Screen name="Alerts" component={AlertsScreen} />
      <Stack.Screen name="Policy" component={PolicyScreen} />
    </Stack.Navigator>
  );
}

export default AuthStack;
