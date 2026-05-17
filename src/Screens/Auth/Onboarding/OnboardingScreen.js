import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, SafeAreaView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { s, vs, ms } from '../../../Constants/Responsive';
import Colors from '../../../Constants/Colors';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'camera',
    title: 'Fişlerini Saniyeler\nİçinde Tara',
    subtitle: 'Kameranı aç, fişe tut — yapay zeka tutarı, tarihi ve kategoriyi otomatik okusun.',
    bg: '#008080',
    bgLight: '#00A89880',
    bgDark: '#00666650',
    accent: 'rgba(207,250,244,',
  },
  {
    id: '2',
    icon: 'bar-chart',
    title: 'Harcamalarını\nTakip Et',
    subtitle: 'Kategori bazlı grafikler ve aylık trendlerle paranı nereye harcadığını gör.',
    bg: '#1A7A4A',
    bgLight: '#22A05E80',
    bgDark: '#145C3750',
    accent: 'rgba(198,247,226,',
  },
  {
    id: '3',
    icon: 'wallet',
    title: 'Bütçeni Kendin\nBelirle',
    subtitle: 'Kategorilere bütçe limiti koy, aşmaya yaklaşınca seni uyaralım.',
    bg: '#7B3FA0',
    bgLight: '#9B55C080',
    bgDark: '#5C2C7850',
    accent: 'rgba(237,220,255,',
  },
  {
    id: '4',
    icon: 'notifications',
    title: 'Akıllı\nBildirimler',
    subtitle: 'Bütçen dolmak üzereyken veya alışılmadık bir harcama görünce seni anında uyarırız.',
    bg: '#C4610A',
    bgLight: '#E07A2880',
    bgDark: '#96480650',
    accent: 'rgba(255,237,200,',
  },
  {
    id: '5',
    icon: null,
    icons: ['scan', 'finger-print'],
    title: 'Güvenle\nKoru',
    subtitle: 'Face ID veya parmak izi ile saniyeler içinde giriş yap. Verilerini yalnızca sen görebilirsin.',
    bg: '#1A2A4A',
    bgLight: '#2A3D6880',
    bgDark: '#0F1C3250',
    accent: 'rgba(200,215,255,',
  },
  {
    id: '6',
    icon: 'pie-chart',
    title: 'Detaylı\nRaporlar',
    subtitle: 'Aylık ve kategori bazlı raporlarla paranın nereye gittiğini net bir şekilde gör.',
    bg: '#5A3E8A',
    bgLight: '#7A55B080',
    bgDark: '#3E2A6250',
    accent: 'rgba(230,215,255,',
  },
  {
    id: '7',
    icon: 'globe',
    title: 'Her Para\nBiriminde',
    subtitle: 'TL, Dolar, Euro ve daha fazlası — hangi ülkede olursan ol fişlerini kaydet.',
    bg: '#A02020',
    bgLight: '#C0353580',
    bgDark: '#78181850',
    accent: 'rgba(255,215,210,',
  },
  {
    id: '8',
    icon: 'sparkles',
    title: 'AI Asistanınla\nKonuş',
    subtitle: '"Bu ay en çok neye harcadım?" gibi sorularına anında, akıllı yanıtlar al.',
    bg: '#1A5FA0',
    bgLight: '#2272BC80',
    bgDark: '#12467850',
    accent: 'rgba(200,230,255,',
  },
];

export default function OnboardingScreen({ navigation }) {
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // ── Animasyon değerleri ──────────────────────────────────
  // useNativeDriver: true  → sadece transform + opacity
  const iconScale    = useRef(new Animated.Value(0.7)).current;
  const iconOpacity  = useRef(new Animated.Value(0)).current;
  const floatAnim    = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(0.8)).current;

  // useNativeDriver: false → sadece backgroundColor (renk geçişi)
  const bgAnim = useRef(new Animated.Value(0)).current;

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4, 5, 6, 7],
    outputRange: ['#008080', '#1A7A4A', '#7B3FA0', '#C4610A', '#1A2A4A', '#5A3E8A', '#A02020', '#1A5FA0'],
  });

  // ── Arka plan renk geçişi ────────────────────────────────
  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: activeIndex,
      duration: 500,
      useNativeDriver: false, // renk animasyonu, native driver desteklemez
    }).start();
  }, [activeIndex]);

  // ── İkon + buton giriş animasyonu ───────────────────────
  useEffect(() => {
    iconScale.setValue(0.6);
    iconOpacity.setValue(0);
    btnScale.setValue(0.7);

    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex]);

  // ── Sürekli salınım animasyonu ───────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -14, duration: 1900, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 1900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Navigasyon ───────────────────────────────────────────
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('SignIn');
  };

  const isLast = activeIndex === SLIDES.length - 1;
  const slide  = SLIDES[activeIndex];

  return (
    <View style={styles.container}>

      {/* ── Renkli üst alan ─────────────────────────────────
          backgroundColor: bgAnim (useNativeDriver: false)
          Burada HİÇBİR transform/opacity yok → karışma yok  */}
      <Animated.View style={[styles.topArea, { backgroundColor: bgColor }]}>

        {/* Dekoratif daireler — statik renkli, sadece backgroundColor */}
        <View style={[styles.circle1, { backgroundColor: slide.bgLight }]} />
        <View style={[styles.circle2, { backgroundColor: slide.bgDark }]} />
        <View style={[styles.circle3, { backgroundColor: slide.bgLight }]} />

        {/* Skip */}
        <SafeAreaView style={styles.skipWrap}>
          {!isLast && (
            <TouchableOpacity onPress={finish} style={styles.skipBtn}>
              <Text style={styles.skipText}>Geç</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* İkon alanı — transform + opacity (useNativeDriver: true)
            backgroundColor'ı animated value DEĞİL, sabit string → karışma yok */}
        <View style={styles.iconArea}>
          <Animated.View style={{
            transform: [{ translateY: floatAnim }, { scale: iconScale }],
            opacity: iconOpacity,
          }}>
            {slide.icons ? (
              /* İki ikon yan yana */
              <View style={[styles.iconRing2, { backgroundColor: slide.accent + '22)' }]}>
                <View style={[styles.iconRing1, { backgroundColor: slide.accent + '38)', flexDirection: 'row', gap: s(14) }]}>
                  {slide.icons.map((icn, idx) => (
                    <View key={idx} style={[styles.iconWrapSmall, { backgroundColor: slide.accent + '55)' }]}>
                      <Ionicons name={icn} size={ms(40)} color="#fff" />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              /* Tek ikon */
              <View style={[styles.iconRing2, { backgroundColor: slide.accent + '22)' }]}>
                <View style={[styles.iconRing1, { backgroundColor: slide.accent + '38)' }]}>
                  <View style={[styles.iconWrap, { backgroundColor: slide.accent + '55)' }]}>
                    <Ionicons name={slide.icon} size={ms(64)} color="#fff" />
                  </View>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Dekoratif nokta grupları */}
          <View style={[styles.dotGroup, styles.dotGroupTL]}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.smallDot, { backgroundColor: slide.accent + '80)', marginLeft: i * s(14) }]} />
            ))}
          </View>
          <View style={[styles.dotGroup, styles.dotGroupBR]}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.smallDot, { backgroundColor: slide.accent + '80)', marginLeft: i * s(14) }]} />
            ))}
          </View>
        </View>

        {/* Dalga */}
        <View style={styles.wave} />
      </Animated.View>

      {/* ── Alt beyaz alan ───────────────────────────────── */}
      <View style={styles.bottomArea}>

        <FlatList
          ref={flatRef}
          data={SLIDES}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={{ flexGrow: 0 }}
          renderItem={({ item }) => (
            <View style={styles.textSlide}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          )}
        />

        {/* Dots — backgroundColor: bgColor (useNativeDriver: false)
            HİÇBİR transform yok → karışma yok */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && [styles.dotActive, { backgroundColor: bgColor }],
              ]}
            />
          ))}
        </View>

        {/* Buton — transform: scale (useNativeDriver: true)
            backgroundColor sabit string → karışma yok */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          {isLast ? (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: slide.bg }]}
              onPress={finish}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>Başla</Text>
              <View style={styles.startArrow}>
                <Ionicons name="arrow-forward" size={ms(18)} color={slide.bg} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: slide.bg }]}
              onPress={goNext}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-forward" size={ms(22)} color="#fff" />
            </TouchableOpacity>
          )}
        </Animated.View>

      </View>
    </View>
  );
}

const TOP_HEIGHT = height * 0.52;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  topArea: { height: TOP_HEIGHT, overflow: 'hidden' },
  circle1: {
    position: 'absolute', width: s(340), height: s(340),
    borderRadius: s(170), top: -s(100), right: -s(80),
  },
  circle2: {
    position: 'absolute', width: s(220), height: s(220),
    borderRadius: s(110), bottom: vs(30), left: -s(70),
  },
  circle3: {
    position: 'absolute', width: s(130), height: s(130),
    borderRadius: s(65), top: vs(50), left: s(20),
  },
  skipWrap: {
    alignItems: 'flex-end', paddingRight: s(20),
    paddingTop: Platform.OS === 'android' ? vs(12) : 0,
  },
  skipBtn: {
    paddingVertical: vs(7), paddingHorizontal: s(16),
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: s(20),
  },
  skipText: { color: '#fff', fontSize: ms(14), fontWeight: '600' },
  iconArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconRing2: { width: s(200), height: s(200), borderRadius: s(100), alignItems: 'center', justifyContent: 'center' },
  iconRing1: { width: s(160), height: s(160), borderRadius: s(80),  alignItems: 'center', justifyContent: 'center' },
  iconWrap:  { width: s(118), height: s(118), borderRadius: s(38),  alignItems: 'center', justifyContent: 'center' },
  iconWrapSmall: { width: s(80), height: s(80), borderRadius: s(26), alignItems: 'center', justifyContent: 'center' },
  dotGroup: { position: 'absolute', flexDirection: 'row' },
  dotGroupTL: { top: vs(12), left: s(28) },
  dotGroupBR: { bottom: vs(36), right: s(28) },
  smallDot: { width: s(7), height: s(7), borderRadius: s(4) },
  wave: {
    position: 'absolute', bottom: -vs(28), left: -s(20), right: -s(20),
    height: vs(60), borderTopLeftRadius: s(40), borderTopRightRadius: s(40),
    backgroundColor: '#F7FAFC',
  },
  bottomArea: {
    flex: 1, backgroundColor: '#F7FAFC', alignItems: 'center',
    paddingTop: vs(18), paddingBottom: vs(36),
  },
  textSlide: { width, paddingHorizontal: s(36), alignItems: 'center' },
  title: {
    fontSize: ms(26), fontWeight: '800', color: '#1A1D1E',
    textAlign: 'center', lineHeight: ms(34), marginBottom: vs(14),
  },
  subtitle: { fontSize: ms(15), color: '#718096', textAlign: 'center', lineHeight: ms(23) },
  dotsRow: { flexDirection: 'row', gap: s(8), marginTop: vs(22), marginBottom: vs(22) },
  dot: { width: s(8), height: s(8), borderRadius: s(4), backgroundColor: '#CBD5E0' },
  dotActive: { width: s(28), borderRadius: s(4) },
  nextBtn: {
    width: s(62), height: s(62), borderRadius: s(31),
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: s(8),
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(44), paddingVertical: vs(18),
    borderRadius: s(22), elevation: 6, shadowOpacity: 0.25, shadowRadius: s(10), gap: s(12),
  },
  startBtnText: { color: '#fff', fontSize: ms(18), fontWeight: '800' },
  startArrow: {
    width: s(32), height: s(32), borderRadius: s(16),
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
});
