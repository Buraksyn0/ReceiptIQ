import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import Colors from '../Constants/Colors';
import { useTheme } from '../Context/ThemeContext';
import DashboardScreen from '../Screens/App/Dashboard';
import ScanScreen from '../Screens/App/Scan';
import ChatScreen from '../Screens/App/Chat';
import SettingsScreen from '../Screens/App/Settings';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,

        tabBarStyle: {
          backgroundColor: colors.card,
          position: 'absolute',
          borderTopWidth: 0,
          left: 20,
          right: 20,
          bottom: Platform.OS === 'ios' ? 30 : 20,
          height: Platform.OS === 'ios' ? 70 : 65,
          borderRadius: 35,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
            },
            android: {
              elevation: 10,
            },
          }),
        },

        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,

        tabBarItemStyle: {
          paddingVertical: 0,
          justifyContent: 'center',
        },

        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Scan') iconName = focused ? 'scan' : 'scan-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';

          return <Ionicons name={iconName} size={focused ? 30 : 24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default TabNavigator;