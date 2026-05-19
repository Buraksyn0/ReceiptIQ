import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default function createStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: s(24),
    },

    // --- HEADER ---
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: vs(24),
      marginTop: vs(10),
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    greeting: {
      fontSize: ms(14),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    userName: {
      fontSize: ms(22),
      fontWeight: 'bold',
      color: colors.textMain,
    },
    notificationButton: {
      padding: s(10),
      backgroundColor: colors.card,
      borderRadius: s(14),
      marginRight: s(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: s(10),
      elevation: 2,
    },
    profileButton: {
      padding: s(10),
      backgroundColor: colors.card,
      borderRadius: s(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: s(10),
      elevation: 2,
    },

    // --- BAKİYE KARTI ---
    balanceCard: {
      backgroundColor: Colors.primary,
      borderRadius: s(24),
      padding: s(24),
      marginBottom: vs(30),
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: s(20),
      elevation: 12,
      position: 'relative',
      overflow: 'hidden',
    },
    balanceLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: ms(14),
      marginBottom: vs(8),
      fontWeight: '500',
    },
    balanceAmount: {
      color: '#FFFFFF',
      fontSize: ms(34),
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    cardIcon: {
      position: 'absolute',
      top: vs(24),
      right: s(24),
      opacity: 0.8,
    },
    statsContainer: {
      flexDirection: 'row',
      marginTop: vs(24),
      paddingTop: vs(20),
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    statText: {
      color: '#FFFFFF',
      marginLeft: s(8),
      fontSize: ms(15),
      fontWeight: '600',
      flexShrink: 1,
    },

    // --- AKSİYON BUTONLARI ---
    actionRow: {
      flexDirection: 'row',
      marginBottom: vs(32),
      marginHorizontal: -s(24),
      paddingHorizontal: s(24),
    },
    actionBtn: {
      alignItems: 'center',
      marginRight: s(16),
    },
    actionIcon: {
      width: s(60),
      height: s(60),
      backgroundColor: colors.card,
      borderRadius: s(20),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: vs(8),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: s(8),
      elevation: 3,
    },
    actionLabel: {
      fontSize: ms(12),
      color: colors.textSecondary,
      fontWeight: '600',
    },

    // --- LİSTE BAŞLIĞI ---
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: vs(16),
    },
    sectionTitle: {
      fontSize: ms(18),
      fontWeight: 'bold',
      color: colors.textMain,
    },
    seeAllText: {
      color: Colors.primary,
      fontWeight: '600',
      fontSize: ms(14),
    },

    // --- İŞLEM ÖĞELERİ ---
    transactionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: s(16),
      borderRadius: s(18),
      marginBottom: vs(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: s(4),
      elevation: 1,
    },
    iconBox: {
      width: s(50),
      height: s(50),
      borderRadius: s(14),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: s(16),
    },
    transDetails: {
      flex: 1,
    },
    transTitle: {
      fontSize: ms(16),
      fontWeight: '600',
      color: colors.textMain,
      marginBottom: vs(4),
    },
    transDate: {
      fontSize: ms(13),
      color: colors.textSecondary,
    },
    transAmount: {
      fontSize: ms(16),
      fontWeight: 'bold',
    },
  });
}
