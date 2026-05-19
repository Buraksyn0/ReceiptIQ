import React, { useState, useContext, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, StyleSheet, FlatList, Keyboard, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { s, vs, ms } from '../../../Constants/Responsive';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useCurrency } from '../../../Context/CurrencyContext';
import { formatTR } from '../../../Constants/Formatters';

export default function SavingsGoalScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const { currencySymbol, convertAmount } = useCurrency();

  const [progress, setProgress] = useState(null); // { goal, saved_amount, progress_percent }
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chat state
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatListRef = useRef(null);

  const QUICK_QUESTIONS = [
    'Bu hızda hedefe ulaşabilir miyim?',
    'Nasıl daha hızlı biriktirebilirim?',
    'Harcamalarımı nasıl azaltabilirim?',
    'Hedefe ulaşmam ne kadar sürer?',
  ];

  const sendChatMessage = async (text) => {
    const question = text || chatInput.trim();
    if (!question) return;
    setChatInput('');
    const userMsg = { id: Date.now(), role: 'user', text: question };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const res = await fetch(apiUrl('/chat/savings'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const aiMsg = { id: Date.now() + 1, role: 'ai', text: data.answer || 'Yanıt alınamadı.' };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: 'Bağlantı hatası, tekrar dene.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Form state
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');       // ham sayısal değer (örn. "20000")
  const [targetAmountDisplay, setTargetAmountDisplay] = useState(''); // görüntülenen format (örn. "20.000")
  const [deadline, setDeadline] = useState(null);
  const [tempDate, setTempDate] = useState(new Date());

  const handleAmountChange = (text) => {
    // Sadece rakam ve virgül/nokta al
    const cleaned = text.replace(/[^0-9]/g, '');
    setTargetAmount(cleaned);
    // Binlik ayraç ekle (Türkçe: nokta)
    if (cleaned === '') {
      setTargetAmountDisplay('');
    } else {
      setTargetAmountDisplay(
        Number(cleaned).toLocaleString('tr-TR', { maximumFractionDigits: 0 })
      );
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  // --- API ---
  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/goals/progress'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
      }
    } catch (e) {
      console.log('SavingsGoal fetch error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  useFocusEffect(useCallback(() => { fetchProgress(); }, [fetchProgress]));

  const openModal = () => {
    const goal = progress?.goal;
    if (goal) {
      const raw = String(Math.round(parseFloat(goal.target_amount)));
      setTitle(goal.title);
      setTargetAmount(raw);
      setTargetAmountDisplay(Number(raw).toLocaleString('tr-TR', { maximumFractionDigits: 0 }));
      setDeadline(goal.deadline ? new Date(goal.deadline) : null);
      setTempDate(goal.deadline ? new Date(goal.deadline) : new Date());
    } else {
      setTitle('');
      setTargetAmount('');
      setTargetAmountDisplay('');
      setDeadline(null);
      setTempDate(new Date());
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Hata', 'Hedef adı gerekli.');
    const amount = parseFloat(targetAmount.replace(',', '.'));
    if (!amount || amount <= 0) return Alert.alert('Hata', 'Geçerli bir tutar girin.');

    setSaving(true);
    try {
      const goal = progress?.goal;
      const method = goal ? 'PATCH' : 'POST';
      const url = goal ? apiUrl(`/goals/${goal.id}`) : apiUrl('/goals/');

      const body = {
        title: title.trim(),
        target_amount: amount,
        deadline: deadline ? deadline.toISOString() : null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalVisible(false);
        await fetchProgress();
      } else {
        Alert.alert('Hata', 'Hedef kaydedilemedi.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const goal = progress?.goal;
    if (!goal) return;
    Alert.alert(
      'Hedefi Sil',
      'Bu tasarruf hedefini silmek istediğine emin misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              await fetch(apiUrl(`/goals/${goal.id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              await fetchProgress();
            } catch (e) {}
          },
        },
      ]
    );
  };

  const handleComplete = () => {
    Alert.alert(
      'Hedefi Tamamla 🎉',
      'Bu hedefi tamamlandı olarak işaretleyip yeni bir hedef oluşturmak ister misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Tamamla',
          onPress: async () => {
            const goal = progress?.goal;
            if (!goal) return;
            try {
              await fetch(apiUrl(`/goals/${goal.id}`), {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false }),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setProgress(null);
              await fetchProgress();
            } catch (e) {}
          },
        },
      ]
    );
  };

  const goal = progress?.goal;
  const savedAmount = progress?.saved_amount ?? 0;
  const progressPercent = progress?.progress_percent ?? 0;
  const targetAmt = goal ? parseFloat(goal.target_amount) : 0;
  const remaining = Math.max(targetAmt - savedAmount, 0);
  const monthlySavings = progress?.monthly_savings ?? [];
  const avgMonthly = progress?.avg_monthly_savings ?? 0;
  const estimatedMonths = progress?.estimated_months ?? null;
  const onTrack = progress?.on_track ?? 'no_deadline';
  const requiredMonthly = progress?.required_monthly ?? null;

  const daysLeft = goal?.deadline
    ? Math.max(Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)), 0)
    : null;

  const onTrackConfig = {
    ahead:       { color: '#00C853', icon: 'rocket-outline',       label: 'Hedefinizin önündesiniz!' },
    on_track:    { color: '#00C853', icon: 'checkmark-circle-outline', label: 'Tam yolundasınız' },
    behind:      { color: '#FF5252', icon: 'warning-outline',      label: 'Hedefinizin gerisindeydiniz' },
    completed:   { color: '#00C853', icon: 'trophy-outline',       label: 'Hedefe ulaştınız! 🎉' },
    no_deadline: { color: Colors.primary, icon: 'analytics-outline', label: 'Son tarih belirlenmedi' },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tasarruf Hedefi</Text>
        <TouchableOpacity onPress={openModal} style={styles.headerEditBtn}>
          <Ionicons name={goal ? 'pencil-outline' : 'add'} size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {goal ? (
            <>
              {/* HEDEF KARTI */}
              <View style={styles.goalCard}>
                <View style={styles.goalCardTop}>
                  <View style={styles.goalIconWrap}>
                    <Ionicons name="trophy-outline" size={28} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    {daysLeft !== null ? (
                      <Text style={styles.goalDeadline}>
                        {new Date(goal.deadline).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}{daysLeft === 0 ? 'Bugün son gün!' : `${daysLeft} gün kaldı`}
                      </Text>
                    ) : (
                      <Text style={styles.goalDeadline}>Son tarih belirlenmedi</Text>
                    )}
                  </View>
                </View>

                {/* PROGRESS BAR */}
                <View style={styles.progressSection}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressSaved}>
                      {currencySymbol}{formatTR(convertAmount(savedAmount))}
                    </Text>
                    <Text style={styles.progressPercent}>%{progressPercent}</Text>
                    <Text style={styles.progressTarget}>
                      {currencySymbol}{formatTR(convertAmount(targetAmt))}
                    </Text>
                  </View>
                  <Text style={{ fontSize: ms(11), color: colors.textSecondary, marginTop: vs(6), fontStyle: 'italic' }}>
                    * Hedef oluşturulduğundan bu yana gelir − gider toplamına göre hesaplanır.
                  </Text>
                </View>
              </View>

              {/* İSTATİSTİK KARTLARI */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#00C853" />
                  <Text style={styles.statValue}>
                    {currencySymbol}{formatTR(convertAmount(savedAmount))}
                  </Text>
                  <Text style={styles.statLabel}>Biriktirilen</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="time-outline" size={22} color={Colors.primary} />
                  <Text style={styles.statValue}>
                    {currencySymbol}{formatTR(convertAmount(remaining))}
                  </Text>
                  <Text style={styles.statLabel}>Kalan</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="flag-outline" size={22} color="#FF9800" />
                  <Text style={styles.statValue}>
                    {currencySymbol}{formatTR(convertAmount(targetAmt))}
                  </Text>
                  <Text style={styles.statLabel}>Hedef</Text>
                </View>
              </View>

              {/* ROTA DURUMU */}
              <View style={[styles.trackCard, { borderColor: onTrackConfig[onTrack]?.color + '40' }]}>
                <Ionicons name={onTrackConfig[onTrack]?.icon} size={20} color={onTrackConfig[onTrack]?.color} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.trackLabel, { color: onTrackConfig[onTrack]?.color }]}>
                    {onTrackConfig[onTrack]?.label}
                  </Text>
                  {requiredMonthly !== null && onTrack !== 'completed' && (
                    <Text style={[styles.trackSub, { color: colors.textSecondary }]}>
                      Hedefe ulaşmak için aylık {currencySymbol}{formatTR(convertAmount(requiredMonthly))} biriktirmen gerekiyor
                    </Text>
                  )}
                </View>
              </View>

              {/* TAHMİNİ SÜRE */}
              <View style={[styles.estimateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.estimateRow}>
                  <View style={styles.estimateItem}>
                    <Text style={styles.estimateValue}>
                      {avgMonthly > 0 ? `${currencySymbol}${formatTR(convertAmount(avgMonthly))}` : '—'}
                    </Text>
                    <Text style={styles.estimateLabel}>Aylık ort. tasarruf</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateItem}>
                    <Text style={styles.estimateValue}>
                      {estimatedMonths === 0 ? '🎉' : estimatedMonths !== null ? `~${estimatedMonths} ay` : '—'}
                    </Text>
                    <Text style={styles.estimateLabel}>Tahmini süre</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateItem}>
                    <Text style={styles.estimateValue}>
                      {currencySymbol}{formatTR(convertAmount(remaining))}
                    </Text>
                    <Text style={styles.estimateLabel}>Kalan tutar</Text>
                  </View>
                </View>
              </View>

              {/* AYLIK TASARRUF GRAFİĞİ */}
              {monthlySavings.length > 0 && (
                <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.chartTitle, { color: colors.textMain }]}>Aylık Tasarruf</Text>
                  <MonthlySavingsChart data={monthlySavings} colors={colors} currencySymbol={currencySymbol} convertAmount={convertAmount} />
                </View>
              )}

              {/* TAMAMLA / SİL */}
              {progressPercent >= 100 && (
                <TouchableOpacity style={styles.completeBtn} onPress={handleComplete}>
                  <Ionicons name="trophy" size={20} color="#fff" />
                  <Text style={styles.completeBtnText}>Hedefi Tamamla 🎉</Text>
                </TouchableOpacity>
              )}

              {/* SİL — danger zone */}
              <View style={styles.dangerZone}>
                <View style={styles.dangerDivider} />
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color="#FF5252" />
                  <Text style={styles.deleteBtnText}>Hedefi Sil</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* HEDEF YOK */
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="trophy-outline" size={56} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Henüz hedef yok</Text>
              <Text style={styles.emptySubtitle}>
                Tasarruf hedefi belirle ve ne kadar ilerlediğini takip et.
              </Text>
              <TouchableOpacity style={styles.createBtn} onPress={openModal}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createBtnText}>Hedef Oluştur</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB BUTONLARI */}
      <View style={styles.fabGroup}>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('SavingsGoalChat')}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={Keyboard.dismiss}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
              <Text style={[styles.sheetTitle, { color: colors.textMain }]}>
                {goal ? 'Hedefi Düzenle' : 'Yeni Hedef'}
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Hedef Adı</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.textMain, borderColor: colors.border }]}
                placeholder="Örn: Tatil Fonu, Araba, Acil Durum"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Hedef Tutar</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.textMain, borderColor: colors.border }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={targetAmountDisplay}
                onChangeText={handleAmountChange}
                keyboardType="number-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Son Tarih (isteğe bağlı)</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => { setTempDate(deadline || new Date()); setShowDatePicker(v => !v); }}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text style={{ marginLeft: 8, color: deadline ? colors.textMain : colors.textSecondary }}>
                  {deadline ? deadline.toLocaleDateString('tr-TR') : 'Tarih seç'}
                </Text>
                {deadline && (
                  <TouchableOpacity onPress={() => { setDeadline(null); setShowDatePicker(false); }} style={{ marginLeft: 'auto' }}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {showDatePicker && (
                <View style={{ borderRadius: 12, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: colors.border }}>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_, date) => { if (date) setTempDate(date); }}
                    locale="tr-TR"
                    themeVariant="light"
                    style={{ backgroundColor: '#FFFFFF' }}
                  />
                  <TouchableOpacity
                    style={[styles.dateOkBtn, { margin: 8, marginTop: 0 }]}
                    onPress={() => { setDeadline(tempDate); setShowDatePicker(false); }}
                  >
                    <Text style={styles.dateOkText}>Tamam</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Kaydet</Text>
                  }
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>


    </SafeAreaView>

    {/* CHAT OVERLAY — Modal değil, normal absolute View (Modal içinde KAV iOS'ta çalışmaz) */}
    {chatVisible && (
      <View style={StyleSheet.absoluteFill}>
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: '#00000060' }]}
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); setChatVisible(false); }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
        <View style={[styles.chatSheet, { backgroundColor: colors.card }]}>
          {/* Chat header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              <View style={styles.chatAiAvatar}>
                <Ionicons name="sparkles" size={18} color="#fff" />
              </View>
              <View>
                <Text style={[styles.chatHeaderTitle, { color: colors.textMain }]}>Tasarruf Danışmanı</Text>
                <Text style={{ fontSize: ms(11), color: colors.textSecondary }}>Hedefin hakkında her şeyi sorabilirsin</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setChatVisible(false); }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mesajlar */}
          <FlatList
            ref={chatListRef}
            data={chatMessages}
            keyExtractor={item => String(item.id)}
            style={{ flex: 1, paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={{ color: colors.textSecondary, fontSize: ms(13), textAlign: 'center', lineHeight: ms(20) }}>
                  Merhaba! 👋{'\n'}Tasarruf hedefin hakkında sormak istediğin bir şey var mı?
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[
                styles.chatBubble,
                item.role === 'user'
                  ? [styles.chatBubbleUser, { backgroundColor: Colors.primary }]
                  : [styles.chatBubbleAi, { backgroundColor: colors.background }]
              ]}>
                <Text style={[
                  styles.chatBubbleText,
                  { color: item.role === 'user' ? '#fff' : colors.textMain }
                ]}>
                  {item.text}
                </Text>
              </View>
            )}
          />

          {/* Yükleniyor */}
          {chatLoading && (
            <View style={[styles.chatBubble, styles.chatBubbleAi, { backgroundColor: colors.background, marginHorizontal: 16, marginBottom: 8 }]}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}

          {/* Hızlı sorular */}
          {chatMessages.length === 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {QUICK_QUESTIONS.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.quickChip, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '30' }]}
                  onPress={() => sendChatMessage(q)}
                >
                  <Text style={{ fontSize: ms(12), color: Colors.primary, fontWeight: '600' }}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Input */}
          <View style={[styles.chatInputRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.chatInput, { backgroundColor: colors.background, color: colors.textMain }]}
              placeholder="Bir şey sor..."
              placeholderTextColor={colors.textSecondary}
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.chatSendBtn, { opacity: chatInput.trim() ? 1 : 0.4 }]}
              onPress={() => sendChatMessage()}
              disabled={!chatInput.trim() || chatLoading}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    )}

    </View>
  );
}

function MonthlySavingsChart({ data, colors, currencySymbol, convertAmount }) {
  const maxVal = Math.max(...data.map(d => Math.abs(d.net)), 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(8), height: vs(100), marginTop: vs(12) }}>
      {data.map((item, i) => {
        const isPositive = item.net >= 0;
        const height = Math.max((Math.abs(item.net) / maxVal) * vs(80), vs(4));
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: vs(6) }}>
            <Text style={{ fontSize: ms(9), color: colors.textSecondary, fontWeight: '600' }}>
              {item.net !== 0 ? `${item.net > 0 ? '+' : ''}${Math.round(item.net / 1000)}K` : ''}
            </Text>
            <View style={{
              width: '100%', height, borderRadius: s(6),
              backgroundColor: isPositive ? Colors.primary : '#FF5252',
              opacity: i === data.length - 1 ? 1 : 0.6,
            }} />
            <Text style={{ fontSize: ms(10), color: colors.textSecondary }}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: s(20), paddingVertical: vs(14),
    },
    backBtn: { width: s(40), height: s(40), justifyContent: 'center' },
    headerEditBtn: {
      width: s(40), height: s(40), borderRadius: s(12),
      backgroundColor: Colors.primary + '15',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: ms(18), fontWeight: '700', color: colors.textMain },

    content: { paddingHorizontal: s(20), paddingBottom: vs(140) },

    // Hedef kartı
    goalCard: {
      backgroundColor: colors.card,
      borderRadius: s(20), padding: s(20), marginBottom: vs(16),
      borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: s(10), elevation: 3,
    },
    goalCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(20) },
    goalIconWrap: {
      width: s(48), height: s(48), borderRadius: s(14),
      backgroundColor: Colors.primary + '15',
      alignItems: 'center', justifyContent: 'center',
    },
    goalTitle: { fontSize: ms(17), fontWeight: '700', color: colors.textMain },
    goalDeadline: { fontSize: ms(12), color: colors.textSecondary, marginTop: vs(2) },
    editBtn: { padding: s(8) },

    progressSection: { gap: vs(8) },
    progressBar: {
      height: vs(10), backgroundColor: colors.border,
      borderRadius: s(5), overflow: 'hidden',
    },
    progressFill: {
      height: '100%', backgroundColor: Colors.primary, borderRadius: s(5),
    },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressSaved: { fontSize: ms(13), fontWeight: '600', color: Colors.primary },
    progressPercent: { fontSize: ms(13), fontWeight: '700', color: colors.textMain },
    progressTarget: { fontSize: ms(13), color: colors.textSecondary },

    // İstatistik kartları
    statsRow: { flexDirection: 'row', gap: s(10), marginBottom: vs(16) },
    statCard: {
      flex: 1, borderRadius: s(14), padding: s(14),
      alignItems: 'center', gap: vs(6),
      borderWidth: 1, borderColor: colors.border,
    },
    statValue: { fontSize: ms(14), fontWeight: '700', color: colors.textMain, textAlign: 'center' },
    statLabel: { fontSize: ms(11), color: colors.textSecondary },

    // Rota kartı
    trackCard: {
      flexDirection: 'row', alignItems: 'flex-start',
      borderRadius: s(14), padding: s(14), marginBottom: vs(12),
      borderWidth: 1, backgroundColor: colors.card,
    },
    trackLabel: { fontSize: ms(14), fontWeight: '700', marginBottom: vs(2) },
    trackSub: { fontSize: ms(12), lineHeight: ms(18) },

    // Tahmin kartı
    estimateCard: {
      borderRadius: s(16), padding: s(16), marginBottom: vs(12),
      borderWidth: 1,
    },
    estimateRow: { flexDirection: 'row', alignItems: 'center' },
    estimateItem: { flex: 1, alignItems: 'center' },
    estimateValue: { fontSize: ms(15), fontWeight: '700', color: colors.textMain, textAlign: 'center' },
    estimateLabel: { fontSize: ms(11), color: colors.textSecondary, marginTop: vs(4), textAlign: 'center' },
    estimateDivider: { width: 1, height: vs(36), backgroundColor: colors.border },

    // Grafik kartı
    chartCard: {
      borderRadius: s(16), padding: s(16), marginBottom: vs(16),
      borderWidth: 1,
    },
    chartTitle: { fontSize: ms(15), fontWeight: '700', marginBottom: vs(4) },

    // Butonlar
    completeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#00C853', borderRadius: s(14), padding: s(16),
      gap: s(8), marginBottom: vs(12),
    },
    completeBtnText: { color: '#fff', fontWeight: '700', fontSize: ms(16) },
    dangerZone: { marginTop: vs(8) },
    dangerDivider: { height: 1, backgroundColor: colors.border, marginBottom: vs(16) },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: s(6), paddingVertical: vs(8),
    },
    deleteBtnText: { color: '#FF5252', fontWeight: '600', fontSize: ms(15) },

    fab: {
      width: s(56), height: s(56), borderRadius: s(28),
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: s(10), elevation: 6,
    },

    // Boş durum
    emptyState: { alignItems: 'center', paddingTop: vs(60) },
    emptyIcon: {
      width: s(100), height: s(100), borderRadius: s(28),
      backgroundColor: Colors.primary + '15',
      alignItems: 'center', justifyContent: 'center', marginBottom: vs(24),
    },
    emptyTitle: { fontSize: ms(22), fontWeight: '700', color: colors.textMain, marginBottom: vs(10) },
    emptySubtitle: {
      fontSize: ms(15), color: colors.textSecondary, textAlign: 'center',
      lineHeight: ms(22), marginBottom: vs(32), paddingHorizontal: s(20),
    },
    createBtn: {
      flexDirection: 'row', alignItems: 'center', gap: s(8),
      backgroundColor: Colors.primary, borderRadius: s(16),
      paddingHorizontal: s(28), paddingVertical: vs(16),
    },
    createBtnText: { color: '#fff', fontWeight: '700', fontSize: ms(16) },

    // Modal
    overlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: s(24), borderTopRightRadius: s(24),
      padding: s(24), paddingBottom: vs(40), overflow: 'hidden',
    },
    sheetTitle: { fontSize: ms(20), fontWeight: '700', marginBottom: vs(20) },
    inputLabel: { fontSize: ms(13), fontWeight: '600', marginBottom: vs(6), marginTop: vs(12) },
    input: {
      borderRadius: s(12), borderWidth: 1,
      paddingHorizontal: s(14), paddingVertical: vs(13),
      fontSize: ms(15),
    },
    dateInput: { flexDirection: 'row', alignItems: 'center' },
    modalBtns: { flexDirection: 'row', gap: s(12), marginTop: vs(24) },
    cancelBtn: {
      flex: 1, borderRadius: s(14), padding: s(16),
      alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    saveBtn: {
      flex: 2, borderRadius: s(14), padding: s(16),
      alignItems: 'center', backgroundColor: Colors.primary,
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: ms(16) },

    // FAB grubu
    fabGroup: {
      position: 'absolute', bottom: vs(32), right: s(24),
      flexDirection: 'column', alignItems: 'center', gap: vs(12),
    },
    fabSecondary: {
      width: s(48), height: s(48), borderRadius: s(24),
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1,
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: s(6), elevation: 3,
    },

    // Chat overlay
    chatOverlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
    chatSheet: {
      maxHeight: '85%',
      borderTopLeftRadius: s(24), borderTopRightRadius: s(24),
      overflow: 'hidden',
    },
    chatHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: s(16), borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
    chatAiAvatar: {
      width: s(36), height: s(36), borderRadius: s(18),
      backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    chatHeaderTitle: { fontSize: ms(15), fontWeight: '700' },
    chatBubble: { maxWidth: '80%', borderRadius: s(16), padding: s(12) },
    chatBubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: s(4) },
    chatBubbleAi: { alignSelf: 'flex-start', borderBottomLeftRadius: s(4) },
    chatBubbleText: { fontSize: ms(14), lineHeight: ms(20) },
    quickChip: {
      borderRadius: s(20), paddingHorizontal: s(12), paddingVertical: vs(7),
      borderWidth: 1,
    },
    chatInputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: s(10),
      padding: s(12), borderTopWidth: 1,
    },
    chatInput: {
      flex: 1, borderRadius: s(20), paddingHorizontal: s(16), paddingVertical: vs(10),
      fontSize: ms(14), maxHeight: vs(100),
    },
    chatSendBtn: {
      width: s(40), height: s(40), borderRadius: s(20),
      backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    },

    // Date picker
    dateOverlay: { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
    dateSheet: { borderTopLeftRadius: s(24), borderTopRightRadius: s(24), padding: s(20), paddingBottom: vs(40) },
    dateOkBtn: {
      backgroundColor: Colors.primary, borderRadius: s(14),
      padding: s(14), alignItems: 'center', marginTop: vs(8),
    },
    dateOkText: { color: '#fff', fontWeight: '700', fontSize: ms(16) },
  });
}
