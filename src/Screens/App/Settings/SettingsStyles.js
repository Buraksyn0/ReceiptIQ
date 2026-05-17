import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: s(24) },

    pageTitle: {
      fontSize: ms(28),
      fontWeight: 'bold',
      color: colors.textMain,
      marginBottom: vs(24),
    },

    // Profil Kartı
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: s(20),
      borderRadius: s(20),
      marginBottom: vs(30),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: s(10),
      elevation: 3,
    },
    avatar: {
      width: s(60),
      height: s(60),
      borderRadius: s(30),
      backgroundColor: Colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: s(16),
    },
    name: { fontSize: ms(18), fontWeight: 'bold', color: colors.textMain },
    email: { fontSize: ms(14), color: colors.textSecondary, marginTop: vs(4) },
    editIcon: { marginLeft: 'auto' },

    // Ayar Satırları
    sectionTitle: {
      fontSize: ms(14),
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: vs(12),
      marginTop: vs(10),
      marginLeft: s(4),
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: s(16),
      borderRadius: s(16),
      marginBottom: vs(12),
    },
    iconBox: {
      width: s(40),
      height: s(40),
      borderRadius: s(12),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: s(16),
    },
    settingText: {
      flex: 1,
      fontSize: ms(16),
      color: colors.textMain,
      fontWeight: '500',
    },

    // Çıkış Butonu
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: vs(40),
      padding: s(16),
      marginBottom: vs(100),
    },
    logoutText: {
      color: Colors.error,
      fontSize: ms(16),
      fontWeight: 'bold',
      marginLeft: s(8),
    },
  });
}
