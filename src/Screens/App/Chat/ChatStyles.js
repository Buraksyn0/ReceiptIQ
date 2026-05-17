import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default function createStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // --- HEADER ---
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s(20),
      paddingVertical: vs(15),
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: ms(18),
      fontWeight: 'bold',
      color: colors.textMain,
      marginLeft: s(10),
    },
    botIconContainer: {
      width: s(36),
      height: s(36),
      borderRadius: s(18),
      backgroundColor: Colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // --- MESAJ LİSTESİ ---
    listContainer: {
      paddingHorizontal: s(20),
      paddingBottom: vs(16),
      paddingTop: vs(10),
    },

    // Kullanıcı Mesajı (Sağda - Mavi)
    userMessageContainer: {
      alignSelf: 'flex-end',
      backgroundColor: Colors.primary,
      padding: s(14),
      borderRadius: s(20),
      borderBottomRightRadius: s(4),
      marginBottom: vs(16),
      maxWidth: '80%',
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: s(8),
      elevation: 4,
    },
    userMessageText: {
      color: '#FFFFFF',
      fontSize: ms(15),
      fontWeight: '500',
    },

    // AI Mesajı (Solda - Kart)
    aiMessageContainer: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      padding: s(16),
      borderRadius: s(20),
      borderTopLeftRadius: s(4),
      marginBottom: vs(16),
      maxWidth: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: s(4),
      elevation: 2,
    },
    aiMessageText: {
      color: colors.textMain,
      fontSize: ms(15),
      lineHeight: ms(22),
    },

    // Kaynak bölümü
    sourcesSection: {
      marginTop: vs(10),
      paddingTop: vs(10),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sourcesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(4),
      marginBottom: vs(8),
    },
    sourcesHeaderText: {
      fontSize: ms(11),
      fontWeight: '700',
      color: Colors.primary,
      letterSpacing: 0.5,
    },
    sourceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(6),
      backgroundColor: Colors.primary + '12',
      borderWidth: 1,
      borderColor: Colors.primary + '30',
      paddingHorizontal: s(10),
      paddingVertical: vs(5),
      borderRadius: s(8),
      marginBottom: vs(5),
      alignSelf: 'flex-start',
    },
    sourceChipText: {
      fontSize: ms(12),
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // --- INPUT ALANI (Footer) ---
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: s(25),
      paddingHorizontal: s(15),
      paddingVertical: vs(10),
      marginHorizontal: s(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1,
      shadowRadius: s(10),
      elevation: 5,
    },
    input: {
      flex: 1,
      fontSize: ms(15),
      color: colors.textMain,
      maxHeight: vs(100),
      marginRight: s(10),
    },
    sendButton: {
      width: s(40),
      height: s(40),
      borderRadius: s(20),
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
