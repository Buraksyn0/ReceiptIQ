import React, { useState, useRef, useContext, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Linking,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { AuthContext } from '../../../Context/AuthContext';
import { s, vs, ms } from '../../../Constants/Responsive';

/**
 * ScanScreen
 *
 * Akış:
 *   1. Kullanıcı kamera ile foto çeker veya galeriden seçer
 *   2. ImageManipulator ile yeniden boyutlandır + JPEG'e çevir (HEIC sorunu, dosya boyutu)
 *   3. multipart POST /receipts/upload
 *   4. 202 yanıt + upload_id → ReviewReceipt ekranına geç
 */
function ScanScreen() {
  const navigation = useNavigation();
  const { userToken } = useContext(AuthContext);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const tabBarHeight = useBottomTabBarHeight();

  const [flashOn, setFlashOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Ekran ilk açıldığında izin sor
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const goToReview = (uploadId) => {
    navigation.navigate('ReviewReceipt', { uploadId });
  };

  /**
   * Görseli optimize et: max 1600px uzun kenar, JPEG, %80 kalite.
   * HEIC -> JPEG dönüşümü de bu sayede otomatik olur.
   */
  const optimizeImage = async (uri) => {
    return ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
  };

  const uploadImage = async (uri) => {
    setBusy(true);
    try {
      const optimized = await optimizeImage(uri);

      const formData = new FormData();
      formData.append('file', {
        uri: optimized.uri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });

      const response = await fetch(apiUrl('/receipts/upload/'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          // 'Content-Type' DEĞİL — fetch FormData için kendisi belirler
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok || response.status === 202) {
        goToReview(data.id);
      } else {
        Alert.alert(
          'Yükleme başarısız',
          data?.detail || `HTTP ${response.status}`
        );
      }
    } catch (e) {
      Alert.alert('Hata', `Yükleme hatası: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    try {
      setBusy(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      await uploadImage(photo.uri);
    } catch (e) {
      setBusy(false);
      Alert.alert('Kamera hatası', e.message);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('İzin gerekli', 'Galeriye erişim izni vermen gerekiyor.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType ? [ImagePicker.MediaType.IMAGE] : ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (asset?.uri) {
        await uploadImage(asset.uri);
      }
    } catch (e) {
      Alert.alert('Hata', e.message);
    }
  };

  // === Render States ===
  if (!permission) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.fullCenter}>
        <Ionicons name="camera-outline" size={64} color={Colors.textSecondary} />
        <Text style={styles.permTitle}>Kamera erişimi gerekli</Text>
        <Text style={styles.permText}>
          Fişlerini tarayabilmemiz için kameraya erişim vermen gerekiyor.
        </Text>
        <TouchableOpacity
          style={styles.permButton}
          onPress={() => {
            if (permission.canAskAgain) requestPermission();
            else Linking.openSettings();
          }}
        >
          <Text style={styles.permButtonText}>
            {permission.canAskAgain ? 'İzin ver' : 'Ayarları aç'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permButton, styles.altButton]}
          onPress={handlePickFromGallery}
        >
          <Ionicons
            name="images-outline"
            size={18}
            color={Colors.primary}
            style={{ marginRight: s(8) }}
          />
          <Text style={[styles.permButtonText, { color: Colors.primary }]}>
            Galeriden seç
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flashOn ? 'on' : 'off'}
        zoom={0}
      />

      {/* Üst overlay — geri butonu + başlık + flash */}
      <SafeAreaView style={styles.topOverlay}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.flashBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Fiş Tara</Text>
          <TouchableOpacity
            style={styles.flashBtn}
            onPress={() => setFlashOn((v) => !v)}
          >
            <Ionicons
              name={flashOn ? 'flash' : 'flash-off'}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Tarama çerçevesi (görsel rehber) */}
      <View pointerEvents="none" style={styles.frameContainer}>
        <View style={styles.frame} />
      </View>

      {/* Alt kontroller */}
      <SafeAreaView style={styles.bottomOverlay}>
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handlePickFromGallery}
            disabled={busy}
          >
            <Ionicons name="images" size={26} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, busy && { opacity: 0.5 }]}
            onPress={handleCapture}
            disabled={busy}
            activeOpacity={0.7}
          >
            {busy ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <View style={styles.captureBtnInner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => navigation.navigate('AddReceipt')}
            disabled={busy}
          >
            <Ionicons name="create-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.controlHint}>
          {busy
            ? 'Fişin taranıyor, lütfen bekle…'
            : 'Fişinizi çerçeveye yerleştirin ve butona basın'}
        </Text>
        {!busy && (
          <Text style={[styles.controlHint, { marginTop: 4, opacity: 0.5 }]}>
            Manuel giriş için sağdaki kalem ikonuna tıklayın
          </Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  fullCenter: {
    flex: 1,
    backgroundColor: '#0F1922',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(24),
  },
  permTitle: {
    color: '#fff',
    fontSize: ms(22),
    fontWeight: '700',
    marginTop: vs(18),
    textAlign: 'center',
  },
  permText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(14),
    textAlign: 'center',
    marginTop: vs(10),
    marginBottom: vs(24),
    lineHeight: vs(20),
  },
  permButton: {
    backgroundColor: Colors.primary,
    paddingVertical: vs(14),
    paddingHorizontal: s(32),
    borderRadius: s(14),
    minWidth: s(200),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: vs(10),
  },
  altButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  permButtonText: {
    color: '#fff',
    fontSize: ms(16),
    fontWeight: '700',
  },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: s(20),
    paddingTop: Platform.OS === 'android' ? vs(30) : 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
  },
  topTitle: {
    color: '#fff',
    fontSize: ms(15),
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    borderRadius: s(14),
  },
  flashBtn: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '78%',
    aspectRatio: 0.7,
    borderWidth: 2,
    borderColor: 'rgba(0, 200, 200, 0.7)',
    borderRadius: s(22),
    backgroundColor: 'rgba(0,128,128,0.06)',
  },

  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: s(30),
  },
  sideBtn: {
    width: s(52),
    height: s(52),
    borderRadius: s(26),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: s(84),
    height: s(84),
    borderRadius: s(42),
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: s(66),
    height: s(66),
    borderRadius: s(33),
    backgroundColor: Colors.primary,
  },
  controlHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(12),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: vs(14),
  },
});

export default ScanScreen;
