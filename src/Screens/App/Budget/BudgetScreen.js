import React, { useState, useContext, useCallback } from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity, ScrollView,
  Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { CATEGORIES } from '../../../Constants/Categories';
import { AuthContext } from '../../../Context/AuthContext';
import { styles } from './BudgetScreenStyle';
import { useCurrency } from '../../../Context/CurrencyContext';
import { formatTR } from '../../../Constants/Formatters';
import * as Haptics from 'expo-haptics';
import { s, vs, ms } from '../../../Constants/Responsive';

function BudgetScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { currencySymbol, convertAmount } = useCurrency();
  
  // STATE YÖNETİMİ
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedCat, setSelectedCat] = useState('');
  const [amount, setAmount] = useState('');         // ham değer (parseFloat için)
  const [amountDisplay, setAmountDisplay] = useState(''); // binlik noktalı gösterim
  const [customCategory, setCustomCategory] = useState('');

  const handleAmountChange = (text) => {
    let cleaned = text.replace(/[^0-9,]/g, '');
    const parts = cleaned.split(',');
    if (parts.length > 2) cleaned = parts[0] + ',' + parts.slice(1).join('');
    const rawValue = cleaned.replace(',', '.');
    setAmount(rawValue);
    const [intPart, decPart] = cleaned.split(',');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setAmountDisplay(decPart !== undefined ? formatted + ',' + decPart : formatted);
  };

  // 1. BACKEND'DEN BÜTÇELERİ ÇEK (GET)
  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/budgets/'), {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const data = await response.json();
      setBudgets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Bütçe çekme hatası:", error);
      Alert.alert("Hata", "Bütçe verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchBudgets(); }, []));

  // 2. YENİ BÜTÇE KAYDET (POST)
  const handleSaveBudget = async () => {
    if (!selectedCat || !amount) return;

    try {
      const response = await fetch(apiUrl('/budgets/'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}` 
        },
        body: JSON.stringify({
          category: selectedCat === 'other' ? customCategory : selectedCat,
          limit_amount: parseFloat(amount),
          period: 'monthly'
        })
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Başarılı", "Bütçe limitiniz kaydedildi.");
        closeModal();
        fetchBudgets();
      } else {
        const errorData = await response.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Hata", errorData.detail || "Kayıt yapılamadı.");
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Hata", "Sunucuya bağlanılamadı.");
    }
  };

  // 3. BÜTÇE SİL (DELETE)
  const handleDeleteBudget = (budget) => {
    const catMeta = CATEGORIES.find(c => c.id === budget.category || c.label === budget.category);
    const catLabel = catMeta ? catMeta.label : budget.category;
    Alert.alert(
      'Bütçeyi Sil',
      `"${catLabel}" bütçe limiti silinecek. Emin misin?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(apiUrl(`/budgets/${budget.id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok || res.status === 204) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setBudgets(prev => prev.filter(b => b.id !== budget.id));
              }
            } catch (e) {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]
    );
  };

  // 4. TÜM BÜTÇELERİ SİL
  const handleDeleteAllBudgets = () => {
    Alert.alert(
      'Tüm Bütçeleri Sil',
      'Tüm bütçe limitlerin kalıcı olarak silinecek. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tümünü Sil', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(apiUrl('/budgets/'), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok || res.status === 204) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setBudgets([]);
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
    setIsModalVisible(false);
    setSelectedCat('');
    setAmount('');
    setAmountDisplay('');
    setCustomCategory('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1D1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bütçe Planı</Text>
        <View style={{ flexDirection: 'row', gap: s(8) }}>
          {budgets.length > 0 && (
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: '#FFF5F5' }]}
              onPress={handleDeleteAllBudgets}
            >
              <Ionicons name="trash-outline" size={22} color="#FF5252" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalVisible(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* ANA ÖZET KARTI */}
        {budgets.length > 0 && (() => {
          const totalLimit = budgets.reduce((sum, b) => sum + parseFloat(b.limit_amount || 0), 0);
          const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spent_amount || 0), 0);
          const totalRemaining = totalLimit - totalSpent;
          const percentage = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100).toFixed(0) : 0;
          const barColor = percentage >= 90 ? '#FF5252' : percentage >= 70 ? '#FF9800' : Colors.primary;

          return (
            <View style={styles.summaryCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.summaryTitle}>Aylık Kalan Bütçe</Text>
                <Ionicons name="wallet-outline" size={20} color="#4A5568" />
              </View>
              <Text style={styles.summaryAmount}>
                {currencySymbol}{formatTR(convertAmount(totalRemaining))}
              </Text>
              <Text style={styles.summaryDesc}>Toplam {currencySymbol}{formatTR(convertAmount(totalLimit))} bütçeden</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={styles.progressText}>%{percentage} Harcandı</Text>
            </View>
          );
        })()}

        <Text style={styles.sectionTitle}>Kategori Limitleri</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : budgets.length > 0 ? (
          // 👇 ZEKİ BÜTÇE LİSTESİ BURADA BAŞLIYOR
          budgets.map((budget) => {
            const catMeta = CATEGORIES.find(c => c.id === budget.category || c.label === budget.category) || CATEGORIES.find(c => c.id === 'other');
            
            // DİNAMİK HESAPLAMALAR
            const spent = budget.spent_amount || 0;
            const limit = parseFloat(budget.limit_amount);
            const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100).toFixed(0) : 0;

            const renderRightActions = () => (
              <TouchableOpacity
                style={{
                  backgroundColor: '#FF5252',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: s(75),
                  borderRadius: s(20),
                  marginBottom: vs(15),
                  gap: s(4),
                }}
                onPress={() => handleDeleteBudget(budget)}
              >
                <Ionicons name="trash-outline" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: ms(12), fontWeight: '700' }}>Sil</Text>
              </TouchableOpacity>
            );

            return (
              <Swipeable key={budget.id} renderRightActions={renderRightActions} overshootRight={false}>
                <View style={[styles.summaryCard, { marginBottom: vs(15) }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={catMeta.icon} size={20} color={catMeta.color} style={{ marginRight: s(10) }} />
                      <Text style={[styles.summaryTitle, { color: '#1A1D1E' }]}>{catMeta.label || budget.category}</Text>
                    </View>
                    <Text style={{ fontWeight: '800' }}>
                      {currencySymbol}{formatTR(convertAmount(spent))} <Text style={{ fontSize: ms(12), color: '#A0A3BD', fontWeight: '500' }}>/ {currencySymbol}{formatTR(convertAmount(limit))}</Text>
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: catMeta.color }]} />
                  </View>
                  <Text style={styles.progressText}>%{percentage} Harcandı</Text>
                </View>
              </Swipeable>
            );
          })
        ) : (
          // BOŞ DURUM
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
                <Ionicons name="pie-chart-outline" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Limit Belirlenmedi</Text>
            <Text style={styles.emptyText}>Kategorilere özel bütçe limitleri ekleyerek harcamalarını kontrol et.</Text>
          </View>
        )}

      </ScrollView>

      {/* BÜTÇE EKLEME MODALI */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable onPress={() => {}} style={styles.bottomSheet}>
              <View style={styles.dragHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Yeni Limit Ekle</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close-circle" size={28} color="#E2E8F0" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Kategori Seç</Text>
              <View style={{ height: vs(60), marginBottom: vs(20) }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(10), paddingRight: s(20) }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, selectedCat === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                      onPress={() => setSelectedCat(cat.id)}
                    >
                      <Ionicons name={cat.icon} size={18} color={selectedCat === cat.id ? '#fff' : cat.color} style={{ marginRight: s(6) }} />
                      <Text style={[styles.catChipText, selectedCat === cat.id && { color: '#fff' }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {selectedCat === 'other' && (
                <View style={{ marginBottom: vs(20) }}>
                  <Text style={styles.inputLabel}>Özel Kategori Adı</Text>
                  <View style={[styles.inputContainer, { marginBottom: 0, paddingVertical: vs(5) }]}>
                    <Ionicons name="pricetag-outline" size={20} color="#A0A3BD" style={{ marginRight: s(10) }} />
                    <TextInput
                      style={[styles.amountInput, { fontSize: ms(16), fontWeight: '600' }]}
                      placeholder="Kategori adı..."
                      value={customCategory}
                      onChangeText={setCustomCategory}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.inputLabel}>Aylık Limit Tutarı</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  value={amountDisplay}
                  onChangeText={handleAmountChange}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (!selectedCat || !amount || (selectedCat === 'other' && !customCategory)) && styles.saveBtnDisabled]}
                disabled={!selectedCat || !amount || (selectedCat === 'other' && !customCategory)}
                onPress={handleSaveBudget}
              >
                <Text style={styles.saveBtnText}>Limiti Kaydet</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

export default BudgetScreen;