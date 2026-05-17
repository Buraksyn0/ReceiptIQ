import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import { useCurrency } from '../../../Context/CurrencyContext';
import { AuthContext } from '../../../Context/AuthContext';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { CATEGORIES } from '../../../Constants/Categories';
import { formatTR } from '../../../Constants/Formatters';
import { s, vs, ms } from '../../../Constants/Responsive';

function WeeklySummaryScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { currencySymbol, convertAmount } = useCurrency();
  const { userToken } = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(apiUrl('/analytics/weekly-summary'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getDate()} ${shortMonth(s.getMonth())} – ${e.getDate()} ${shortMonth(e.getMonth())}`;
  };

  const shortMonth = (m) => {
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return months[m];
  };

  const changeColor = data?.change_percent == null
    ? colors.textSecondary
    : data.change_percent > 0 ? '#FF5252' : '#2ECC71';

  const changeIcon = data?.change_percent == null
    ? 'remove'
    : data.change_percent > 0 ? 'trending-up' : 'trending-down';

  const changeText = data?.change_percent == null
    ? 'İlk haftan'
    : data.change_percent === 0
      ? 'Geçen haftayla aynı'
      : `Geçen haftadan %${Math.abs(data.change_percent)} ${data.change_percent > 0 ? 'fazla' : 'az'}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: s(20), paddingVertical: vs(14),
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: colors.card, padding: s(8),
            borderRadius: s(12), marginRight: s(14),
          }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textMain} />
        </TouchableOpacity>
        <View>
          <Text style={{ fontSize: ms(18), fontWeight: '800', color: colors.textMain }}>
            Haftalık Özet
          </Text>
          {data && (
            <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(2) }}>
              {formatDateRange(data.this_week.start_date, data.this_week.end_date)}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: s(32) }}>
          <Ionicons name="wifi-outline" size={48} color={colors.placeholder} />
          <Text style={{ color: colors.textSecondary, marginTop: vs(12), fontSize: ms(15), textAlign: 'center' }}>
            Özet yüklenemedi.
          </Text>
          <TouchableOpacity
            onPress={fetchSummary}
            style={{
              marginTop: vs(16), backgroundColor: Colors.primary,
              paddingHorizontal: s(24), paddingVertical: vs(12), borderRadius: s(12),
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: ms(14) }}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: s(20), paddingBottom: vs(60) }}
          showsVerticalScrollIndicator={false}
        >
          {/* ANA TOPLAM KART */}
          <View style={{
            backgroundColor: Colors.primary,
            borderRadius: s(24), padding: s(24), marginBottom: vs(16),
            shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3, shadowRadius: s(16), elevation: 10,
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: ms(13), fontWeight: '500', marginBottom: vs(6) }}>
              Bu Hafta Toplam Harcama
            </Text>
            <Text style={{ color: '#fff', fontSize: ms(38), fontWeight: '800', letterSpacing: 0.5 }}>
              {currencySymbol}{formatTR(convertAmount(data.this_week.total))}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: ms(13), marginTop: vs(4) }}>
              {data.this_week.transaction_count} işlem
            </Text>

            {/* DEĞİŞİM SATIRI */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: vs(16), paddingTop: vs(14),
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
            }}>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: s(8), padding: s(6), marginRight: s(10),
              }}>
                <Ionicons name={changeIcon} size={16} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: ms(13), fontWeight: '600', flex: 1 }}>
                {changeText}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: ms(12) }}>
                Geçen: {currencySymbol}{formatTR(convertAmount(data.last_week.total))}
              </Text>
            </View>
          </View>

          {/* GEÇEN HAFTA ÖZET SATIRI */}
          <View style={{
            backgroundColor: colors.card, borderRadius: s(16),
            padding: s(16), marginBottom: vs(16),
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{
              backgroundColor: Colors.primary + '12', borderRadius: s(12),
              padding: s(10), marginRight: s(14),
            }}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: ms(13), color: colors.textSecondary, fontWeight: '500' }}>
                Geçen Hafta
              </Text>
              <Text style={{ fontSize: ms(13), color: colors.textSecondary, marginTop: vs(1) }}>
                {formatDateRange(data.last_week.start_date, data.last_week.end_date)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: ms(16), fontWeight: '700', color: colors.textMain }}>
                {currencySymbol}{formatTR(convertAmount(data.last_week.total))}
              </Text>
              <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(2) }}>
                {data.last_week.transaction_count} işlem
              </Text>
            </View>
          </View>

          {/* TOP KATEGORİLER */}
          {data.top_categories.length > 0 && (
            <>
              <Text style={{
                fontSize: ms(15), fontWeight: '700', color: colors.textMain,
                marginBottom: vs(12), marginTop: vs(4),
              }}>
                En Çok Harcanan Kategoriler
              </Text>
              {data.top_categories.map((cat, index) => {
                const catMeta = CATEGORIES.find(c => c.id === cat.category || c.label === cat.category)
                  || CATEGORIES.find(c => c.id === 'other');
                return (
                  <View
                    key={index}
                    style={{
                      backgroundColor: colors.card, borderRadius: s(16),
                      padding: s(16), marginBottom: vs(10),
                      flexDirection: 'row', alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: s(44), height: s(44), borderRadius: s(14),
                      backgroundColor: catMeta.color + '20',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: s(14),
                    }}>
                      <Ionicons name={catMeta.icon} size={20} color={catMeta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: ms(15), fontWeight: '600', color: colors.textMain }}>
                        {catMeta.label}
                      </Text>
                      {/* İlerleme çubuğu */}
                      <View style={{
                        height: vs(4), backgroundColor: colors.border,
                        borderRadius: s(2), marginTop: vs(6),
                      }}>
                        <View style={{
                          height: vs(4), backgroundColor: catMeta.color,
                          borderRadius: s(2), width: `${cat.percentage}%`,
                        }} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: s(12) }}>
                      <Text style={{ fontSize: ms(15), fontWeight: '700', color: colors.textMain }}>
                        {currencySymbol}{formatTR(convertAmount(cat.total))}
                      </Text>
                      <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(2) }}>
                        %{cat.percentage}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* BÜTÇE DURUMU */}
          {data.budget_status && (
            <>
              <Text style={{
                fontSize: ms(15), fontWeight: '700', color: colors.textMain,
                marginBottom: vs(12), marginTop: vs(8),
              }}>
                Bu Ayki Bütçe Durumu
              </Text>
              <View style={{
                backgroundColor: colors.card, borderRadius: s(16), padding: s(16),
                marginBottom: vs(16),
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(10) }}>
                  <Text style={{ fontSize: ms(14), color: colors.textSecondary }}>
                    {currencySymbol}{formatTR(convertAmount(data.budget_status.total_spent))} harcandı
                  </Text>
                  <Text style={{ fontSize: ms(14), fontWeight: '700', color: colors.textMain }}>
                    {currencySymbol}{formatTR(convertAmount(data.budget_status.total_limit))} limit
                  </Text>
                </View>
                <View style={{
                  height: vs(8), backgroundColor: colors.border,
                  borderRadius: s(4),
                }}>
                  <View style={{
                    height: vs(8), borderRadius: s(4),
                    width: `${Math.min(data.budget_status.percentage, 100)}%`,
                    backgroundColor: data.budget_status.percentage >= 90 ? '#FF5252'
                      : data.budget_status.percentage >= 70 ? '#FF9800'
                      : Colors.primary,
                  }} />
                </View>
                <Text style={{
                  fontSize: ms(12), color: colors.textSecondary,
                  marginTop: vs(8), textAlign: 'right',
                }}>
                  %{data.budget_status.percentage} kullanıldı
                </Text>
              </View>
            </>
          )}

          {/* DETAYLAR BUTONU */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Transactions')}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: Colors.primary + '12', borderRadius: s(16),
              paddingVertical: vs(14), marginTop: vs(4),
              borderWidth: 1, borderColor: Colors.primary + '30',
            }}
          >
            <Ionicons name="list-outline" size={18} color={Colors.primary} style={{ marginRight: s(8) }} />
            <Text style={{ color: Colors.primary, fontSize: ms(15), fontWeight: '700' }}>
              Tüm İşlemleri Gör
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default WeeklySummaryScreen;
