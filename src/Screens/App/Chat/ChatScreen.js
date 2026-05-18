import React, { useState, useRef, useContext, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, SafeAreaView, TextInput, TouchableOpacity,
  ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import createStyles from './ChatStyles';
import { s, vs, ms } from '../../../Constants/Responsive';

/** "||SOURCES||" delimitörüyle gelen yanıtı ana metin + kaynak listesine ayır */
function parseAssistantMessage(raw) {
  if (!raw) return { mainText: raw, sources: [] };
  const idx = raw.indexOf('||SOURCES||');
  if (idx === -1) return { mainText: raw, sources: [] };
  const mainText = raw.slice(0, idx).trim();
  const sourceLines = raw.slice(idx + '||SOURCES||'.length).trim().split('\n').filter(Boolean);
  return { mainText, sources: sourceLines };
}

function ChatScreen() {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();
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
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

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
      // Geçmiş mesajları (ilk karşılama hariç, son 10)
      const history = messages
        .filter(m => m.text !== null)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.text }));

      const res = await fetch(apiUrl('/chat/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ question: text, history }),
      });
      const data = await res.json();
      const answer = res.ok ? (data.answer || 'Yanıt alınamadı.') : (data.detail || 'Bir hata oluştu.');
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Bağlantı hatası. Tekrar dene.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, userToken, messages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <View style={styles.botIconContainer}>
            <Ionicons name="sparkles" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>{t.chatHeader}</Text>
        </View>

        {/* MESAJLAR */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContainer}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(msg => {
            if (msg.role === 'user') {
              return (
                <View key={msg.id} style={styles.userMessageContainer}>
                  <Text style={styles.userMessageText}>{msg.text}</Text>
                </View>
              );
            }
            const { mainText, sources } = parseAssistantMessage(msg.text);
            return (
              <View key={msg.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: vs(16) }}>
                <View style={{
                  width: s(34), height: s(34), borderRadius: s(17),
                  backgroundColor: Colors.primary, justifyContent: 'center',
                  alignItems: 'center', marginRight: s(10), marginTop: s(2),
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.4,
                  shadowRadius: s(6),
                  elevation: 5,
                  borderWidth: 1.5,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: ms(13), letterSpacing: 0.5 }}>R</Text>
                </View>
                <View style={[styles.aiMessageContainer, { marginBottom: 0 }]}>
                <Text style={styles.aiMessageText}>{mainText ?? t.chatWelcome}</Text>
                {sources.length > 0 && (
                  <View style={styles.sourcesSection}>
                    <View style={styles.sourcesHeader}>
                      <Ionicons name="receipt-outline" size={12} color={Colors.primary} />
                      <Text style={styles.sourcesHeaderText}>İLGİLİ FİŞLER</Text>
                    </View>
                    {sources.map((src, i) => (
                      <View key={i} style={styles.sourceChip}>
                        <Ionicons name="document-text-outline" size={11} color={Colors.primary} />
                        <Text style={styles.sourceChipText}>{src}</Text>
                      </View>
                    ))}
                  </View>
                )}
                </View>
              </View>
            );
          })}
          {loading && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: vs(16) }}>
              <View style={{
                width: s(34), height: s(34), borderRadius: s(17),
                backgroundColor: Colors.primary, justifyContent: 'center',
                alignItems: 'center', marginRight: s(10), marginTop: s(2),
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.4,
                shadowRadius: s(6),
                elevation: 5,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.3)',
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: ms(13), letterSpacing: 0.5 }}>R</Text>
              </View>
              <View style={[styles.aiMessageContainer, { marginBottom: 0 }]}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            </View>
          )}
          {messages.length === 1 && !loading && (
            <View style={{ marginTop: vs(16), gap: s(8) }}>
              {[t.chatSuggestion1, t.chatSuggestion2, t.chatSuggestion3, t.chatSuggestion4].map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: colors.card, borderRadius: s(14),
                    paddingHorizontal: s(16), paddingVertical: vs(12),
                    borderWidth: 1, borderColor: colors.border,
                  }}
                  onPress={() => sendMessage(q)}
                >
                  <Text style={{ fontSize: ms(14), color: colors.textMain, flex: 1, marginRight: s(8) }}>{q}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* INPUT */}
        <View style={[styles.inputContainer, { marginBottom: keyboardVisible ? 8 : tabBarHeight + 12 }]}>
          <TextInput
            style={styles.input}
            placeholder={t.chatPlaceholder}
            placeholderTextColor={colors.placeholder}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => sendMessage()}
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

export default ChatScreen;
