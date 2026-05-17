import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../../Context/ThemeContext';
import { AuthContext } from '../../../Context/AuthContext';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { s, vs, ms } from '../../../Constants/Responsive';

// ── Dairesel gauge ──────────────────────────────────────────────────────────
function ScoreGauge({ score, grade, gradeLabel, gradeColor }) {
  const SIZE = s(180);
  const STROKE = s(14);
  const R = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const progress = Math.min(score / 100, 1);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={{ alignItems: 'center', marginVertical: vs(8) }}>
      <Svg width={SIZE} height={SIZE}>
        {/* Arka plan halkası */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#E8F4F4"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* İlerleme halkası */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={gradeColor}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      {/* Merkez metin */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: ms(48), fontWeight: '900', color: gradeColor, lineHeight: ms(52) }}>
          {grade}
        </Text>
        <Text style={{ fontSize: ms(28), fontWeight: '800', color: '#1A1D1E', marginTop: vs(2) }}>
          {score}
        </Text>
        <Text style={{ fontSize: ms(12), color: '#718096', fontWeight: '600' }}>
          {gradeLabel}
        </Text>
      </View>
    </View>
  );
}

// ── Faktör kartı ────────────────────────────────────────────────────────────
function FactorCard({ factor, colors }) {
  const fillPct = factor.max_score > 0 ? (factor.score / factor.max_score) * 100 : 0;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: s(20), padding: s(16),
      marginBottom: vs(12),
      borderWidth: 1, borderColor: colors.border,
    }}>
      {/* Başlık satırı */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(10) }}>
        <View style={{
          width: s(38), height: s(38), borderRadius: s(12),
          backgroundColor: factor.color + '18',
          alignItems: 'center', justifyContent: 'center',
          marginRight: s(12),
        }}>
          <Ionicons name={factor.icon} size={18} color={factor.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: ms(14), fontWeight: '700', color: colors.textMain }}>
            {factor.label}
          </Text>
          <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(1) }}>
            {factor.description}
          </Text>
        </View>
        {/* Puan rozeti */}
        <View style={{
          backgroundColor: factor.color + '15',
          borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: vs(4),
          borderWidth: 1, borderColor: factor.color + '30',
        }}>
          <Text style={{ fontSize: ms(13), fontWeight: '800', color: factor.color }}>
            {factor.score}/{factor.max_score}
          </Text>
        </View>
      </View>

      {/* İlerleme çubuğu */}
      <View style={{
        height: vs(6), backgroundColor: colors.border,
        borderRadius: s(3), overflow: 'hidden',
      }}>
        <View style={{
          height: vs(6), backgroundColor: factor.color,
          borderRadius: s(3), width: `${fillPct}%`,
        }} />
      </View>
    </View>
  );
}

// ── Ana ekran ───────────────────────────────────────────────────────────────
export default function FinancialScoreScreen({ navigation }) {
  const { colors } = useTheme();
  const { userToken } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { fetchScore(); }, []);

  const fetchScore = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(apiUrl('/analytics/financial-score'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: ms(18), fontWeight: '800', color: colors.textMain }}>
            Finansal Skor
          </Text>
          <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: vs(2) }}>
            Son 30 günün özeti
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('FinancialScoreChat')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: s(6),
            backgroundColor: Colors.primary + '15',
            paddingHorizontal: s(12), paddingVertical: vs(8),
            borderRadius: s(20), borderWidth: 1, borderColor: Colors.primary + '30',
          }}
        >
          <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
          <Text style={{ fontSize: ms(13), fontWeight: '700', color: Colors.primary }}>
            Asistan
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: s(32) }}>
          <Ionicons name="wifi-outline" size={48} color={colors.placeholder} />
          <Text style={{ color: colors.textSecondary, marginTop: vs(12), fontSize: ms(15), textAlign: 'center' }}>
            Skor yüklenemedi.
          </Text>
          <TouchableOpacity
            onPress={fetchScore}
            style={{
              marginTop: vs(16), backgroundColor: Colors.primary,
              paddingHorizontal: s(24), paddingVertical: vs(12), borderRadius: s(12),
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: ms(14) }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : data && (
        <ScrollView
          contentContainerStyle={{ padding: s(20), paddingBottom: vs(60) }}
          showsVerticalScrollIndicator={false}
        >
          {/* GAUGE KARTI */}
          <View style={{
            backgroundColor: colors.card, borderRadius: s(24),
            padding: s(24), marginBottom: vs(16),
            alignItems: 'center',
            borderWidth: 1, borderColor: colors.border,
            shadowColor: data.grade_color, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12, shadowRadius: s(12), elevation: 4,
          }}>
            <ScoreGauge
              score={data.total_score}
              grade={data.grade}
              gradeLabel={data.grade_label}
              gradeColor={data.grade_color}
            />
            <Text style={{
              fontSize: ms(14), color: colors.textSecondary,
              textAlign: 'center', marginTop: vs(4),
            }}>
              100 üzerinden hesaplanan finansal sağlık skorun
            </Text>
          </View>

          {/* AI ASİSTAN BANNER */}
          <TouchableOpacity
            onPress={() => navigation.navigate('FinancialScoreChat')}
            style={{
              backgroundColor: Colors.primary,
              borderRadius: s(20), padding: s(16),
              marginBottom: vs(16),
              flexDirection: 'row', alignItems: 'center', gap: s(14),
              shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25, shadowRadius: s(8), elevation: 4,
            }}
          >
            <View style={{
              width: s(44), height: s(44), borderRadius: s(22),
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="sparkles" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: ms(15), fontWeight: '800', color: '#fff' }}>
                Finansal Asistan
              </Text>
              <Text style={{ fontSize: ms(12), color: 'rgba(255,255,255,0.8)', marginTop: vs(2) }}>
                Skorunu nasıl iyileştireceğini sor
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* FAKTÖRLER */}
          <Text style={{
            fontSize: ms(15), fontWeight: '700', color: colors.textMain,
            marginBottom: vs(12),
          }}>
            Faktör Dağılımı
          </Text>
          {data.factors.map(factor => (
            <FactorCard key={factor.id} factor={factor} colors={colors} />
          ))}

          {/* İYİLEŞTİRME ÖNERİLERİ */}
          {data.tips.length > 0 && (
            <>
              <Text style={{
                fontSize: ms(15), fontWeight: '700', color: colors.textMain,
                marginTop: vs(8), marginBottom: vs(12),
              }}>
                Öneriler
              </Text>
              <View style={{
                backgroundColor: colors.card, borderRadius: s(20),
                padding: s(16), borderWidth: 1, borderColor: colors.border,
              }}>
                {data.tips.map((tip, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row', alignItems: 'flex-start',
                      paddingVertical: vs(10),
                      borderBottomWidth: i < data.tips.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{
                      width: s(28), height: s(28), borderRadius: s(14),
                      backgroundColor: Colors.primary + '15',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: s(12), marginTop: vs(1),
                    }}>
                      <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
                    </View>
                    <Text style={{
                      flex: 1, fontSize: ms(13), color: colors.textMain,
                      lineHeight: ms(19), fontWeight: '500',
                    }}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
