import React, { useState, useContext, useMemo } from 'react';
import { s, vs, ms } from '../../../Constants/Responsive';
import {
  View, Text, SafeAreaView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet, Platform, Modal, Pressable,
  FlatList, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { CATEGORIES } from '../../../Constants/Categories';
import { useCurrency } from '../../../Context/CurrencyContext';
import * as Haptics from 'expo-haptics';

function AddReceiptScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { currencySymbol } = useCurrency();
  
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');       // ham string, nokta = ondalık ayraç
  const [amountDisplay, setAmountDisplay] = useState(''); // binlik noktalı gösterim
  const [type, setType] = useState('expense');
  const [date, setDate] = useState(new Date());
  
  const [selectedCat, setSelectedCat] = useState(CATEGORIES[0]); 
  const [showCatModal, setShowCatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // YENİ: DİĞER SEÇENEĞİ İÇİN MANUEL GİRİŞ STATE'İ
  const [customCategory, setCustomCategory] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return CATEGORIES;
    return CATEGORIES.filter(cat => 
      cat.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Binlik nokta formatlaması: "300000,50" → "300.000,50"
  const handleAmountChange = (text) => {
    // Sadece rakam ve virgül (ondalık) karakterlerine izin ver
    let cleaned = text.replace(/[^0-9,]/g, '');
    // Birden fazla virgülü engelle
    const parts = cleaned.split(',');
    if (parts.length > 2) cleaned = parts[0] + ',' + parts.slice(1).join('');

    // Ham değer: virgülü noktaya çevir (parseFloat için)
    const rawValue = cleaned.replace(',', '.');
    setAmount(rawValue);

    // Görüntü: tam sayı kısmına binlik nokta ekle
    const [intPart, decPart] = cleaned.split(',');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setAmountDisplay(decPart !== undefined ? formatted + ',' + decPart : formatted);
  };

  const handleSave = async () => {
    if (!merchantName || !amount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldur!");
      return;
    }

    // 'other' seçiliyse customCategory'i kullan, diğerlerinde id'yi kaydet
    let finalCategory = selectedCat.id;
    if (selectedCat.id === 'other') {
      finalCategory = customCategory.trim() !== '' ? customCategory.trim() : 'other';
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl('/receipts/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          merchant_name: merchantName,
          total_amount: parseFloat(amount),
          receipt_type: type,
          receipt_date: date.toISOString(),
          category: finalCategory // 👈 Backend'e karar verilen etiket gidiyor
        })
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
        Alert.alert("Başarılı ✓", "İşlem kaydedildi!");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        let detail = `Sunucu hatası (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody?.detail) detail = JSON.stringify(errBody.detail);
        } catch (_) {}
        Alert.alert("Hata", detail);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Hata", `Bağlantı sorunu: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="close" size={24} color={Colors.textMain} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Yeni İşlem</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
              <View style={styles.typeSelector}>
                <TouchableOpacity style={[styles.typeBtn, type === 'expense' && styles.activeExpense]} onPress={() => setType('expense')}>
                  <Ionicons name="arrow-up-circle" size={20} color={type === 'expense' ? '#fff' : '#8E8E93'} />
                  <Text style={[styles.typeText, type === 'expense' && styles.activeText]}>Gider</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, type === 'income' && styles.activeIncome]} onPress={() => setType('income')}>
                  <Ionicons name="arrow-down-circle" size={20} color={type === 'income' ? '#fff' : '#8E8E93'} />
                  <Text style={[styles.typeText, type === 'income' && styles.activeText]}>Gelir</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputCard}>
                
                <Text style={styles.label}>Kategori</Text>
                <TouchableOpacity style={styles.categoryTrigger} onPress={() => setShowCatModal(true)}>
                  <View style={styles.triggerLeft}>
                    <View style={[styles.triggerIconBox, { backgroundColor: selectedCat.color + '15' }]}>
                      <Ionicons name={selectedCat.icon} size={20} color={selectedCat.color} />
                    </View>
                    <Text style={styles.triggerText}>{selectedCat.label}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color="#A0A3BD" />
                </TouchableOpacity>

                {/* YENİ: SADECE DİĞER SEÇİLİNCE AÇILAN MANUEL GİRİŞ KUTUSU */}
                {selectedCat.id === 'other' && (
                  <View style={[styles.inputWrapper, { borderColor: selectedCat.color, backgroundColor: selectedCat.color + '05' }]}>
                    <Ionicons name="pencil" size={20} color={selectedCat.color} style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="Kendi kategorinizi yazın..." 
                      placeholderTextColor="#ADB5BD" 
                      value={customCategory} 
                      onChangeText={setCustomCategory} 
                      autoFocus={true} 
                    />
                  </View>
                )}

                <Text style={styles.label}>Açıklama / Mağaza</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="briefcase-outline" size={20} color="#6C757D" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Örn: Starbucks, Migros..." placeholderTextColor="#ADB5BD" value={merchantName} onChangeText={setMerchantName} />
                </View>

                <Text style={styles.label}>Tutar ({currencySymbol})</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                  <TextInput style={[styles.input, { fontWeight: '700', fontSize: 20 }]} placeholder="0,00" placeholderTextColor="#ADB5BD" keyboardType="decimal-pad" value={amountDisplay} onChangeText={handleAmountChange} />
                </View>

                <Text style={styles.label}>Tarih</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
                  <Text style={styles.dateText}>{date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>

            {/* BOTTOM SHEET */}
            <Modal visible={showCatModal} transparent animationType="slide" onRequestClose={() => setShowCatModal(false)}>
              <Pressable style={styles.modalOverlay} onPress={() => setShowCatModal(false)}>
                <Pressable onPress={() => {}} style={styles.bottomSheet}>
                  <View style={styles.dragHandle} />
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Kategori Seç</Text>
                    <TouchableOpacity onPress={() => setShowCatModal(false)}>
                      <Ionicons name="close-circle" size={28} color="#E2E8F0" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#A0A3BD" style={{ marginRight: 10 }} />
                    <TextInput style={styles.searchInput} placeholder="Kategori Ara..." placeholderTextColor="#ADB5BD" value={searchQuery} onChangeText={setSearchQuery} autoCorrect={false} />
                  </View>

                  <FlatList
                    data={filteredCategories}
                    keyExtractor={item => item.id}
                    numColumns={3}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    columnWrapperStyle={{ justifyContent: 'flex-start' }}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={[styles.gridItem, selectedCat.id === item.id && { borderColor: item.color, backgroundColor: item.color + '10' }]}
                        onPress={() => {
                          setSelectedCat(item);
                          setSearchQuery('');
                          setShowCatModal(false);
                          // Diğer seçildiğinde customCategory'i sıfırla ki eski yazdığı kalmasın
                          if(item.id === 'other') setCustomCategory('');
                        }}
                      >
                        <View style={[styles.gridIconBox, { backgroundColor: item.color + '15' }]}>
                          <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <Text style={[styles.gridText, selectedCat.id === item.id && { color: item.color, fontWeight: '700' }]}>{item.label}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </Pressable>
              </Pressable>
            </Modal>

            {/* TAKVİM MODALI */}
            {Platform.OS === 'ios' && (
              <Modal transparent visible={showDatePicker} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
                  <Pressable onPress={() => {}} style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.modalBtnText}>Vazgeç</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={[styles.modalBtnText, { fontWeight: '800' }]}>Bitti</Text></TouchableOpacity>
                    </View>
                    <DateTimePicker value={date} mode="date" display="inline" onChange={onDateChange} locale="tr-TR" />
                  </Pressable>
                </Pressable>
              </Modal>
            )}
            {Platform.OS === 'android' && showDatePicker && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: s(20) },
  closeBtn: { backgroundColor: '#fff', padding: s(10), borderRadius: s(14), elevation: 3, shadowColor: '#1A202C', shadowOpacity: 0.06, shadowRadius: s(5) },
  headerTitle: { fontSize: ms(20), fontWeight: '800', color: '#1A1D1E' },
  content: { padding: s(20) },
  typeSelector: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: s(20), padding: s(6), marginBottom: vs(25), elevation: 4, shadowColor: '#000', shadowOpacity: 0.04 },
  typeBtn: { flex: 1, flexDirection: 'row', paddingVertical: vs(14), alignItems: 'center', justifyContent: 'center', borderRadius: s(16) },
  activeExpense: { backgroundColor: '#FF5A5F' },
  activeIncome: { backgroundColor: '#2ECC71' },
  activeText: { color: '#fff', fontWeight: 'bold' },
  typeText: { marginLeft: s(8), color: '#4A5568', fontSize: ms(16), fontWeight: '600' },
  inputCard: { backgroundColor: '#fff', borderRadius: s(24), padding: s(24), marginBottom: vs(30), elevation: 5, shadowColor: '#000', shadowOpacity: 0.05 },
  label: { fontSize: ms(13), color: '#718096', marginBottom: vs(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EDF2F7', padding: s(12), borderRadius: s(16), borderWidth: 1, borderColor: '#E2E8F0', marginBottom: vs(20) },
  triggerLeft: { flexDirection: 'row', alignItems: 'center' },
  triggerIconBox: { width: s(36), height: s(36), borderRadius: s(12), alignItems: 'center', justifyContent: 'center', marginRight: s(12) },
  triggerText: { fontSize: ms(16), fontWeight: '600', color: '#1A202C' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDF2F7', borderRadius: s(16), paddingHorizontal: s(15), marginBottom: vs(20), borderWidth: 1, borderColor: '#E2E8F0' },
  inputIcon: { marginRight: s(10) },
  currencyPrefix: { fontSize: ms(18), fontWeight: '700', color: Colors.primary, marginRight: s(5) },
  input: { flex: 1, paddingVertical: vs(16), fontSize: ms(16), color: '#1A202C' },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDF2F7', padding: s(16), borderRadius: s(16), borderWidth: 1, borderColor: '#E2E8F0', marginBottom: vs(5) },
  dateText: { marginLeft: s(12), fontSize: ms(16), color: '#1A202C', fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, padding: s(20), borderRadius: s(22), alignItems: 'center', elevation: 7, shadowColor: Colors.primary, shadowOpacity: 0.25 },
  saveBtnText: { color: '#fff', fontSize: ms(18), fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: s(30), borderTopRightRadius: s(30), paddingHorizontal: s(20), paddingTop: vs(10), paddingBottom: Platform.OS === 'ios' ? vs(40) : vs(20), maxHeight: '80%' },
  dragHandle: { width: s(40), height: vs(5), backgroundColor: '#E2E8F0', borderRadius: s(3), alignSelf: 'center', marginBottom: vs(15) },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(20) },
  sheetTitle: { fontSize: ms(18), fontWeight: '800', color: '#1A202C' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAFC', borderRadius: s(14), paddingHorizontal: s(15), paddingVertical: vs(12), marginBottom: vs(20), borderWidth: 1, borderColor: '#EDF2F7' },
  searchInput: { flex: 1, fontSize: ms(16), color: '#1A202C' },
  gridItem: { width: '30%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: s(20), borderWidth: 1, borderColor: '#F1F2F6', marginBottom: vs(15), marginRight: '3.3%' },
  gridIconBox: { width: s(45), height: s(45), borderRadius: s(15), alignItems: 'center', justifyContent: 'center', marginBottom: vs(8) },
  gridText: { fontSize: ms(12), fontWeight: '600', color: '#718096', textAlign: 'center' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: s(30), borderTopRightRadius: s(30), padding: s(20), paddingBottom: vs(40) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(15) },
  modalBtnText: { color: Colors.primary, fontSize: ms(16) },
});

export default AddReceiptScreen;