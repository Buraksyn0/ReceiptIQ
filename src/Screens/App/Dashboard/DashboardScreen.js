import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { s, vs, ms } from '../../../Constants/Responsive';
import createStyles from './DashboardStyles';
import { StatusBar } from 'expo-status-bar';

// BEYİN
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import { useCurrency } from '../../../Context/CurrencyContext';
import { useDateFormat } from '../../../Context/DateFormatContext';
import { formatTR, formatShortTR } from '../../../Constants/Formatters';
import { useTabBarPadding } from '../../../Constants/TabBar';

function DashboardScreen({ navigation }) {
  // 1. STATE & CONTEXT
  const { userToken, user } = useContext(AuthContext);
  const { isDarkMode, colors } = useTheme();
  const { t } = useLanguage();
  const { currencySymbol, convertAmount } = useCurrency();
  const { formatDate } = useDateFormat();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tabBarPadding = useTabBarPadding();

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [goalProgress, setGoalProgress] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [financialScore, setFinancialScore] = useState(null);

  // Saatin gününe göre selamla
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return t.greetingNight;
    if (h < 12) return t.greetingMorning;
    if (h < 18) return t.greetingAfternoon;
    return t.greetingEvening;
  }, [t]);

  const firstName = (user?.full_name || '').split(' ')[0] || 'Kullanıcı';

  // 2. LIFECYCLE (Ekran yüklendiğinde çalışır)
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    },[])
  );

  // 3. BACKEND BAĞLANTISI
  const fetchAll = async () => {
    await checkRecurring();
    await Promise.all([fetchReceipts(), fetchForecast(), fetchUnreadCount(), fetchGoalProgress(), fetchWeeklySummary(), fetchFinancialScore()]);
  };

  const fetchFinancialScore = async () => {
    try {
      const res = await fetch(apiUrl('/analytics/financial-score'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) setFinancialScore(await res.json());
    } catch (e) {}
  };

  const fetchWeeklySummary = async () => {
    try {
      const res = await fetch(apiUrl('/analytics/weekly-summary'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Sadece geçen haftada harcama varsa göster
        if (data.last_week?.total > 0 || data.this_week?.total > 0) {
          setWeeklySummary(data);
        }
      }
    } catch (e) {}
  };

  const fetchGoalProgress = async () => {
    try {
      const res = await fetch(apiUrl('/goals/progress'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGoalProgress(data.goal ? data : null);
      }
    } catch (e) {}
  };

  const checkRecurring = async () => {
    try {
      await fetch(apiUrl('/recurring/check'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
      });
    } catch (e) {
      // sessizce geç
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch(apiUrl('/notifications/unread-count'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      // sessizce geç
    }
  };

  const fetchReceipts = async () => {
    try {
      const response = await fetch(apiUrl('/receipts/'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        const sortedData = data.sort((a, b) => {
          // Önce receipt_date (en yeni üstte), aynı gündeyse created_at
          const dateA = a.receipt_date ? new Date(a.receipt_date) : new Date(0);
          const dateB = b.receipt_date ? new Date(b.receipt_date) : new Date(0);
          if (dateB - dateA !== 0) return dateB - dateA;
          const createdA = a.created_at ? new Date(a.created_at) : new Date(0);
          const createdB = b.created_at ? new Date(b.created_at) : new Date(0);
          return createdB - createdA;
        });
        setReceipts(sortedData);
      }
    } catch (error) {
      console.error("Bağlantı Hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchForecast = async () => {
    try {
      const response = await fetch(apiUrl('/analytics/forecast'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setForecast(data);
      }
    } catch (error) {
      console.error('Forecast hatası:', error);
    }
  };

  // 3b. DIŞA AKTAR
  const handleExport = () => {
    Alert.alert(
      t.export || 'Dışa Aktar',
      'Format seçin:',
      [
        { text: 'CSV (Excel)', onPress: () => doExport('csv') },
        { text: 'PDF Raporu', onPress: () => doExport('pdf') },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };

  const doExport = async (format) => {
    try {
      const endpoint = format === 'pdf' ? '/receipts/export/pdf' : '/receipts/export/csv';
      const fileName = format === 'pdf' ? 'receipts.pdf' : 'receipts.csv';
      const fileUri = FileSystem.documentDirectory + fileName;
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';

      // Expo FileSystem ile direkt indir
      const downloadResult = await FileSystem.downloadAsync(
        apiUrl(endpoint),
        fileUri,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      if (downloadResult.status !== 200) throw new Error('Export başarısız');

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, { mimeType, dialogTitle: 'Fişleri Dışa Aktar' });
      } else {
        Alert.alert('Hazır', 'Dosya kaydedildi.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Dışa aktarma sırasında bir sorun oluştu.');
      console.error('Export hatası:', error);
    }
  };

  // 4. OPTİMİZE EDİLMİŞ FİNANS MOTORU (Sadece receipts değiştiğinde hesaplar)
  const { totalIncome, totalExpense, totalBalance } = useMemo(() => {
    let income = 0;
    let expense = 0;

    receipts.forEach(item => {
      // Veritabanından gelen değeri güvenli bir Float'a çevir
      const amount = parseFloat(item.total_amount) || 0;

      // Şimdilik mantık: Artı değerler Gelir, Eksi değerler Gider
      if (item.receipt_type === 'income') {
        income += Math.abs(amount)
      } else {
        // Gideri eksi toplamasın diye mutlak değerini (Math.abs) alıyoruz
        expense += Math.abs(amount);
      }
    });

    return {
      totalIncome: income,
      totalExpense: expense,
      totalBalance: income - expense
    };
  }, [receipts]);

  // 5. LİSTE ELEMANI (Her bir harcama satırı)
  const renderItem = ({ item }) => {
    const amount = parseFloat(item.total_amount) || 0;
    const isIncome = item.receipt_type === 'income';

    return (
      <TransactionItem
        title={item.merchant_name || t.unknownMerchant}
        date={item.receipt_date ? formatDate(item.receipt_date) : t.noDate}
        amount={`${isIncome ? '+' : '-'}${currencySymbol}${formatTR(convertAmount(Math.abs(amount)))}`}
        icon={isIncome ? "arrow-down-outline" : "receipt-outline"}
        color={isIncome ? "#00C853" : Colors.primary}
        isIncome={isIncome}
        isAnomaly={item.is_anomaly}
        styles={styles}
        colors={colors}
        t={t}
      />
    );
  };

  // 6. LİSTE BAŞLIĞI (Tüm üst tasarım)
  const renderHeader = () => (
    <View>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{user?.full_name || firstName}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Alerts')}>
            <Ionicons name="notifications-outline" size={24} color={Colors.primary} />
            {unreadCount > 0 && (
              <View style={unreadBadgeStyle}>
                <Text style={unreadBadgeTextStyle}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="person" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* DİNAMİK BAKİYE KARTI */}
      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>{t.totalBalance}</Text>
          <Text style={styles.balanceAmount}>{currencySymbol}{formatTR(convertAmount(totalBalance))}</Text>
        </View>
        <View style={styles.cardIcon}>
           <Ionicons name="wallet-outline" size={32} color="#fff" />
        </View>
        <View style={styles.statsContainer}>
           <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={18} color="#A5D6A7" />
              <Text style={styles.statText}>{t.income}: {currencySymbol}{formatAmount(convertAmount(totalIncome))}</Text>
           </View>
           <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={18} color="#FFCDD2" />
              <Text style={styles.statText}>{t.expense}: {currencySymbol}{formatAmount(convertAmount(totalExpense))}</Text>
           </View>
        </View>
      </View>

      {/* FAZ 4: TAHMİN KARTI */}
      {forecast && (
        <ForecastCard forecast={forecast} colors={colors} t={t} currencySymbol={currencySymbol} convertAmount={convertAmount} />
      )}

      {/* FAZ 8: TASARRUF HEDEFİ KARTI */}
      {goalProgress && (
        <SavingsGoalCard
          progress={goalProgress}
          colors={colors}
          currencySymbol={currencySymbol}
          convertAmount={convertAmount}
          onPress={() => navigation.navigate('SavingsGoal')}
        />
      )}

      {/* HAFTALIK ÖZET KARTI */}
      {weeklySummary && (
        <WeeklySummaryCard
          data={weeklySummary}
          colors={colors}
          currencySymbol={currencySymbol}
          convertAmount={convertAmount}
          onPress={() => navigation.navigate('WeeklySummary')}
        />
      )}

      {/* FİNANSAL SKOR KARTI */}
      {financialScore && (
        <FinancialScoreCard
          data={financialScore}
          colors={colors}
          onPress={() => navigation.navigate('FinancialScore')}
        />
      )}

      {/* AKSİYON BUTONLARI */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionRow} contentContainerStyle={{ paddingRight: 24 }}>
         <ActionButton icon="add-circle-outline" label={t.addReceipt} onPress={() => navigation.navigate('AddReceipt')} styles={styles} />
         <ActionButton icon="pie-chart-outline" label={t.reports} onPress={() => navigation.navigate('Reports')} styles={styles} />
         <ActionButton icon="wallet-outline" label={t.budget} onPress={() => navigation.navigate('Budget')} styles={styles} />
         <ActionButton icon="repeat-outline" label={t.recurring || 'Tekrar'} onPress={() => navigation.navigate('Recurring')} styles={styles} />
         <ActionButton icon="trophy-outline" label={t.savingsGoal || 'Hedef'} onPress={() => navigation.navigate('SavingsGoal')} styles={styles} />
         <ActionButton icon="download-outline" label={t.export} onPress={handleExport} styles={styles} />
      </ScrollView>

      <View style={styles.sectionHeader}>
         <Text style={styles.sectionTitle}>{t.recentTransactions}</Text>
         <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.seeAllText}>{t.seeAll}</Text>
         </TouchableOpacity>
      </View>
    </View>
  );

  // 7. ANA RENDER (Sadece Optimize FlatList)
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'}/>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1, justifyContent: 'center' }} />
      ) : (
        <FlatList
          data={receipts.slice(0,5)}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.container, { paddingBottom: tabBarPadding }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>{t.noTransactions}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

// --- YARDIMCI COMPONENTLER ---

function ForecastCard({ forecast, colors, t, currencySymbol, convertAmount }) {
  const { forecast_amount, current_month_spent, based_on_months, confidence } = forecast;

  const confidenceColor = confidence === 'high' ? '#00C853' : confidence === 'medium' ? '#FF9800' : '#9E9E9E';
  const confidenceLabel = confidence === 'high'
    ? t.forecastConfidenceHigh
    : confidence === 'medium'
    ? t.forecastConfidenceMedium
    : t.forecastConfidenceLow;
  const progress = forecast_amount > 0 ? Math.min(current_month_spent / forecast_amount, 1) : 0;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: s(16),
      padding: s(16),
      marginBottom: vs(16),
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: s(8),
      elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginBottom: vs(4) }}>{t.forecastTitle}</Text>
          <Text style={{ fontSize: ms(22), fontWeight: '700', color: colors.textMain }}>
            {forecast_amount != null ? `${currencySymbol}${formatTR(convertAmount(forecast_amount))}` : t.forecastInsufficient}
          </Text>
        </View>
        <View style={{ borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: vs(4), backgroundColor: confidenceColor + '20' }}>
          <Text style={{ fontSize: ms(11), fontWeight: '600', color: confidenceColor }}>{confidenceLabel}</Text>
        </View>
      </View>

      {forecast_amount != null && (
        <>
          <View style={{ height: vs(6), backgroundColor: colors.border, borderRadius: s(3), marginTop: vs(12), marginBottom: vs(6), overflow: 'hidden' }}>
            <View style={{ height: '100%', backgroundColor: Colors.primary, borderRadius: s(3), width: `${progress * 100}%` }} />
          </View>
          <Text style={{ fontSize: ms(11), color: colors.textSecondary }}>
            {t.forecastSpentSoFar}: {currencySymbol}{formatTR(convertAmount(current_month_spent))}
            {based_on_months > 0 ? ` · ${t.forecastBasedOn(based_on_months)}` : ` · ${t.forecastProjection}`}
          </Text>
        </>
      )}
    </View>
  );
}

function SavingsGoalCard({ progress, colors, currencySymbol, convertAmount, onPress }) {
  const { goal, saved_amount, progress_percent } = progress;
  const target = parseFloat(goal.target_amount);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: s(16), padding: s(16), marginBottom: vs(16),
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: s(8), elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(12) }}>
        <View style={{
          width: s(36), height: s(36), borderRadius: s(10),
          backgroundColor: Colors.primary + '15',
          alignItems: 'center', justifyContent: 'center', marginRight: s(10),
        }}>
          <Ionicons name="trophy-outline" size={s(20)} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: ms(13), color: colors.textSecondary }}>Tasarruf Hedefi</Text>
          <Text style={{ fontSize: ms(15), fontWeight: '700', color: colors.textMain }}>{goal.title}</Text>
        </View>
        <Text style={{ fontSize: ms(16), fontWeight: '700', color: Colors.primary }}>%{progress_percent}</Text>
      </View>

      <View style={{ height: vs(6), backgroundColor: colors.border, borderRadius: s(3), overflow: 'hidden', marginBottom: vs(8) }}>
        <View style={{ height: '100%', backgroundColor: Colors.primary, borderRadius: s(3), width: `${progress_percent}%` }} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: ms(12), color: colors.textSecondary }}>
          {currencySymbol}{formatShortTR(convertAmount(saved_amount))} biriktirilen
        </Text>
        <Text style={{ fontSize: ms(12), color: colors.textSecondary }}>
          Hedef: {currencySymbol}{formatShortTR(convertAmount(target))}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function WeeklySummaryCard({ data, colors, currencySymbol, convertAmount, onPress }) {
  const { this_week, last_week, change_percent } = data;
  const isUp = change_percent > 0;
  const isDown = change_percent < 0;
  const changeColor = isUp ? '#FF5252' : isDown ? '#2ECC71' : colors.textSecondary;
  const changeIcon = isUp ? 'trending-up' : isDown ? 'trending-down' : 'remove';

  const shortMonth = (m) => {
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return months[m];
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()} ${shortMonth(d.getMonth())}`;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.card,
        borderRadius: s(16), padding: s(16), marginBottom: vs(16),
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: s(8), elevation: 2,
      }}
    >
      {/* Başlık satırı */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(12) }}>
        <View style={{
          width: s(36), height: s(36), borderRadius: s(10),
          backgroundColor: Colors.primary + '15',
          alignItems: 'center', justifyContent: 'center', marginRight: s(10),
        }}>
          <Ionicons name="bar-chart-outline" size={s(20)} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: ms(13), color: colors.textSecondary }}>Haftalık Özet</Text>
          <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(1) }}>
            {fmtDate(this_week.start_date)} – {fmtDate(this_week.end_date)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
      </View>

      {/* Bu hafta vs geçen hafta */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: ms(11), color: colors.textSecondary, marginBottom: vs(2) }}>Bu Hafta</Text>
          <Text style={{ fontSize: ms(20), fontWeight: '800', color: colors.textMain }}>
            {currencySymbol}{formatShortTR(convertAmount(this_week.total))}
          </Text>
        </View>

        {/* Değişim badge */}
        {change_percent != null && (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: changeColor + '15',
            borderRadius: s(20), paddingHorizontal: s(10), paddingVertical: vs(6),
          }}>
            <Ionicons name={changeIcon} size={14} color={changeColor} style={{ marginRight: s(4) }} />
            <Text style={{ fontSize: ms(13), fontWeight: '700', color: changeColor }}>
              %{Math.abs(change_percent)}
            </Text>
          </View>
        )}

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: ms(11), color: colors.textSecondary, marginBottom: vs(2) }}>Geçen Hafta</Text>
          <Text style={{ fontSize: ms(15), fontWeight: '600', color: colors.textSecondary }}>
            {currencySymbol}{formatShortTR(convertAmount(last_week.total))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FinancialScoreCard({ data, colors, onPress }) {
  const gradeColor = data.grade_color || Colors.primary;

  // Mini gauge yüzdesi
  const pct = Math.min(data.total_score / 100, 1);
  const barWidth = `${Math.round(pct * 100)}%`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.card,
        borderRadius: s(16), padding: s(16), marginBottom: vs(16),
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: s(8), elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Skor dairesi */}
        <View style={{
          width: s(56), height: s(56), borderRadius: s(28),
          backgroundColor: gradeColor + '15',
          borderWidth: 2, borderColor: gradeColor,
          alignItems: 'center', justifyContent: 'center',
          marginRight: s(14),
        }}>
          <Text style={{ fontSize: ms(20), fontWeight: '900', color: gradeColor }}>
            {data.grade}
          </Text>
          <Text style={{ fontSize: ms(10), fontWeight: '700', color: gradeColor, lineHeight: ms(12) }}>
            {data.total_score}
          </Text>
        </View>

        {/* Sağ taraf */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: ms(14), fontWeight: '700', color: colors.textMain }}>
              Finansal Skor
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
          </View>
          <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(2), marginBottom: vs(8) }}>
            {data.grade_label} · {data.total_score}/100 puan
          </Text>
          {/* Mini progress bar */}
          <View style={{ height: vs(5), backgroundColor: colors.border, borderRadius: s(3) }}>
            <View style={{
              height: vs(5), backgroundColor: gradeColor,
              borderRadius: s(3), width: barWidth,
            }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ActionButton({ icon, label, onPress, styles }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={24} color={Colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransactionItem({ title, date, amount, icon, color, isIncome, isAnomaly, styles, colors, t }) {
  return (
    <View style={styles.transactionItem}>
       <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={24} color={color} />
       </View>
       <View style={styles.transDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.transTitle}>{title}</Text>
            {isAnomaly && (
              <View style={anomalyBadgeStyle}>
                <Text style={anomalyBadgeTextStyle}>{t.anomaly}</Text>
              </View>
            )}
          </View>
          <Text style={styles.transDate}>{date}</Text>
       </View>
       <Text style={[styles.transAmount, { color: isIncome ? '#00C853' : colors.textMain }]}>
         {amount}
       </Text>
    </View>
  );
}

function formatAmount(value) {
  return formatShortTR(value);
}

const unreadBadgeStyle = {
  position: 'absolute',
  top: -vs(4),
  right: -s(4),
  backgroundColor: '#FF5252',
  borderRadius: s(8),
  minWidth: s(16),
  height: vs(16),
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: s(3),
};

const unreadBadgeTextStyle = {
  color: '#fff',
  fontSize: ms(10),
  fontWeight: '700',
};

const anomalyBadgeStyle = {
  backgroundColor: '#FFF3E0',
  borderRadius: s(4),
  paddingHorizontal: s(5),
  paddingVertical: vs(2),
};

const anomalyBadgeTextStyle = {
  fontSize: ms(10),
  color: '#E65100',
  fontWeight: '600',
};

export default DashboardScreen;
