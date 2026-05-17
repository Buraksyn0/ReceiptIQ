import React, { useState, useRef, useContext, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, SafeAreaView, TextInput, TouchableOpacity,
  ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView, Keyboard, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { s, vs, ms } from '../../../Constants/Responsive';

const QUICK_QUESTIONS = [
  'Bu hızda hedefe ulaşabilir miyim?',
  'Nasıl daha hızlı biriktirebilirim?',
  'Harcamalarımı nasıl azaltabilirim?',
  'Hedefe ulaşmam ne kadar sürer?',
];

export default function SavingsGoalChatScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([
    { id: '0', role: 'assistant', text: null },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  const sendMessage = useCallback(async (question) => {
    const text = (question || input).trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(apiUrl('/chat/savings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      const answer = res.ok ? (data.answer || 'Yanıt alınamadı.') : 'Bir hata oluştu.';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Bağlantı hatası. Tekrar dene.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, userToken]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <View style={styles.botIconContainer}>
            <Ionicons name="sparkles" size={20} color={Colors.primary} />
          </View>
          <View style={{ marginLeft: s(10) }}>
            <Text style={styles.headerTitle}>Tasarruf Danışmanı</Text>
            <Text style={{ fontSize: ms(11), color: colors.textSecondary }}>Hedefin hakkında her şeyi sorabilirsin</Text>
          </View>
        </View>

        {/* MESAJLAR */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContainer}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(msg =>
            msg.role === 'user' ? (
              <View key={msg.id} style={styles.userMessageContainer}>
                <Text style={styles.userMessageText}>{msg.text}</Text>
              </View>
            ) : (
              <View key={msg.id} style={styles.aiMessageContainer}>
                <Text style={styles.aiMessageText}>
                  {msg.text ?? 'Merhaba! 👋 Tasarruf hedefin hakkında sormak istediğin bir şey var mı?'}
                </Text>
              </View>
            )
          )}
          {loading && (
            <View style={styles.aiMessageContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
          {messages.length === 1 && !loading && (
            <View style={{ marginTop: 16, gap: 8 }}>
              {QUICK_QUESTIONS.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: colors.card, borderRadius: 14,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                  onPress={() => sendMessage(q)}
                >
                  <Text style={{ fontSize: 14, color: colors.textMain, flex: 1, marginRight: 8 }}>{q}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* INPUT */}
        <View style={[styles.inputContainer, { marginBottom: keyboardVisible ? 8 : 20 }]}>
          <TextInput
            style={styles.input}
            placeholder="Bir şey sor..."
            placeholderTextColor={colors.placeholder || colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s(16),
      paddingVertical: vs(12),
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { marginRight: s(8), padding: 4 },
    botIconContainer: {
      width: s(36), height: s(36), borderRadius: s(18),
      backgroundColor: Colors.primary + '20',
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
      fontSize: ms(16), fontWeight: 'bold', color: colors.textMain,
    },
    listContainer: {
      paddingHorizontal: s(20), paddingBottom: vs(16), paddingTop: vs(10),
    },
    userMessageContainer: {
      alignSelf: 'flex-end',
      backgroundColor: Colors.primary,
      padding: s(14), borderRadius: s(20), borderBottomRightRadius: s(4),
      marginBottom: vs(16), maxWidth: '80%',
      shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: s(8), elevation: 4,
    },
    userMessageText: { color: '#fff', fontSize: ms(15), fontWeight: '500' },
    aiMessageContainer: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      padding: s(16), borderRadius: s(20), borderTopLeftRadius: s(4),
      marginBottom: vs(16), maxWidth: '85%',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: s(4), elevation: 2,
    },
    aiMessageText: { color: colors.textMain, fontSize: ms(15), lineHeight: ms(22) },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: s(25),
      paddingHorizontal: s(15), paddingVertical: vs(10),
      marginHorizontal: s(12),
      shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1, shadowRadius: s(10), elevation: 5,
    },
    input: {
      flex: 1, fontSize: ms(15), color: colors.textMain,
      maxHeight: vs(100), marginRight: s(10),
    },
    sendButton: {
      width: s(40), height: s(40), borderRadius: s(20),
      backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    },
  });
}
