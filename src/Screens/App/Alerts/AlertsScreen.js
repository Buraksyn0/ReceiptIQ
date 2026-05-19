import React, { useState, useCallback, useContext, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import createStyles from './AlertsStyles';
import { s, vs, ms } from '../../../Constants/Responsive';

// Bildirim tipine göre renk ve ikon
function getTypeStyle(type) {
  switch (type) {
    case 'anomaly':         return { color: '#FFB300', icon: 'alert-circle-outline' };
    case 'budget_exceeded': return { color: '#FF5252', icon: 'warning-outline' };
    case 'success':         return { color: '#00E676', icon: 'checkmark-circle-outline' };
    case 'info':
    default:                return { color: '#29B6F6', icon: 'information-circle-outline' };
  }
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function AlertItem({ item, onRead, styles }) {
  const { color, icon } = getTypeStyle(item.notification_type);

  return (
    <TouchableOpacity
      style={[
        styles.alertCard,
        { borderLeftColor: color, opacity: item.is_read ? 0.6 : 1 },
      ]}
      onPress={() => !item.is_read && onRead(item.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Text style={styles.alertTitle}>{item.title}</Text>
          {!item.is_read && (
            <View style={{
              width: s(8), height: s(8), borderRadius: s(4),
              backgroundColor: Colors.primary,
            }} />
          )}
        </View>
        <Text style={styles.alertMessage}>{item.message}</Text>
        <Text style={styles.alertTime}>{timeAgo(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function AlertsScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/notifications/'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch (e) {
      console.error('Bildirim hatası:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  const markRead = async (id) => {
    try {
      await fetch(apiUrl(`/notifications/${id}/read`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (e) {
      console.error('Okundu hatası:', e);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(apiUrl('/notifications/read-all'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Tümünü oku hatası:', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: vs(40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>
            {t.alertsTitle}{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead} style={{ padding: s(8) }}>
              <Text style={{ color: Colors.primary, fontSize: ms(13), fontWeight: '600' }}>
                {t.markAllRead}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: s(80) }} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : notifications.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: vs(60) }}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.placeholder || '#CBD5E0'} />
            <Text style={{ color: colors.textSecondary, marginTop: vs(12), fontSize: ms(15) }}>
              {t.noNotifications}
            </Text>
          </View>
        ) : (
          notifications.map(item => (
            <AlertItem key={item.id} item={item} onRead={markRead} styles={styles} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default AlertsScreen;
