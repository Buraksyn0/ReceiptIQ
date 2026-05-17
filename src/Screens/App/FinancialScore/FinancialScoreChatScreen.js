import React, { useState, useRef, useContext, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, SafeAreaView, TextInput, TouchableOpacity,
  ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView,
  Keyboard, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { s, vs, ms } from '../../../Constants/Responsive';

const QUICK_QUESTIONS = [
  'Skorumu nasıl A yapabilirim?',
  'Hangi kategoride fazla harcıyorum?',
  'Bütçemi aşıyor muyum?',
  'Tasarruf için ne önerirsin?',
  'Anomali nedir, neden önemli?',
  'Bu ay finansal durumum nasıl?',
];

export default function FinancialScoreChatScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: '0',
      role: 'assistant',
      text: 'Merhaba! Ben senin finansal sağlık asistanınım 💚\n\nFinansal skorun, harcamaların, bütçen veya tasarruf alışkanlıkların hakkında her türlü soruyu sorabilirsin. Gerçek verilerine bakarak sana özel yanıtlar üreteceğim.',
    },
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
      const history = messages
        .filter(m => m.text !== null)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.text }));

      const res = await fetch(apiUrl('/chat/financial-score'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ question: text, history }),
      });
      const data = await res.json();
      const answer = res.ok ? (data.answer || 'Yanıt alınamadı.') : 'Bir hata oluştu.';
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: answer },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Bağlantı hatası. Lütfen tekrar dene.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [input, loading, userToken, messages]);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textMain} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatarDot}>
            <Ionicons name="analytics" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Finansal Asistan</Text>
            <Text style={styles.headerSub}>Verilerine göre yanıt veriyor</Text>
          </View>
        </View>
        <View style={{ width: s(40) }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* MESAJLAR */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={{ padding: s(16), paddingBottom: vs(12) }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={styles.assistantAvatar}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: ms(13) }}>R</Text>
                </View>
              )}
              <View style={[
                styles.bubbleContent,
                msg.role === 'user' ? styles.userContent : styles.assistantContent,
              ]}>
                <Text style={[
                  styles.messageText,
                  msg.role === 'user' ? styles.userText : styles.assistantText,
                ]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}

          {/* HIZLI SORULAR — sadece ilk mesajdan sonra göster */}
          {messages.length === 1 && !loading && (
            <View style={styles.quickList}>
              {QUICK_QUESTIONS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.quickRow}
                  onPress={() => sendMessage(q)}
                  disabled={loading}
                >
                  <Text style={styles.quickRowText}>{q}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading && (
            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <View style={styles.assistantAvatar}>
                <Ionicons name="analytics" size={14} color={Colors.primary} />
              </View>
              <View style={[styles.bubbleContent, styles.assistantContent, styles.typingBubble]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={[styles.assistantText, { marginLeft: s(8), fontSize: ms(13) }]}>
                  Analiz ediliyor…
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* GİRİŞ ALANI */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Finansal durumun hakkında sor…"
            placeholderTextColor={colors.placeholder}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={400}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(16), paddingVertical: vs(12),
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: {
    width: s(40), height: s(40), borderRadius: s(12),
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  avatarDot: {
    width: s(34), height: s(34), borderRadius: s(17),
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: ms(15), fontWeight: '700', color: colors.textMain },
  headerSub: { fontSize: ms(11), color: colors.textSecondary, marginTop: vs(1) },

  messageList: { flex: 1 },

  messageBubble: { flexDirection: 'row', marginBottom: vs(12), alignItems: 'flex-end' },
  userBubble: { justifyContent: 'flex-end' },
  assistantBubble: { justifyContent: 'flex-start', gap: s(8) },

  assistantAvatar: {
    width: s(28), height: s(28), borderRadius: s(14),
    backgroundColor: Colors.primary + '18',
    borderWidth: 1, borderColor: Colors.primary + '30',
    alignItems: 'center', justifyContent: 'center',
  },

  bubbleContent: {
    maxWidth: '78%', borderRadius: s(18), paddingHorizontal: s(14), paddingVertical: vs(10),
  },
  userContent: {
    backgroundColor: Colors.primary, borderBottomRightRadius: s(4),
  },
  assistantContent: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: s(4),
    borderWidth: 1, borderColor: colors.border,
  },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: vs(12),
  },

  messageText: { fontSize: ms(14), lineHeight: ms(20) },
  userText: { color: '#fff', fontWeight: '500' },
  assistantText: { color: colors.textMain, fontWeight: '400' },

  quickList: { marginTop: vs(12), gap: vs(8) },
  quickRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: s(14),
    paddingHorizontal: s(16), paddingVertical: vs(12),
    borderWidth: 1, borderColor: colors.border,
  },
  quickRowText: { fontSize: ms(14), color: colors.textMain, flex: 1, marginRight: s(8) },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: s(10),
    paddingHorizontal: s(16), paddingVertical: vs(12),
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: s(20), paddingHorizontal: s(16),
    paddingVertical: vs(10), paddingTop: vs(10),
    fontSize: ms(14), color: colors.textMain,
    maxHeight: vs(100), borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: s(44), height: s(44), borderRadius: s(22),
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.primary + '50' },
});
