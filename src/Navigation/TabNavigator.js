import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../Constants/Colors';
import { useTheme } from '../Context/ThemeContext';
import { TAB_HEIGHT, TAB_GAP } from '../Constants/TabBar';
import DashboardScreen from '../Screens/App/Dashboard';
import ScanScreen from '../Screens/App/Scan';
import ChatScreen from '../Screens/App/Chat';
import SettingsScreen from '../Screens/App/Settings';

const Tab = createBottomTabNavigator();

const ICONS = {
  Home:     { focused: 'home',                 blur: 'home-outline' },
  Scan:     { focused: 'scan',                 blur: 'scan-outline' },
  Chat:     { focused: 'chatbubble-ellipses',  blur: 'chatbubble-ellipses-outline' },
  Settings: { focused: 'settings',             blur: 'settings-outline' },
};

function CustomTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (state.routes[state.index]?.name === 'Scan') return null;

  const tabBottom = insets.bottom + TAB_GAP;
  const pillBg = colors.card;

  return (
    <>
      {/* Tab bar pill */}
      <View style={[
        styles.container,
        {
          backgroundColor: pillBg,
          bottom: tabBottom,
          height: TAB_HEIGHT,
        },
        Platform.OS === 'ios' ? styles.shadowIos : styles.shadowAndroid,
      ]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = isFocused
            ? ICONS[route.name]?.focused
            : ICONS[route.name]?.blur;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <Ionicons
                name={iconName}
                size={isFocused ? 30 : 24}
                color={isFocused ? Colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowIos: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  shadowAndroid: {
    elevation: 10,
  },
});

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default TabNavigator;
