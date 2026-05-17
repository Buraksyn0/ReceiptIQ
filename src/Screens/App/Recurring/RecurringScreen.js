import React, { useState, useContext, useCallback, useMemo } from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity, ScrollView,
  Modal, Pressable, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Switch, StyleSheet,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { s, vs, ms } from '../../../Constants/Responsive';
import { CATEGORIES } from '../../../Constants/Categories';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useCurrency } from '../../../Context/CurrencyContext';
import { formatTR } from '../../../Constants/Formatters';

const FREQUENCIES = [
  { id: 'daily',   label: 'Günlük',   icon: 'today-outline' },
  { id: 'weekly',  label: 'Haftalık', icon: 'calendar-outline' },
  { id: 'monthly', label: 'Aylık',    icon: 'repeat-outline' },
  { id: 'yearly',  label: 'Yıllık',   icon: 'refresh-circle-outline' },
];

function RecurringScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const { currencySymbol, convertAmount } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCat, setSelectedCat] = useState('subscriptions');
  const [receiptType, setReceiptType] = useState('expense');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // --- API ---
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/recurring/'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error('Recurring fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchItems(); }, []));

  const handleSave = async () => {
    if (!merchantName.trim() || !amount) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/recurring/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          merchant_name: merchantName.trim(),
          amount: parseFloat(amount),
          category: selectedCat,
          receipt_type: receiptType,
          frequency,
          next_date: nextDate.toISOString(),
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        closeModal();
        fetchItems();
      } else {
        const err = await res.json();
        Alert.alert('Hata', err.detail || 'Kayıt yapılamadı.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Sunucuya bağlanılamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      const res = await fetch(apiUrl(`/recurring/${item.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      if (res.ok) {
        setItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i)
        );
        Haptics.selectionAsync();
      }
    } catch (e) {
      console.error('Toggle error:', e);
    }
  };

  const handleDelete = (item) => {
    const catMeta = CATEGORIES.find(c => c.id === item.category) || CATEGORIES.find(c => c.id === 'other');
    Alert.alert(
      'Tekrarı Sil',
      `"${item.merchant_name}" silinecek. Emin misin?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(apiUrl(`/recurring/${item.id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok || res.status === 204) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setItems(prev => prev.filter(i => i.id !== item.id));
              }
            } catch (e) {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]
    );
  };

  const closeModal = () => {
    setModalVisible(false);
    setMerchantName('');
    setAmount('');
    setSelectedCat('subscriptions');
    setReceiptType('expense');
    setFrequency('monthly');
    setNextDate(new Date());
  };

  // Yaklaşan ödemeleri grupla
  const { activeItems, passiveItems } = useMemo(() => {
    const active = items.filter(i => i.is_active);
    const passive = items.filter(i => !i.is_active);
    return { activeItems: active, passiveItems: passive };
  }, [items]);

  const totalMonthly = useMemo(() => {
    return activeItems
      .filter(i => i.receipt_type === 'expense')
      .reduce((sum, i) => {
        const amount = parseFloat(i.amount);
        if (i.frequency === 'daily') return sum + amount * 30;
        if (i.frequency === 'weekly') return sum + amount * 4;
        if (i.frequency === 'yearly') return sum + amount / 12;
        return sum + amount; // monthly
      }, 0);
  }, [activeItems]);

  const formatNextDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const freqLabel = (freq) => FREQUENCIES.find(f => f.id === freq)?.label || freq;

  const renderItem = (item) => {
    const catMeta = CATEGORIES.find(c => c.id === item.category || c.label === item.category)
      || CATEGORIES.find(c => c.id === 'other');
    const isExpense = item.receipt_type === 'expense';

    const renderRight = () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.deleteActionText}>Sil</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable key={item.id} renderRightActions={renderRight} overshootRight={false}>
        <View style={styles.itemCard}>
          <View style={[styles.itemIconBox, { backgroundColor: catMeta.color + '18' }]}>
            <Ionicons name={catMeta.icon} size={22} color={catMeta.color} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.merchant_name}</Text>
            <View style={styles.itemMeta}>
              <View style={[styles.freqBadge, { backgroundColor: Colors.primary + '15' }]}>
                <Text style={[styles.freqBadgeText, { color: Colors.primary }]}>
                  {freqLabel(item.frequency)}
                </Text>
              </View>
              <Text style={styles.nextDateText}>
                {formatNextDate(item.next_date)}
              </Text>
            </View>
          </View>
          <View style={styles.itemRight}>
            <Text style={[styles.itemAmount, { color: isExpense ? colors.textMain : '#00C853' }]}>
              {isExpense ? '-' : '+'}{currencySymbol}{formatTR(convertAmount(parseFloat(item.amount)))}
            </Text>
            <Switch
              value={item.is_active}
              onValueChange={() => handleToggle(item)}
              trackColor={{ false: colors.border, true: Colors.primary + '60' }}
              thumbColor={item.is_active ? Colors.primary : '#CBD5E0'}
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tekrarlayan İşlemler</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ÖZET KARTI */}
          {activeItems.length > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryIcon, { backgroundColor: '#EE5253' + '20' }]}>
                  <Ionicons name="repeat-outline" size={22} color="#EE5253" />
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Aylık Tahmini Gider</Text>
                  <Text style={styles.summaryAmount}>
                    {currencySymbol}{formatTR(convertAmount(totalMonthly))}
                  </Text>
                </View>
                <View style={styles.summaryCount}>
                  <Text style={styles.summaryCountNum}>{activeItems.length}</Text>
                  <Text style={styles.summaryCountLabel}>aktif</Text>
                </View>
              </View>
            </View>
          )}

          {/* AKTİF */}
          {activeItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Aktif</Text>
              {activeItems.map(renderItem)}
            </>
          )}

          {/* PASİF */}
          {passiveItems.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: vs(20) }]}>Pasif</Text>
              {passiveItems.map(renderItem)}
            </>
          )}

          {/* BOŞ DURUM */}
          {items.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="repeat-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Tekrar Eklenmedi</Text>
              <Text style={styles.emptyText}>
                Netflix, kira, abonelik gibi düzenli ödemeleri buraya ekle, otomatik takip et.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
                <Text style={styles.emptyBtnText}>İlk Tekrarı Ekle</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* EKLE MODALI */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={closeModal}>
            <Pressable onPress={() => {}} style={styles.sheet}>
              <View style={styles.dragHandle} />

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Yeni Tekrar Ekle</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close-circle" size={28} color="#CBD5E0" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
                {/* İsim */}
                <Text style={styles.label}>İşlem Adı</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="storefront-outline" size={20} color="#A0A3BD" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Netflix, Kira, Spor Salonu..."
                    placeholderTextColor="#A0A3BD"
                    value={merchantName}
                    onChangeText={setMerchantName}
                  />
                </View>

                {/* Tutar */}
                <Text style={styles.label}>Tutar</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.currSymbol}>{currencySymbol}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#A0A3BD"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>

                {/* Tür */}
                <Text style={styles.label}>Tür</Text>
                <View style={styles.typeRow}>
                  {[{ id: 'expense', label: 'Gider', icon: 'arrow-up-circle-outline', color: '#EE5253' },
                    { id: 'income', label: 'Gelir', icon: 'arrow-down-circle-outline', color: '#00C853' }]
                    .map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.typeChip, receiptType === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                        onPress={() => setReceiptType(t.id)}
                      >
                        <Ionicons name={t.icon} size={16} color={receiptType === t.id ? '#fff' : t.color} style={{ marginRight: 6 }} />
                        <Text style={[styles.typeChipText, receiptType === t.id && { color: '#fff' }]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                </View>

                {/* Sıklık */}
                <Text style={styles.label}>Sıklık</Text>
                <View style={styles.freqRow}>
                  {FREQUENCIES.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.freqChip, frequency === f.id && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                      onPress={() => setFrequency(f.id)}
                    >
                      <Ionicons name={f.icon} size={15} color={frequency === f.id ? '#fff' : Colors.primary} style={{ marginRight: 5 }} />
                      <Text style={[styles.freqChipText, frequency === f.id && { color: '#fff' }]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Kategori */}
                <Text style={styles.label}>Kategori</Text>
                <View style={{ height: vs(60), marginBottom: vs(20) }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(10), paddingRight: s(20) }}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.catChip, selectedCat === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                        onPress={() => setSelectedCat(cat.id)}
                      >
                        <Ionicons name={cat.icon} size={16} color={selectedCat === cat.id ? '#fff' : cat.color} style={{ marginRight: 6 }} />
                        <Text style={[styles.catChipText, selectedCat === cat.id && { color: '#fff' }]}>{cat.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Sonraki Tarih */}
                <Text style={styles.label}>İlk / Sonraki Tarih</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} style={{ marginRight: 10 }} />
                  <Text style={styles.dateBtnText}>
                    {nextDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={18} color="#A0A3BD" />
                </TouchableOpacity>

                {/* Tarih Seçici Modal */}
                <Modal visible={showDatePicker} transparent animationType="fade">
                  <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Pressable
                      onPress={() => {}}
                      style={{ backgroundColor: colors.card, borderRadius: s(20), padding: s(20), width: '90%', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: ms(16), fontWeight: '700', color: colors.textMain, marginBottom: vs(12) }}>
                        Tarih Seç
                      </Text>
                      <DateTimePicker
                        value={nextDate}
                        mode="date"
                        display="spinner"
                        onChange={(_, date) => { if (date) setNextDate(date); }}
                        locale="tr-TR"
                        textColor={colors.textMain}
                        style={{ width: '100%' }}
                      />
                      <TouchableOpacity
                        style={{ backgroundColor: Colors.primary, borderRadius: s(12), paddingHorizontal: s(32), paddingVertical: vs(12), marginTop: vs(8) }}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: ms(15) }}>Tamam</Text>
                      </TouchableOpacity>
                    </Pressable>
                  </Pressable>
                </Modal>

                <TouchableOpacity
                  style={[styles.saveBtn, (!merchantName.trim() || !amount) && { opacity: 0.5 }]}
                  disabled={!merchantName.trim() || !amount || saving}
                  onPress={handleSave}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>Kaydet</Text>
                  }
                </TouchableOpacity>

                <View style={{ height: vs(30) }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(20), paddingVertical: vs(16),
  },
  backBtn: {
    backgroundColor: colors.card, padding: s(8), borderRadius: s(12),
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05,
  },
  headerTitle: { fontSize: ms(20), fontWeight: '800', color: colors.textMain },
  addBtn: {
    backgroundColor: Colors.primary, padding: s(8), borderRadius: s(12),
    elevation: 3,
  },
  content: { paddingHorizontal: s(20), paddingBottom: vs(40) },

  summaryCard: {
    backgroundColor: colors.card, borderRadius: s(20), padding: s(20),
    marginBottom: vs(24), elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: s(10),
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: s(14) },
  summaryIcon: { width: s(46), height: s(46), borderRadius: s(14), alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: ms(12), color: colors.textSecondary, fontWeight: '600' },
  summaryAmount: { fontSize: ms(22), fontWeight: '800', color: colors.textMain, marginTop: vs(2) },
  summaryCount: { marginLeft: 'auto', alignItems: 'center' },
  summaryCountNum: { fontSize: ms(26), fontWeight: '900', color: Colors.primary },
  summaryCountLabel: { fontSize: ms(11), color: colors.textSecondary, fontWeight: '600' },

  sectionTitle: { fontSize: ms(13), fontWeight: '700', color: colors.textSecondary, marginBottom: vs(12), textTransform: 'uppercase', letterSpacing: 0.5 },

  itemCard: {
    backgroundColor: colors.card, borderRadius: s(18), padding: s(16),
    flexDirection: 'row', alignItems: 'center', marginBottom: vs(12),
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04,
  },
  itemIconBox: { width: s(46), height: s(46), borderRadius: s(14), alignItems: 'center', justifyContent: 'center', marginRight: s(12) },
  itemInfo: { flex: 1 },
  itemName: { fontSize: ms(15), fontWeight: '700', color: colors.textMain },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: vs(4) },
  freqBadge: { borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: vs(3) },
  freqBadgeText: { fontSize: ms(11), fontWeight: '700' },
  nextDateText: { fontSize: ms(12), color: colors.textSecondary, fontWeight: '500' },
  itemRight: { alignItems: 'flex-end', gap: vs(6) },
  itemAmount: { fontSize: ms(15), fontWeight: '800' },

  deleteAction: {
    backgroundColor: '#FF5252', justifyContent: 'center', alignItems: 'center',
    width: s(72), borderRadius: s(18), marginBottom: vs(12), gap: vs(4),
  },
  deleteActionText: { color: '#fff', fontSize: ms(12), fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingTop: vs(60) },
  emptyIcon: {
    width: s(80), height: s(80), borderRadius: s(24), backgroundColor: Colors.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: vs(16),
  },
  emptyTitle: { fontSize: ms(18), fontWeight: '800', color: colors.textMain, marginBottom: vs(8) },
  emptyText: { fontSize: ms(14), color: colors.textSecondary, textAlign: 'center', lineHeight: ms(22), paddingHorizontal: s(20), marginBottom: vs(24) },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: s(28), paddingVertical: vs(14), borderRadius: s(14) },
  emptyBtnText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: s(28), borderTopRightRadius: s(28),
    padding: s(24), maxHeight: '92%', overflow: 'hidden',
  },
  dragHandle: {
    width: s(40), height: vs(4), backgroundColor: colors.border,
    borderRadius: s(2), alignSelf: 'center', marginBottom: vs(20),
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(20) },
  sheetTitle: { fontSize: ms(18), fontWeight: '800', color: colors.textMain },
  label: { fontSize: ms(13), fontWeight: '700', color: colors.textSecondary, marginBottom: vs(8) },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: s(14), paddingHorizontal: s(16), paddingVertical: vs(14), marginBottom: vs(20),
    borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, fontSize: ms(16), color: colors.textMain, fontWeight: '600' },
  currSymbol: { fontSize: ms(16), fontWeight: '700', color: Colors.primary, marginRight: s(8) },

  typeRow: { flexDirection: 'row', gap: s(10), marginBottom: vs(20) },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16), paddingVertical: vs(10),
    borderRadius: s(12), borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
  },
  typeChipText: { fontSize: ms(14), fontWeight: '700', color: colors.textSecondary },

  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(10), marginBottom: vs(20) },
  freqChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14), paddingVertical: vs(9),
    borderRadius: s(12), borderWidth: 1.5, borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  freqChipText: { fontSize: ms(13), fontWeight: '700', color: Colors.primary },

  catChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14), height: vs(44),
    borderRadius: s(12), borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
  },
  catChipText: { fontSize: ms(13), fontWeight: '600', color: colors.textSecondary },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: s(14), paddingHorizontal: s(16), paddingVertical: vs(14), marginBottom: vs(24),
    borderWidth: 1, borderColor: colors.border,
  },
  dateBtnText: { flex: 1, fontSize: ms(15), fontWeight: '600', color: colors.textMain },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: s(16), paddingVertical: vs(16),
    alignItems: 'center', marginTop: vs(4),
  },
  saveBtnText: { color: '#fff', fontSize: ms(16), fontWeight: '800' },
});

export default RecurringScreen;
