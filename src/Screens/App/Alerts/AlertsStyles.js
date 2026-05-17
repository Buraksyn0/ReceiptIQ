import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: s(24), paddingBottom: vs(100) },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: vs(24),
      marginTop: vs(10),
    },
    backButton: {
      padding: s(8),
      backgroundColor: colors.card,
      borderRadius: s(12),
      marginRight: s(16),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: s(4),
      elevation: 2,
    },
    pageTitle: {
      fontSize: ms(28),
      fontWeight: 'bold',
      color: colors.textMain,
    },

    alertCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      padding: s(16),
      borderRadius: s(16),
      marginBottom: vs(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: s(8),
      elevation: 2,
      borderLeftWidth: 4,
    },
    iconBox: {
      width: s(44),
      height: s(44),
      borderRadius: s(22),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: s(16),
    },
    content: { flex: 1 },
    alertTitle: {
      fontSize: ms(16),
      fontWeight: 'bold',
      color: colors.textMain,
      marginBottom: vs(4),
    },
    alertMessage: {
      fontSize: ms(14),
      color: colors.textSecondary,
      lineHeight: ms(20),
    },
    alertTime: {
      fontSize: ms(12),
      color: colors.placeholder || '#AAB8C2',
      marginTop: vs(8),
    },
    actionButton: {
      marginTop: vs(10),
      backgroundColor: '#FFF9C4',
      paddingVertical: vs(8),
      paddingHorizontal: s(12),
      borderRadius: s(8),
      alignSelf: 'flex-start',
    },
    actionText: {
      color: '#FBC02D',
      fontWeight: 'bold',
      fontSize: ms(12),
    },
  });
}
