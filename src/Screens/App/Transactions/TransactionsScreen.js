import React, { useState, useCallback, useContext, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, SafeAreaView, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, Modal, Pressable,
  Platform, ScrollView, Alert, TextInput, Image,
} from 'react-native';
import { s, vs, ms } from '../../../Constants/Responsive';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { CATEGORIES } from '../../../Constants/Categories';
import { useCurrency } from '../../../Context/CurrencyContext';
import { useDateFormat } from '../../../Context/DateFormatContext';
import { formatTR } from '../../../Constants/Formatters';

function TransactionsScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { currencySymbol, convertAmount } = useCurrency();
  const { formatDate } = useDateFormat();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  // FİLTRELEME & ARAMA STATE'LERİ
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilterCat, setSelectedFilterCat] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  // Sıralama: 'date' = fiş tarihine göre | 'added' = eklenme sırasına göre
  const [sortMode, setSortMode] = useState('date');
  // Etiket filtresi
  const [selectedTagFilter, setSelectedTagFilter] = useState(null); // null = tümü

  // KULLANICI ETİKETLERİ
  const [userTags, setUserTags] = useState([]);

  // DETAY MODAL STATE'LERİ
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // VERİYİ ÇEK
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/receipts/'), {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("İşlem geçmişi hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/tags/'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) setUserTags(await res.json());
    } catch { }
  }, [userToken]);

  useFocusEffect(useCallback(() => {
    fetchTransactions();
    fetchTags();
  }, []));

  // Fişe etiket ekle
  const addTagToReceipt = async (receiptId, tagId) => {
    try {
      await fetch(apiUrl(`/tags/receipts/${receiptId}/tags/${tagId}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      // Listeyi güncelle
      setTransactions(prev => prev.map(t => {
        if (t.id !== receiptId) return t;
        const tag = userTags.find(tg => tg.id === tagId);
        if (!tag || t.tags?.some(tg => tg.id === tagId)) return t;
        return { ...t, tags: [...(t.tags || []), tag] };
      }));
      setSelectedItem(prev => {
        if (!prev || prev.id !== receiptId) return prev;
        const tag = userTags.find(tg => tg.id === tagId);
        if (!tag || prev.tags?.some(tg => tg.id === tagId)) return prev;
        return { ...prev, tags: [...(prev.tags || []), tag] };
      });
    } catch { }
  };

  // Fişten etiket çıkar
  const removeTagFromReceipt = async (receiptId, tagId) => {
    try {
      await fetch(apiUrl(`/tags/receipts/${receiptId}/tags/${tagId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      setTransactions(prev => prev.map(t => {
        if (t.id !== receiptId) return t;
        return { ...t, tags: (t.tags || []).filter(tg => tg.id !== tagId) };
      }));
      setSelectedItem(prev => {
        if (!prev || prev.id !== receiptId) return prev;
        return { ...prev, tags: (prev.tags || []).filter(tg => tg.id !== tagId) };
      });
    } catch { }
  };

  // DETAY MODAL AÇ
  const openDetail = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setShowPhotoViewer(false);
    setTimeout(() => setSelectedItem(null), 300);
  };

  // SİL
  const handleDelete = (item) => {
    Alert.alert(
      'İşlemi Sil',
      `"${item.merchant_name || 'Bu işlem'}" silinecek. Emin misin?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(apiUrl(`/receipts/${item.id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok || res.status === 204) {
                setTransactions(prev => prev.filter(t => t.id !== item.id));
                closeDetail();
              }
            } catch (e) {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]
    );
  };

  // TÜMÜNÜ SİL
  const handleDeleteAll = () => {
    Alert.alert(
      'Tüm İşlemleri Sil',
      'Tüm işlem geçmişin kalıcı olarak silinecek. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tümünü Sil', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(apiUrl('/receipts/'), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok || res.status === 204) {
                setTransactions([]);
              }
            } catch (e) {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]
    );
  };

  // OPTİMİZE FİLTRELEME + ARAMA MOTORU
  const filteredData = useMemo(() => {
    let result = [...transactions];

    if (selectedTagFilter) {
      result = result.filter(item =>
        (item.tags || []).some(tag => tag.id === selectedTagFilter)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item =>
        (item.merchant_name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }
    if (selectedType !== 'all') {
      result = result.filter(item => item.receipt_type === selectedType);
    }
    if (selectedFilterCat !== 'all') {
      result = result.filter(item => {
        const catMeta = CATEGORIES.find(c => c.label === item.category || c.id === item.category);
        const catId = catMeta ? catMeta.id : 'other';
        return catId === selectedFilterCat;
      });
    }
    if (selectedDateFilter !== 'all') {
      const today = new Date();
      result = result.filter(item => {
        const itemDate = new Date(item.receipt_date);
        if (selectedDateFilter === 'last7days') {
          return itemDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (selectedDateFilter === 'thisMonth') {
          return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
        } else if (selectedDateFilter === 'lastMonth') {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return itemDate >= lastMonth && itemDate < thisMonthStart;
        }
        return true;
      });
    }

    // SIRALAMA
    result.sort((a, b) => {
      if (sortMode === 'added') {
        // Eklenme sırası: created_at desc
        const cA = a.created_at ? new Date(a.created_at) : new Date(0);
        const cB = b.created_at ? new Date(b.created_at) : new Date(0);
        return cB - cA;
      } else {
        // Fiş tarihi desc, aynıysa created_at desc
        const dA = a.receipt_date ? new Date(a.receipt_date) : new Date(0);
        const dB = b.receipt_date ? new Date(b.receipt_date) : new Date(0);
        if (dB - dA !== 0) return dB - dA;
        const cA = a.created_at ? new Date(a.created_at) : new Date(0);
        const cB = b.created_at ? new Date(b.created_at) : new Date(0);
        return cB - cA;
      }
    });

    return result;
  }, [transactions, searchQuery, selectedType, selectedFilterCat, selectedDateFilter, sortMode, selectedTagFilter]);

  // LİSTE ELEMANI
  const renderItem = ({ item }) => {
    const isIncome = item.receipt_type === 'income';
    const catMeta = CATEGORIES.find(c => c.label === item.category || c.id === item.category) || CATEGORIES.find(c => c.id === 'other');
    const dateStr = formatDate(item.receipt_date);

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.deleteActionText}>Sil</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity
          style={styles.transactionCard}
          onPress={() => openDetail(item)}
          activeOpacity={0.75}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: isIncome ? '#2ECC7115' : catMeta.color + '15' }]}>
              <Ionicons name={isIncome ? 'arrow-down' : catMeta.icon} size={22} color={isIncome ? '#2ECC71' : catMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                <Text style={styles.merchantName} numberOfLines={1}>{item.merchant_name || catMeta.label}</Text>
                {item.is_anomaly && (
                  <View style={styles.anomalyBadge}>
                    <Ionicons name="warning" size={10} color="#FF9800" />
                  </View>
                )}
              </View>
              <Text style={styles.dateText}>{dateStr}</Text>
              {item.tags && item.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(4), marginTop: vs(4) }}>
                  {item.tags.slice(0, 2).map(tag => (
                    <View key={tag.id} style={[styles.tagChip, { backgroundColor: tag.color + '20', borderColor: tag.color + '50' }]}>
                      <View style={[styles.tagChipDot, { backgroundColor: tag.color }]} />
                      <Text style={[styles.tagChipText, { color: tag.color }]}>{tag.name}</Text>
                    </View>
                  ))}
                  {item.tags.length > 2 && (
                    <View style={styles.tagChipMore}>
                      <Text style={styles.tagChipMoreText}>+{item.tags.length - 2}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* SAĞ TARAF: tutar + kamera butonu */}
          <View style={styles.cardRight}>
            <Text style={[styles.amountText, { color: isIncome ? '#2ECC71' : '#1A1D1E' }]}>
              {isIncome ? '+' : '-'}{currencySymbol}{formatTR(convertAmount(parseFloat(item.total_amount)))}
            </Text>
            {item.has_photo && (
              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={() => {
                  setSelectedItem(item);
                  setShowPhotoViewer(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="camera" size={14} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading && transactions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isFilterActive = selectedFilterCat !== 'all' || selectedDateFilter !== 'all' || selectedType !== 'all' || selectedTagFilter !== null;

  const resetFilters = () => {
    setSelectedFilterCat('all');
    setSelectedDateFilter('all');
    setSelectedType('all');
    setSelectedTagFilter(null);
    setShowFilterModal(false);
  };

  // Detay modalı için hesaplanan değerler (selectedItem değişince güncellenir)
  const detailItem = selectedItem;
  const detailIsIncome = detailItem?.receipt_type === 'income';
  const detailCatMeta = detailItem
    ? (CATEGORIES.find(c => c.label === detailItem.category || c.id === detailItem.category) || CATEGORIES.find(c => c.id === 'other'))
    : null;
  const detailImageUri = detailItem?.has_photo
    ? apiUrl(`/receipts/${detailItem.id}/image`) + `?token=${userToken}`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1D1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tüm İşlemler</Text>
        <View style={{ flexDirection: 'row', gap: s(8) }}>
          {transactions.length > 0 && (
            <TouchableOpacity onPress={handleDeleteAll} style={[styles.filterBtn, { backgroundColor: '#FFF5F5' }]}>
              <Ionicons name="trash-outline" size={22} color="#FF5252" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={24} color={isFilterActive ? Colors.primary : '#1A1D1E'} />
            {isFilterActive && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* SIRALAMA TOGGLE */}
      <View style={styles.sortToggle}>
        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'date' && styles.sortBtnActive]}
          onPress={() => setSortMode('date')}
        >
          <Ionicons name="calendar-outline" size={13} color={sortMode === 'date' ? '#fff' : '#718096'} style={{ marginRight: s(4) }} />
          <Text style={[styles.sortBtnText, sortMode === 'date' && styles.sortBtnTextActive]}>Tarihe Göre</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'added' && styles.sortBtnActive]}
          onPress={() => setSortMode('added')}
        >
          <Ionicons name="time-outline" size={13} color={sortMode === 'added' ? '#fff' : '#718096'} style={{ marginRight: s(4) }} />
          <Text style={[styles.sortBtnText, sortMode === 'added' && styles.sortBtnTextActive]}>Eklenme Sırası</Text>
        </TouchableOpacity>
      </View>

      {/* ARAMA ÇUBUĞU */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#A0A3BD" style={{ marginRight: s(8) }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Mağaza veya kategori ara..."
          placeholderTextColor="#A0A3BD"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#A0A3BD" />
          </TouchableOpacity>
        )}
      </View>

      {/* SONUÇ SAYISI */}
      {(searchQuery || isFilterActive) && (
        <Text style={styles.resultCount}>
          {filteredData.length} sonuç bulundu
        </Text>
      )}

      {/* LİSTE */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color="#E2E8F0" />
            <Text style={styles.emptyText}>Bu kritere uygun işlem bulunamadı.</Text>
          </View>
        }
      />

      {/* DETAY BOTTOM SHEET */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <Pressable style={styles.modalOverlay} onPress={closeDetail}>
          <Pressable onPress={() => {}} style={styles.detailSheet}>
            <View style={styles.dragHandle} />

            {detailItem && detailCatMeta && (
              <>
                {/* BAŞLIK SATIRI */}
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIconBox, { backgroundColor: detailCatMeta.color + '20' }]}>
                    <Ionicons name={detailCatMeta.icon} size={26} color={detailCatMeta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailMerchant} numberOfLines={1}>
                      {detailItem.merchant_name || detailCatMeta.label}
                    </Text>
                    <Text style={styles.detailCat}>{detailCatMeta.label}</Text>
                  </View>
                  <TouchableOpacity onPress={closeDetail} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="#718096" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vs(32) }}>
                  {/* TUTAR KARTI */}
                  <View style={[styles.amountCard, { backgroundColor: detailIsIncome ? '#2ECC71' : Colors.primary }]}>
                    <Text style={styles.amountCardLabel}>{detailIsIncome ? 'Gelir' : 'Gider'}</Text>
                    <Text style={styles.amountCardValue}>
                      {detailIsIncome ? '+' : '-'}{currencySymbol}{formatTR(convertAmount(parseFloat(detailItem.total_amount)))}
                    </Text>
                  </View>

                  {/* DETAY SATIRLARI */}
                  <View style={styles.detailRows}>
                    <DetailRow icon="calendar-outline" label="Tarih" value={formatDate(detailItem.receipt_date)} />
                    <DetailRow
                      icon={detailIsIncome ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                      label="İşlem Tipi"
                      value={detailIsIncome ? 'Gelir' : 'Gider'}
                      valueColor={detailIsIncome ? '#2ECC71' : '#FF5A5F'}
                    />
                    <DetailRow icon="grid-outline" label="Kategori" value={detailCatMeta.label} />
                    {detailItem.is_anomaly && (
                      <DetailRow
                        icon="warning-outline"
                        label="Anomali Uyarısı"
                        value={`Anormal harcama (skor: ${detailItem.anomaly_score ? detailItem.anomaly_score.toFixed(2) : '-'})`}
                        valueColor="#FF9800"
                      />
                    )}
                  </View>

                  {/* FİŞ FOTOĞRAFI */}
                  {detailImageUri && (
                    <View style={styles.photoSection}>
                      <Text style={styles.photoSectionTitle}>Fiş Fotoğrafı</Text>
                      <TouchableOpacity
                        style={styles.photoThumb}
                        onPress={() => setShowPhotoViewer(true)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: detailImageUri }}
                          style={styles.photoThumbImage}
                          resizeMode="cover"
                        />
                        <View style={styles.photoOverlay}>
                          <View style={styles.photoOverlayIcon}>
                            <Ionicons name="expand-outline" size={22} color="#fff" />
                          </View>
                          <Text style={styles.photoOverlayText}>Büyütmek için dokun</Text>
                        </View>
                      </TouchableOpacity>

                      {/* TAM EKRAN GÖRÜNTÜLEYICI — detay modalın içinde */}
                      <Modal
                        visible={showPhotoViewer}
                        transparent={false}
                        animationType="fade"
                        onRequestClose={() => setShowPhotoViewer(false)}
                      >
                        <View style={styles.photoViewerContainer}>
                          <SafeAreaView style={styles.photoViewerTopBar}>
                            <TouchableOpacity
                              style={styles.photoViewerCloseBtn}
                              onPress={() => setShowPhotoViewer(false)}
                            >
                              <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.photoViewerTitle} numberOfLines={1}>
                              {detailItem?.merchant_name || 'Fiş Fotoğrafı'}
                            </Text>
                            <View style={{ width: s(44) }} />
                          </SafeAreaView>
                          <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={styles.photoViewerContent}
                            maximumZoomScale={4}
                            minimumZoomScale={1}
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            centerContent
                            bouncesZoom
                          >
                            <Image
                              source={{ uri: detailImageUri }}
                              style={styles.photoViewerImage}
                              resizeMode="contain"
                            />
                          </ScrollView>
                          <SafeAreaView style={styles.photoViewerBottomBar}>
                            <Text style={styles.photoViewerHint}>Yakınlaştırmak için iki parmakla sürükle</Text>
                          </SafeAreaView>
                        </View>
                      </Modal>
                    </View>
                  )}

                  {/* ETİKETLER */}
                  <View style={styles.tagSection}>
                    <View style={styles.tagSectionHeader}>
                      <Text style={styles.tagSectionTitle}>Etiketler</Text>
                      <TouchableOpacity onPress={() => navigation.navigate('Tags')}>
                        <Text style={styles.tagManageLink}>Yönet</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Ekli etiketler */}
                    <View style={styles.tagRow}>
                      {(detailItem.tags || []).map(tag => (
                        <TouchableOpacity
                          key={tag.id}
                          style={[styles.tagChipDetail, { backgroundColor: tag.color + '20', borderColor: tag.color + '50' }]}
                          onPress={() => removeTagFromReceipt(detailItem.id, tag.id)}
                        >
                          <View style={[styles.tagChipDot, { backgroundColor: tag.color }]} />
                          <Text style={[styles.tagChipText, { color: tag.color }]}>{tag.name}</Text>
                          <Ionicons name="close" size={12} color={tag.color} style={{ marginLeft: s(2) }} />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Eklenebilecek etiketler */}
                    {userTags.filter(t => !(detailItem.tags || []).some(dt => dt.id === t.id)).length > 0 && (
                      <View style={[styles.tagRow, { marginTop: vs(8) }]}>
                        {userTags
                          .filter(t => !(detailItem.tags || []).some(dt => dt.id === t.id))
                          .map(tag => (
                            <TouchableOpacity
                              key={tag.id}
                              style={[styles.tagChipAdd, { borderColor: tag.color + '60' }]}
                              onPress={() => addTagToReceipt(detailItem.id, tag.id)}
                            >
                              <Ionicons name="add" size={12} color={tag.color} />
                              <Text style={[styles.tagChipText, { color: tag.color }]}>{tag.name}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}

                    {userTags.length === 0 && (
                      <TouchableOpacity onPress={() => navigation.navigate('Tags')}>
                        <Text style={styles.tagEmptyText}>Etiket oluşturmak için dokun →</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* SİL BUTONU */}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(detailItem)}>
                    <Ionicons name="trash-outline" size={18} color="#FF5252" style={{ marginRight: s(8) }} />
                    <Text style={styles.deleteBtnText}>İşlemi Sil</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* FİLTRE MODAL */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Pressable onPress={() => {}} style={styles.bottomSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>İşlemleri Filtrele</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close-circle" size={28} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vs(20) }}>
              <Text style={styles.filterSectionTitle}>İşlem Tipi</Text>
              <View style={[styles.filterOptions, { marginBottom: vs(25) }]}>
                {[
                  { key: 'all', label: 'Tümü' },
                  { key: 'expense', label: '↑ Gider' },
                  { key: 'income', label: '↓ Gelir' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.filterChip, selectedType === opt.key && styles.activeFilterChip]}
                    onPress={() => setSelectedType(opt.key)}
                  >
                    <Text style={[styles.filterChipText, selectedType === opt.key && styles.activeFilterText]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionTitle}>Tarihe Göre</Text>
              <View style={[styles.filterOptions, { marginBottom: vs(25) }]}>
                {[
                  { key: 'all', label: 'Tüm Zamanlar' },
                  { key: 'last7days', label: 'Son 7 Gün' },
                  { key: 'thisMonth', label: 'Bu Ay' },
                  { key: 'lastMonth', label: 'Geçen Ay' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.filterChip, selectedDateFilter === opt.key && styles.activeFilterChip]}
                    onPress={() => setSelectedDateFilter(opt.key)}
                  >
                    <Text style={[styles.filterChipText, selectedDateFilter === opt.key && styles.activeFilterText]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {userTags.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>Etikete Göre</Text>
                  <View style={[styles.filterOptions, { marginBottom: vs(25) }]}>
                    <TouchableOpacity
                      style={[styles.filterChip, selectedTagFilter === null && styles.activeFilterChip]}
                      onPress={() => setSelectedTagFilter(null)}
                    >
                      <Text style={[styles.filterChipText, selectedTagFilter === null && styles.activeFilterText]}>Tümü</Text>
                    </TouchableOpacity>
                    {userTags.map(tag => (
                      <TouchableOpacity
                        key={tag.id}
                        style={[styles.filterChip, selectedTagFilter === tag.id && { backgroundColor: tag.color, borderColor: tag.color }]}
                        onPress={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: selectedTagFilter === tag.id ? '#fff' : tag.color }} />
                          <Text style={[styles.filterChipText, selectedTagFilter === tag.id && { color: '#fff' }]}>{tag.name}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.filterSectionTitle}>Kategoriye Göre</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedFilterCat === 'all' && styles.activeFilterChip]}
                  onPress={() => setSelectedFilterCat('all')}
                >
                  <Text style={[styles.filterChipText, selectedFilterCat === 'all' && styles.activeFilterText]}>Tümü</Text>
                </TouchableOpacity>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.filterChip, selectedFilterCat === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                    onPress={() => setSelectedFilterCat(cat.id)}
                  >
                    <Text style={[styles.filterChipText, selectedFilterCat === cat.id && { color: '#fff' }]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterFooter}>
              {isFilterActive && (
                <TouchableOpacity style={styles.resetBtnOutline} onPress={resetFilters}>
                  <Ionicons name="refresh" size={15} color={Colors.primary} style={{ marginRight: s(5) }} />
                  <Text style={styles.resetBtnOutlineText}>Sıfırla</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.applyBtn, !isFilterActive && { flex: 1 }]}
                onPress={() => setShowFilterModal(false)}
              >
                <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: s(6) }} />
                <Text style={styles.applyBtnText}>Sonuçları Göster</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

// ----- YARDIMCI BİLEŞEN -----
function DetailRow({ icon, label, value, valueColor }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        <Ionicons name={icon} size={16} color="#A0A3BD" style={{ marginRight: s(8) }} />
        <Text style={styles.detailRowLabel}>{label}</Text>
      </View>
      <Text style={[styles.detailRowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: s(20) },
  backBtn: { backgroundColor: '#fff', padding: s(8), borderRadius: s(12), elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  headerTitle: { fontSize: ms(20), fontWeight: '800', color: '#1A1D1E' },
  filterBtn: { backgroundColor: '#fff', padding: s(8), borderRadius: s(12), elevation: 2, position: 'relative' },
  filterDot: { position: 'absolute', top: 5, right: 5, width: s(8), height: s(8), borderRadius: s(4), backgroundColor: Colors.primary },

  listContent: { padding: s(20), paddingBottom: vs(100) },
  transactionCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: s(16), borderRadius: s(20), marginBottom: vs(15),
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: s(10),
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: s(48), height: s(48), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', marginRight: s(15) },
  merchantName: { fontSize: ms(16), fontWeight: '700', color: '#1A1D1E', marginBottom: vs(2) },
  dateText: { fontSize: ms(13), color: '#A0A3BD', fontWeight: '500' },
  amountText: { fontSize: ms(16), fontWeight: '800' },

  // Sağ taraf
  cardRight: {
    alignItems: 'flex-end', gap: vs(4),
  },
  cameraBtn: {
    backgroundColor: Colors.primary + '15',
    borderRadius: s(8), padding: s(5),
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  anomalyBadge: {
    backgroundColor: '#FF980018',
    borderRadius: s(6), padding: s(3),
  },

  emptyContainer: { alignItems: 'center', marginTop: vs(50) },
  emptyText: { marginTop: vs(15), color: '#A0A3BD', fontSize: ms(16), fontWeight: '600' },

  // FİLTRE MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: s(30), borderTopRightRadius: s(30), paddingHorizontal: s(20), paddingTop: vs(10), maxHeight: '80%' },
  dragHandle: { width: s(40), height: vs(5), backgroundColor: '#E2E8F0', borderRadius: s(3), alignSelf: 'center', marginBottom: vs(15) },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(20) },
  sheetTitle: { fontSize: ms(18), fontWeight: '800', color: '#1A202C' },
  filterSectionTitle: { fontSize: ms(13), fontWeight: '700', color: '#A0A3BD', marginBottom: vs(12), textTransform: 'uppercase', letterSpacing: 0.8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: s(10) },
  filterChip: { paddingHorizontal: s(16), paddingVertical: vs(10), borderRadius: s(20), borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F7FAFC' },
  activeFilterChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: ms(14), fontWeight: '600', color: '#4A5568' },
  activeFilterText: { color: '#fff' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: s(16),
    paddingHorizontal: s(16), paddingVertical: vs(12),
    marginHorizontal: s(20), marginBottom: vs(8),
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: s(6),
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  searchInput: { flex: 1, fontSize: ms(15), color: '#1A1D1E' },
  resultCount: { fontSize: ms(12), color: '#A0A3BD', fontWeight: '600', marginHorizontal: s(24), marginBottom: vs(6) },
  // Sort toggle
  sortToggle: {
    flexDirection: 'row', gap: s(8),
    marginHorizontal: s(20), marginBottom: vs(10),
    backgroundColor: '#F0F4F8',
    borderRadius: s(14), padding: s(4),
  },
  sortBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: vs(8), borderRadius: s(11),
  },
  sortBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: s(4), elevation: 3,
  },
  sortBtnText: { fontSize: ms(12), fontWeight: '600', color: '#718096' },
  sortBtnTextActive: { color: '#fff' },

  filterFooter: {
    flexDirection: 'row', gap: s(10),
    marginTop: vs(10), marginBottom: vs(10),
  },
  resetBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: s(16),
    paddingVertical: vs(13), paddingHorizontal: s(16),
  },
  resetBtnOutlineText: { color: Colors.primary, fontSize: ms(14), fontWeight: '700' },
  applyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: s(16),
    paddingVertical: vs(13),
  },
  applyBtnText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
  deleteAction: {
    backgroundColor: '#FF5252',
    justifyContent: 'center', alignItems: 'center',
    width: s(75), borderRadius: s(20), marginBottom: vs(15), gap: vs(4),
  },
  deleteActionText: { color: '#fff', fontSize: ms(12), fontWeight: '700' },

  // DETAY BOTTOM SHEET
  detailSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: s(30),
    borderTopRightRadius: s(30),
    paddingHorizontal: s(20),
    paddingTop: vs(10),
    maxHeight: '88%',
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: vs(16), paddingBottom: vs(14),
    borderBottomWidth: 1, borderBottomColor: '#F0F4F8',
  },
  detailIconBox: {
    width: s(52), height: s(52), borderRadius: s(18),
    alignItems: 'center', justifyContent: 'center',
    marginRight: s(14),
  },
  detailMerchant: { fontSize: ms(17), fontWeight: '800', color: '#1A1D1E', marginBottom: vs(2) },
  detailCat: { fontSize: ms(13), color: '#A0A3BD', fontWeight: '500' },
  closeBtn: {
    width: s(36), height: s(36),
    backgroundColor: '#F0F4F8', borderRadius: s(12),
    alignItems: 'center', justifyContent: 'center',
  },

  amountCard: {
    borderRadius: s(20), padding: s(20),
    alignItems: 'center', marginBottom: vs(16),
  },
  amountCardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: ms(12), fontWeight: '600', marginBottom: vs(4) },
  amountCardValue: { color: '#fff', fontSize: ms(32), fontWeight: '800', letterSpacing: 0.5 },

  detailRows: {
    backgroundColor: '#F8FAFC',
    borderRadius: s(16), padding: s(4),
    marginBottom: vs(16),
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(12), paddingVertical: vs(12),
    borderBottomWidth: 1, borderBottomColor: '#EEF2F6',
  },
  detailRowLeft: { flexDirection: 'row', alignItems: 'center' },
  detailRowLabel: { fontSize: ms(14), color: '#718096', fontWeight: '500' },
  detailRowValue: { fontSize: ms(14), color: '#1A1D1E', fontWeight: '700' },

  // FİŞ FOTOĞRAFI
  photoSection: { marginBottom: vs(16) },
  photoSectionTitle: {
    fontSize: ms(13), fontWeight: '700', color: '#A0A3BD',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: vs(10),
  },
  photoThumb: {
    borderRadius: s(18), overflow: 'hidden',
    height: vs(180), backgroundColor: '#F0F4F8',
    position: 'relative',
  },
  photoThumbImage: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: vs(10), gap: s(8),
  },
  photoOverlayIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: s(8), padding: s(4),
  },
  photoOverlayText: { color: '#fff', fontSize: ms(13), fontWeight: '600' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: s(16), paddingVertical: vs(14),
    borderWidth: 1, borderColor: '#FFEBEE',
  },
  deleteBtnText: { color: '#FF5252', fontSize: ms(15), fontWeight: '700' },

  // ETİKET STİLLERİ
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingHorizontal: s(7), paddingVertical: vs(2),
    borderRadius: s(10), borderWidth: 1,
  },
  tagChipDot: { width: s(5), height: s(5), borderRadius: s(3) },
  tagChipText: { fontSize: ms(10), fontWeight: '600' },
  tagChipMore: {
    paddingHorizontal: s(7), paddingVertical: vs(2),
    borderRadius: s(10), backgroundColor: '#F0F4F8',
  },
  tagChipMoreText: { fontSize: ms(10), fontWeight: '600', color: '#718096' },

  // DETAY MODAL ETİKET BÖLÜMÜ
  tagSection: {
    backgroundColor: '#F8FAFC', borderRadius: s(16),
    padding: s(14), marginBottom: vs(14),
    borderWidth: 1, borderColor: '#EEF2F6',
  },
  tagSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: vs(10),
  },
  tagSectionTitle: { fontSize: ms(13), fontWeight: '700', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.6 },
  tagManageLink: { fontSize: ms(12), fontWeight: '600', color: Colors.primary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(7) },
  tagChipDetail: {
    flexDirection: 'row', alignItems: 'center', gap: s(4),
    paddingHorizontal: s(10), paddingVertical: vs(5),
    borderRadius: s(12), borderWidth: 1,
  },
  tagChipAdd: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingHorizontal: s(10), paddingVertical: vs(5),
    borderRadius: s(12), borderWidth: 1, borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  tagEmptyText: { fontSize: ms(13), color: Colors.primary, fontWeight: '500', marginTop: vs(4) },

  // TAM EKRAN FOTOĞRAF GÖRÜNTÜLEYİCİ
  photoViewerContainer: { flex: 1, backgroundColor: '#000' },
  photoViewerTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(16), paddingVertical: vs(10),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoViewerCloseBtn: {
    width: s(44), height: s(44), borderRadius: s(22),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoViewerTitle: { color: '#fff', fontSize: ms(15), fontWeight: '700', flex: 1, textAlign: 'center' },
  photoViewerContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    minHeight: '100%',
  },
  photoViewerImage: {
    width: '100%',
    aspectRatio: 0.75,
  },
  photoViewerBottomBar: {
    alignItems: 'center', paddingVertical: vs(12),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoViewerHint: { color: 'rgba(255,255,255,0.6)', fontSize: ms(12) },
});

export default TransactionsScreen;
