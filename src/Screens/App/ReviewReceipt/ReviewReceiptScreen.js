import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { s, vs, ms } from '../../../Constants/Responsive';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { CATEGORIES } from '../../../Constants/Categories';
import { useCurrency } from '../../../Context/CurrencyContext';
import { useDateFormat } from '../../../Context/DateFormatContext';

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 40; // 60 sn timeout

/**
 * OCR sonucunu kullanıcıya göster, düzenleyip onaylasın.
 *
 * Akış:
 *   1. uploadId ile GET /receipts/upload/{id} polling
 *   2. status === 'done' olunca parsed_data'yı form alanlarına yükle
 *   3. Kullanıcı düzenleyip "Kaydet" → POST /receipts/upload/{id}/confirm
 *   4. Receipt oluşur → Dashboard'a dön
 */
function ReviewReceiptScreen({ navigation, route }) {
  const { uploadId } = route.params || {};
  const { userToken } = useContext(AuthContext);
  const { currencySymbol } = useCurrency();
  const { formatDate } = useDateFormat();

  const [status, setStatus] = useState('pending');
  const [errorMsg, setErrorMsg] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [provider, setProvider] = useState(null);

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [date, setDate] = useState(new Date());
  const [selectedCat, setSelectedCat] = useState(CATEGORIES[0]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [textContent, setTextContent] = useState('');

  const [saving, setSaving] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  /** Polling: backend OCR/parse bitene kadar */
  useEffect(() => {
    if (!uploadId) {
      Alert.alert('Hata', 'Upload ID yok.');
      navigation.goBack();
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(apiUrl(`/receipts/upload/${uploadId}`), {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const data = await r.json();
        if (!r.ok) {
          setStatus('failed');
          setErrorMsg(data?.detail || `HTTP ${r.status}`);
          return;
        }

        setStatus(data.status);
        setProvider(data.ocr_provider);
        setConfidence(data.ocr_confidence);

        if (data.status === 'done') {
          const parsed = data.parsed_data || {};
          if (parsed.merchant_name) setMerchantName(parsed.merchant_name);
          if (parsed.total_amount) setAmount(String(parsed.total_amount));
          if (parsed.receipt_date) {
            const d = new Date(parsed.receipt_date);
            if (!isNaN(d.getTime())) setDate(d);
          }
          if (data.text_content) setTextContent(data.text_content);
          // ML kategori tahmini — model önerdiyse otomatik seç
          if (parsed.suggested_category) {
            const suggested = CATEGORIES.find(c => c.id === parsed.suggested_category);
            if (suggested) setSelectedCat(suggested);
          }
          return; // polling biter
        }

        if (data.status === 'failed') {
          setErrorMsg(data.error_message || 'OCR başarısız');
          return;
        }

        // pending / processing → tekrar dene
        attempts += 1;
        setPollAttempts(attempts);
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setStatus('failed');
          setErrorMsg('OCR zaman aşımına uğradı. Lütfen tekrar dene.');
          return;
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      } catch (e) {
        setStatus('failed');
        setErrorMsg(`Bağlantı hatası: ${e.message}`);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [uploadId, userToken]);

  const handleSave = useCallback(async () => {
    if (!merchantName || !amount) {
      Alert.alert('Eksik bilgi', 'Mağaza adı ve tutar gerekli.');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(
        apiUrl(`/receipts/upload/${uploadId}/confirm`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            merchant_name: merchantName,
            total_amount: parseFloat(amount),
            receipt_type: type,
            receipt_date: date.toISOString(),
            category: selectedCat.id,
            text_content: textContent,
          }),
        }
      );
      let data = null;
      try {
        data = await r.json();
      } catch {
        const raw = await r.text().catch(() => `HTTP ${r.status}`);
        throw new Error(raw.slice(0, 120));
      }
      if (r.ok) {
        Alert.alert('Kaydedildi', 'Fiş başarıyla kaydedildi.', [
          {
            text: 'Tamam',
            onPress: () => navigation.navigate('MainTabs'),
          },
        ]);
      } else {
        Alert.alert('Hata', data?.detail || `HTTP ${r.status}`);
      }
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSaving(false);
    }
  }, [merchantName, amount, type, date, selectedCat, textContent, uploadId, userToken, navigation]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Tarama iptal mi?',
      'Yüklediğin görsel silinecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(apiUrl(`/receipts/upload/${uploadId}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
            } catch {}
            navigation.goBack();
          },
        },
      ],
    );
  }, [uploadId, userToken, navigation]);

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const confidenceLabel = useMemo(() => {
    if (confidence == null) return null;
    const pct = Math.round(confidence * 100);
    let color = '#FFA726';
    if (pct >= 85) color = '#2ECC71';
    else if (pct < 60) color = '#FF5A5F';
    return { pct, color };
  }, [confidence]);

  // === RENDER ===

  if (status === 'pending' || status === 'processing') {
    return (
      <SafeAreaView style={styles.fullCenter}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingTitle}>Fiş analiz ediliyor…</Text>
        <Text style={styles.loadingSub}>
          {status === 'pending' ? 'Sıraya alındı' : 'OCR çalışıyor'}
          {pollAttempts > 0 ? ` · ${pollAttempts}. deneme` : ''}
        </Text>
        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
          <Text style={styles.cancelLinkText}>İptal et</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'failed') {
    return (
      <SafeAreaView style={styles.fullCenter}>
        <Ionicons name="alert-circle" size={56} color="#FF5A5F" />
        <Text style={styles.loadingTitle}>Tarama başarısız</Text>
        <Text style={styles.loadingSub}>{errorMsg || 'Bilinmeyen hata'}</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.primaryBtnText}>Tekrar dene</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={Colors.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fişi gözden geçir</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* OCR meta */}
          <View style={styles.metaRow}>
            {provider ? (
              <View style={styles.metaChip}>
                <Ionicons name="scan-outline" size={14} color={Colors.primary} />
                <Text style={styles.metaText}>{provider}</Text>
              </View>
            ) : null}
            {confidenceLabel ? (
              <View style={[styles.metaChip, { borderColor: confidenceLabel.color }]}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={14}
                  color={confidenceLabel.color}
                />
                <Text style={[styles.metaText, { color: confidenceLabel.color }]}>
                  Güven %{confidenceLabel.pct}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Tip */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'expense' && styles.activeExpense]}
              onPress={() => setType('expense')}
            >
              <Ionicons
                name="arrow-up-circle"
                size={20}
                color={type === 'expense' ? '#fff' : '#8E8E93'}
              />
              <Text
                style={[styles.typeText, type === 'expense' && styles.activeText]}
              >
                Gider
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'income' && styles.activeIncome]}
              onPress={() => setType('income')}
            >
              <Ionicons
                name="arrow-down-circle"
                size={20}
                color={type === 'income' ? '#fff' : '#8E8E93'}
              />
              <Text
                style={[styles.typeText, type === 'income' && styles.activeText]}
              >
                Gelir
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Kategori</Text>
            <TouchableOpacity
              style={styles.catTrigger}
              onPress={() => setShowCatModal(true)}
            >
              <View style={styles.catLeft}>
                <View
                  style={[
                    styles.catIconBox,
                    { backgroundColor: selectedCat.color + '15' },
                  ]}
                >
                  <Ionicons
                    name={selectedCat.icon}
                    size={18}
                    color={selectedCat.color}
                  />
                </View>
                <Text style={styles.catLabel}>{selectedCat.label}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color="#A0A3BD" />
            </TouchableOpacity>

            <Text style={styles.label}>Mağaza / Açıklama</Text>
            <View style={styles.input}>
              <Ionicons
                name="briefcase-outline"
                size={18}
                color="#6C757D"
                style={styles.iconSpace}
              />
              <TextInput
                style={styles.inputText}
                placeholder="Migros, Starbucks..."
                placeholderTextColor="#ADB5BD"
                value={merchantName}
                onChangeText={setMerchantName}
              />
            </View>

            <Text style={styles.label}>Tutar ({currencySymbol})</Text>
            <View style={styles.input}>
              <Text style={styles.currency}>{currencySymbol}</Text>
              <TextInput
                style={[styles.inputText, { fontWeight: '700', fontSize: 20 }]}
                placeholder="0.00"
                placeholderTextColor="#ADB5BD"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <Text style={styles.label}>Tarih</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={Colors.primary}
                style={styles.iconSpace}
              />
              <Text style={styles.inputText}>
                {formatDate(date.toISOString())}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ham OCR metni */}
          {textContent ? (
            <View style={styles.rawCard}>
              <View style={styles.rawHeaderRow}>
                <Text style={styles.rawTitle}>Ham OCR çıktısı</Text>
                <Text style={styles.rawMeta}>
                  {textContent.split('\n').filter(Boolean).length} satır · {textContent.length} karakter
                </Text>
              </View>
              <ScrollView
                style={styles.rawScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <Text style={styles.rawText} selectable>
                  {textContent}
                </Text>
              </ScrollView>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Kategori modal */}
        <Modal
          visible={showCatModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCatModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowCatModal(false)}>
            <Pressable onPress={() => {}} style={styles.bottomSheet}>
              <View style={styles.dragHandle} />
              <Text style={styles.sheetTitle}>Kategori Seç</Text>
              <FlatList
                data={CATEGORIES}
                keyExtractor={(it) => it.id}
                numColumns={3}
                contentContainerStyle={{ paddingBottom: 30 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.gridItem,
                      selectedCat.id === item.id && {
                        borderColor: item.color,
                        backgroundColor: item.color + '15',
                      },
                    ]}
                    onPress={() => {
                      setSelectedCat(item);
                      setShowCatModal(false);
                    }}
                  >
                    <View
                      style={[
                        styles.gridIcon,
                        { backgroundColor: item.color + '15' },
                      ]}
                    >
                      <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    <Text style={styles.gridText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {Platform.OS === 'ios' && showDatePicker && (
          <Modal transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
              <Pressable onPress={() => {}} style={styles.datePickerModal}>
                <View style={styles.dpHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.dpBtn}>Bitti</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="inline"
                  onChange={onDateChange}
                  locale="tr-TR"
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  fullCenter: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(24),
  },
  loadingTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: vs(18),
  },
  loadingSub: {
    fontSize: ms(14),
    color: Colors.textSecondary,
    marginTop: vs(6),
  },
  cancelLink: { marginTop: vs(30) },
  cancelLinkText: {
    color: Colors.primary,
    fontSize: ms(15),
    fontWeight: '600',
  },

  primaryBtn: {
    marginTop: vs(24),
    backgroundColor: Colors.primary,
    paddingHorizontal: s(32),
    paddingVertical: vs(14),
    borderRadius: s(14),
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s(16),
  },
  headerBtn: {
    width: s(40),
    height: s(40),
    backgroundColor: '#fff',
    borderRadius: s(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: ms(18), fontWeight: '800', color: Colors.textMain },

  content: { paddingHorizontal: s(20), paddingBottom: vs(40) },

  metaRow: { flexDirection: 'row', gap: s(8), marginBottom: vs(14) },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: '#fff',
    paddingHorizontal: s(10),
    paddingVertical: vs(6),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaText: { fontSize: ms(12), fontWeight: '600', color: Colors.primary },

  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: s(18),
    padding: s(6),
    marginBottom: vs(16),
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(12),
    borderRadius: s(14),
  },
  activeExpense: { backgroundColor: '#FF5A5F' },
  activeIncome: { backgroundColor: '#2ECC71' },
  typeText: { marginLeft: s(8), color: '#4A5568', fontWeight: '600' },
  activeText: { color: '#fff', fontWeight: '700' },

  card: {
    backgroundColor: '#fff',
    borderRadius: s(22),
    padding: s(20),
    marginBottom: vs(16),
  },
  label: {
    fontSize: ms(12),
    color: '#718096',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: vs(10),
  },

  catTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: s(12),
    paddingVertical: vs(12),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: vs(18),
  },
  catLeft: { flexDirection: 'row', alignItems: 'center' },
  catIconBox: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(10),
  },
  catLabel: { fontSize: ms(15), fontWeight: '600', color: Colors.textMain },

  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF2F7',
    borderRadius: s(14),
    paddingHorizontal: s(14),
    marginBottom: vs(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputText: { flex: 1, paddingVertical: vs(14), fontSize: ms(15), color: Colors.textMain },
  iconSpace: { marginRight: s(10) },
  currency: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.primary,
    marginRight: s(6),
  },

  rawCard: {
    backgroundColor: '#fff',
    borderRadius: s(16),
    padding: s(14),
    marginBottom: vs(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rawHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(8),
  },
  rawTitle: {
    fontSize: ms(12),
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  rawMeta: {
    fontSize: ms(10),
    fontWeight: '500',
    color: Colors.placeholder,
  },
  rawScroll: {
    maxHeight: vs(200),
    backgroundColor: '#F7FAFC',
    borderRadius: s(10),
    padding: s(10),
  },
  rawText: { fontSize: ms(12), color: Colors.textMain, lineHeight: ms(17) },

  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: vs(18),
    borderRadius: s(18),
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: ms(16), fontWeight: '800' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28),
    padding: s(20),
    maxHeight: '75%',
  },
  dragHandle: {
    width: s(40),
    height: vs(5),
    backgroundColor: '#E2E8F0',
    borderRadius: s(3),
    alignSelf: 'center',
    marginBottom: vs(14),
  },
  sheetTitle: {
    fontSize: ms(17),
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: vs(14),
  },
  gridItem: {
    width: '30%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: '#F1F2F6',
    marginBottom: vs(12),
    marginRight: '3.3%',
  },
  gridIcon: {
    width: s(42),
    height: s(42),
    borderRadius: s(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(6),
  },
  gridText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#718096',
    textAlign: 'center',
  },

  datePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28),
    padding: s(16),
  },
  dpHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: vs(8),
  },
  dpBtn: { color: Colors.primary, fontWeight: '700', fontSize: ms(16) },
});

export default ReviewReceiptScreen;
