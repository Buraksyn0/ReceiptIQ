import React, { useState, useCallback, useContext, useMemo } from 'react';
import {
  View, Text, SafeAreaView, StyleSheet,
  ScrollView, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { s, vs, ms } from '../../../Constants/Responsive';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import { useCurrency } from '../../../Context/CurrencyContext';
import { CATEGORIES } from '../../../Constants/Categories';
import { formatTR, formatShortTR } from '../../../Constants/Formatters';

function ReportsScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { currencySymbol, convertAmount } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [monthly, setMonthly] = useState(null);   // Faz 5: aylık veri

  // Veriyi çek
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [receiptRes, monthlyRes] = await Promise.all([
        fetch(apiUrl('/receipts/'), { headers: { Authorization: `Bearer ${userToken}` } }),
        fetch(apiUrl('/analytics/monthly'), { headers: { Authorization: `Bearer ${userToken}` } }),
      ]);
      if (receiptRes.ok) setReceipts(await receiptRes.json());
      if (monthlyRes.ok) setMonthly(await monthlyRes.json());
    } catch (error) {
      console.error('Rapor hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  // Kategori analizi (frontend hesaplaması — hız için)
  const analytics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryGroups = {};

    receipts.forEach(item => {
      const amount = parseFloat(item.total_amount) || 0;
      if (item.receipt_type === 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        const catLabel = item.category || 'other';
        categoryGroups[catLabel] = (categoryGroups[catLabel] || 0) + amount;
      }
    });

    let chartData = Object.keys(categoryGroups).map(catLabel => {
      const amount = categoryGroups[catLabel];
      const catMeta = CATEGORIES.find(c => c.label === catLabel || c.id === catLabel)
        || CATEGORIES.find(c => c.id === 'other');
      return {
        value: amount,
        color: catMeta.color,
        label: catMeta.label,
        icon: catMeta.icon,
        percentage: totalExpense > 0 ? formatTR((amount / totalExpense) * 100, 1) : 0,
      };
    }).sort((a, b) => b.value - a.value);

    if (chartData.length === 0) {
      chartData = [{ value: 1, color: '#E2E8F0', label: 'Gider Yok', icon: 'remove-circle-outline', percentage: 0 }];
    }

    return {
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
      savingsRate: totalIncome > 0 ? formatTR(((totalIncome - totalExpense) / totalIncome) * 100, 1) : 0,
      chartData,
    };
  }, [receipts]);

  // Bar grafik verisi
  const barData = useMemo(() => {
    if (!monthly?.months) return [];
    return monthly.months.map(m => {
      const converted = convertAmount(m.total);
      return {
        value: converted,
        label: m.label,
        frontColor: converted > 0 ? Colors.primary : '#E2E8F0',
        topLabelComponent: () =>
          converted > 0 ? (
            <Text style={{ fontSize: 9, color: '#718096', marginBottom: 2 }}>
              {currencySymbol}{formatShortTR(converted)}
            </Text>
          ) : null,
      };
    });
  }, [monthly]);

  // Bu ay vs geçen ay MoM
  const momInfo = useMemo(() => {
    if (!monthly?.months || monthly.months.length < 2) return null;
    const last = monthly.months[monthly.months.length - 1];
    return { change: last.mom_change, label: last.label };
  }, [monthly]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', padding: s(20),
    },
    backBtn: {
      backgroundColor: colors.card, padding: s(8), borderRadius: s(12),
      elevation: 2, shadowColor: '#000', shadowOpacity: 0.05,
    },
    headerTitle: { fontSize: ms(20), fontWeight: '800', color: colors.textMain },
    content: { padding: s(20) },
    chartCard: {
      backgroundColor: colors.card, borderRadius: s(24), padding: s(24),
      alignItems: 'center', elevation: 4,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: s(15),
      marginBottom: vs(20), width: '100%',
    },
    cardTitleRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', width: '100%', marginBottom: vs(20),
    },
    cardTitle: { fontSize: ms(16), fontWeight: '700', color: colors.textSecondary },
    momBadge: {
      flexDirection: 'row', alignItems: 'center', gap: s(3),
      borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: vs(4),
    },
    momText: { fontSize: ms(12), fontWeight: '700' },
    chartWrapper: { marginBottom: vs(30), alignItems: 'center', justifyContent: 'center' },
    legendContainer: {
      width: '100%', borderTopWidth: 1,
      borderTopColor: colors.border, paddingTop: vs(20),
    },
    legendRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: vs(15),
    },
    legendLeft: { flexDirection: 'row', alignItems: 'center' },
    legendIconBox: {
      width: s(36), height: s(36), borderRadius: s(12),
      alignItems: 'center', justifyContent: 'center', marginRight: s(12),
    },
    legendLabel: { fontSize: ms(14), color: colors.textMain, fontWeight: '700' },
    legendPercentage: { fontSize: ms(12), color: colors.textSecondary, fontWeight: '600', marginTop: vs(2) },
    legendAmount: { fontSize: ms(15), fontWeight: '800', color: colors.textMain },
    analysisGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    analysisCard: {
      backgroundColor: colors.card, borderRadius: s(20), padding: s(20),
      alignItems: 'center', width: '48%',
      elevation: 3, shadowColor: '#000', shadowOpacity: 0.04,
    },
    iconBox: { padding: s(12), borderRadius: s(15), marginBottom: vs(12) },
    analysisTitle: { fontSize: ms(13), color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
    analysisValue: { fontSize: ms(18), fontWeight: '800', color: colors.textMain, marginTop: vs(5), textAlign: 'center' },
  }), [colors]);

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.reportsTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* FAZ 5: AYLIK HARCAMA GRAFİĞİ */}
        {barData.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{t.monthlyTrend}</Text>
              {momInfo && momInfo.change != null && (
                <View style={[
                  styles.momBadge,
                  { backgroundColor: momInfo.change > 0 ? '#FFF3E0' : '#E8F5E9' }
                ]}>
                  <Ionicons
                    name={momInfo.change > 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={momInfo.change > 0 ? '#E65100' : '#2E7D32'}
                  />
                  <Text style={[
                    styles.momText,
                    { color: momInfo.change > 0 ? '#E65100' : '#2E7D32' }
                  ]}>
                    {momInfo.change > 0 ? '+' : ''}{momInfo.change}%
                  </Text>
                </View>
              )}
            </View>
            <BarChart
              data={barData}
              barWidth={32}
              spacing={14}
              roundedTop
              roundedBottom
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              noOfSections={3}
              maxValue={Math.max(...barData.map(d => d.value), 100) * 1.2}
              isAnimated
            />
          </View>
        )}

        {/* KATEGORİ PASTA GRAFİĞİ */}
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>{t.categoryDistribution}</Text>
          <View style={styles.chartWrapper}>
            <PieChart
              data={analytics.chartData}
              donut
              showGradient
              sectionAutoFocus
              radius={100}
              innerRadius={65}
              innerCircleColor={colors.card}
              centerLabelComponent={() => (
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textMain }}>
                    {currencySymbol}{formatTR(convertAmount(analytics.expense), 0)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{t.totalExpenseLabel}</Text>
                </View>
              )}
            />
          </View>
          <View style={styles.legendContainer}>
            {analytics.chartData.map((item, index) => (
              <View key={index} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.legendIconBox, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon || 'ellipse'} size={18} color={item.color} />
                  </View>
                  <View>
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendPercentage}>%{item.percentage}</Text>
                  </View>
                </View>
                <Text style={styles.legendAmount}>{currencySymbol}{formatTR(convertAmount(item.value))}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ANALİZ KARTLARI */}
        <View style={styles.analysisGrid}>
          <AnalysisCard
            title={t.totalIncomeCard}
            value={`${currencySymbol}${formatTR(convertAmount(analytics.income), 0)}`}
            icon="arrow-down-circle"
            color="#2ECC71"
            styles={styles}
          />
          <AnalysisCard
            title={t.savingsRate}
            value={`%${analytics.savingsRate}`}
            icon="trending-up"
            color="#4A90E2"
            styles={styles}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const AnalysisCard = ({ title, value, icon, color, styles }) => (
  <View style={styles.analysisCard}>
    <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.analysisTitle}>{title}</Text>
    <Text style={styles.analysisValue}>{value}</Text>
  </View>
);

export default ReportsScreen;
