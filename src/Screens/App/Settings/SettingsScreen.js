import React, { useState, useContext, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, SafeAreaView, TouchableOpacity, ScrollView,
  Switch, Alert, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Colors from '../../../Constants/Colors';
import { apiUrl, API_BASE_URL } from '../../../Constants/Config';
import { CURRENCIES, getCurrencyName } from '../../../Constants/Currencies';
import { filterCities } from '../../../Constants/Cities';
import { PHONE_CODES, getDefaultPhoneCode } from '../../../Constants/PhoneCodes';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import { useCurrency } from '../../../Context/CurrencyContext';
import { useBiometric } from '../../../Context/BiometricContext';
import { useDateFormat, DATE_FORMATS } from '../../../Context/DateFormatContext';
import createStyles from './SettingsStyles';
import { s, vs, ms } from '../../../Constants/Responsive';

function SettingItem({ icon, label, color, onPress, isToggle, value, onToggle, styles, colors, rightLabel }) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={isToggle ? onToggle : onPress}
      activeOpacity={isToggle ? 1 : 0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.settingText}>{label}</Text>
      {isToggle ? (
        <Switch
          trackColor={{ false: '#767577', true: color }}
          thumbColor={value ? '#fff' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={onToggle}
          value={value}
        />
      ) : rightLabel ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Text style={{ fontSize: ms(14), color: colors?.textSecondary, fontWeight: '500' }}>{rightLabel}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors?.placeholder || '#AAB8C2'} />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors?.placeholder || '#AAB8C2'} />
      )}
    </TouchableOpacity>
  );
}

function BottomSheetPicker({ visible, onClose, title, items, currentCode, onSelect, colors }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: s(24),
            borderTopRightRadius: s(24),
            paddingTop: vs(12),
            paddingBottom: vs(40),
          }}>
            {/* Drag handle */}
            <View style={{
              width: s(40), height: vs(4), borderRadius: s(2),
              backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: vs(20),
            }} />
            <Text style={{
              fontSize: ms(18), fontWeight: '700',
              color: colors.textMain,
              paddingHorizontal: s(24), marginBottom: vs(16),
            }}>
              {title}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_HEIGHT * 0.55 }}>
              {items.map((item) => {
                const isSelected = currentCode === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: s(24),
                      paddingVertical: vs(14),
                      backgroundColor: isSelected ? Colors.primary + '12' : 'transparent',
                    }}
                    onPress={() => onSelect(item.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: ms(24), marginRight: s(14), width: s(36) }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: ms(16), fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? Colors.primary : colors.textMain,
                      }}>
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginTop: 1 }}>
                        {item.code} · {item.symbol}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProfileField({ label, icon, value, onChange, keyboardType = 'default', autoCapitalize = 'sentences', colors }) {
  return (
    <View style={{ marginBottom: vs(16) }}>
      <Text style={{ fontSize: ms(13), fontWeight: '600', color: colors.textSecondary, marginBottom: vs(6) }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: s(12), borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: s(14), height: vs(50),
      }}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} style={{ marginRight: s(10) }} />
        <TextInput
          style={{ flex: 1, fontSize: ms(15), color: colors.textMain }}
          value={value}
          onChangeText={onChange}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          placeholder={label}
          placeholderTextColor={colors.placeholder}
        />
      </View>
    </View>
  );
}

function CityInput({ label, value, onChange, colors }) {
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);

  const handleChange = (text) => {
    onChange(text);
    setSuggestions(text.length > 0 ? filterCities(text) : []);
  };

  const handleSelect = (city) => {
    onChange(city);
    setSuggestions([]);
  };

  return (
    <View style={{ marginBottom: vs(16) }}>
      <Text style={{ fontSize: ms(13), fontWeight: '600', color: colors.textSecondary, marginBottom: vs(6) }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: s(12),
        borderWidth: 1,
        borderColor: focused ? Colors.primary : colors.border,
        paddingHorizontal: s(14), height: vs(50),
      }}>
        <Ionicons name="location-outline" size={18} color={focused ? Colors.primary : colors.textSecondary} style={{ marginRight: s(10) }} />
        <TextInput
          style={{ flex: 1, fontSize: ms(15), color: colors.textMain }}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 150); }}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder={label}
          placeholderTextColor={colors.placeholder}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => { onChange(''); setSuggestions([]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color={colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {/* Öneri listesi */}
      {suggestions.length > 0 && (
        <View style={{
          backgroundColor: colors.card,
          borderWidth: 1, borderColor: colors.border,
          borderRadius: s(12), marginTop: vs(4),
          overflow: 'hidden',
        }}>
          {suggestions.map((city, index) => (
            <TouchableOpacity
              key={city}
              onPress={() => handleSelect(city)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: s(14), paddingVertical: vs(12),
                borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={15} color={Colors.primary} style={{ marginRight: s(10) }} />
              <Text style={{ fontSize: ms(15), color: colors.textMain }}>{city}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function PhoneInput({ label, value, onChange, colors }) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);

  // Mevcut değerden kodu ayıkla (örn: "+90 555 123 4567" → dialCode: "+90", number: "555 123 4567")
  const parseValue = (val) => {
    if (!val) return { selectedCode: getDefaultPhoneCode(), number: '' };
    const match = PHONE_CODES.find(c => val.startsWith(c.dialCode));
    if (match) {
      return { selectedCode: match, number: val.slice(match.dialCode.length).trim() };
    }
    return { selectedCode: getDefaultPhoneCode(), number: val };
  };

  const { selectedCode, number } = parseValue(value);

  const handleCodeSelect = (item) => {
    setPickerVisible(false);
    setSearch('');
    onChange(number ? `${item.dialCode} ${number}` : item.dialCode);
  };

  const handleNumberChange = (text) => {
    onChange(`${selectedCode.dialCode} ${text}`);
  };

  const filteredCodes = search.trim()
    ? PHONE_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : PHONE_CODES;

  return (
    <View style={{ marginBottom: vs(16) }}>
      <Text style={{ fontSize: ms(13), fontWeight: '600', color: colors.textSecondary, marginBottom: vs(6) }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: s(12), borderWidth: 1,
        borderColor: focused ? Colors.primary : colors.border,
        height: vs(50), overflow: 'hidden',
      }}>
        {/* Ülke kodu butonu */}
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: s(12), height: '100%',
            borderRightWidth: 1, borderRightColor: colors.border,
            gap: s(6),
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: ms(20) }}>{selectedCode.flag}</Text>
          <Text style={{ fontSize: ms(14), fontWeight: '600', color: colors.textMain }}>
            {selectedCode.dialCode}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Numara girişi */}
        <TextInput
          style={{ flex: 1, fontSize: ms(15), color: colors.textMain, paddingHorizontal: s(12) }}
          value={number}
          onChangeText={handleNumberChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          autoCorrect={false}
          placeholder="555 123 4567"
          placeholderTextColor={colors.placeholder}
        />
      </View>

      {/* Ülke kodu seçici modal */}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => { setPickerVisible(false); setSearch(''); }}
        >
          <Pressable onPress={() => {}}>
            <View style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: s(24), borderTopRightRadius: s(24),
              paddingTop: vs(12), paddingBottom: vs(40),
              maxHeight: '75%',
            }}>
              {/* Handle */}
              <View style={{
                width: s(40), height: vs(4), borderRadius: s(2),
                backgroundColor: colors.border, alignSelf: 'center', marginBottom: vs(16),
              }} />

              {/* Arama kutusu */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.background,
                borderRadius: s(12), borderWidth: 1, borderColor: colors.border,
                marginHorizontal: s(20), paddingHorizontal: s(12), height: vs(44), marginBottom: vs(8),
              }}>
                <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={{ marginRight: s(8) }} />
                <TextInput
                  style={{ flex: 1, fontSize: ms(14), color: colors.textMain }}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Ülke ara..."
                  placeholderTextColor={colors.placeholder}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={colors.placeholder} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {filteredCodes.map((item) => {
                  const isSelected = item.code === selectedCode.code;
                  return (
                    <TouchableOpacity
                      key={item.code}
                      onPress={() => handleCodeSelect(item)}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: s(20), paddingVertical: vs(12),
                        backgroundColor: isSelected ? Colors.primary + '12' : 'transparent',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: ms(22), marginRight: s(12), width: s(32) }}>{item.flag}</Text>
                      <Text style={{
                        flex: 1, fontSize: ms(15),
                        color: isSelected ? Colors.primary : colors.textMain,
                        fontWeight: isSelected ? '700' : '400',
                      }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: ms(14), color: colors.textSecondary, fontWeight: '600' }}>
                        {item.dialCode}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function EditProfileModal({ visible, onClose, user, userToken, apiBaseUrl, t, colors, onSaved }) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [city, setCity] = useState(user?.city || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUri, setAvatarUri] = useState(null); // yerel seçilen fotoğraf
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setFullName(user?.full_name || '');
      setCity(user?.city || '');
      setPhone(user?.phone || '');
      setAvatarUri(null);
    }
  }, [visible, user]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.error, 'Galeriye erişim izni gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType ? [ImagePicker.MediaType.IMAGE] : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, 'Ad Soyad boş bırakılamaz.');
      return;
    }
    setLoading(true);
    try {
      // 1. Avatar varsa önce yükle
      if (avatarUri) {
        const formData = new FormData();
        const filename = avatarUri.split('/').pop();
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        formData.append('file', { uri: avatarUri, name: filename, type: mime });
        await fetch(apiUrl('/users/me/avatar'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${userToken}` },
          body: formData,
        });
      }

      // 2. Profil bilgilerini güncelle
      const res = await fetch(apiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
          full_name: trimmedName,
          city: city.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✓', t.profileUpdated);
      onSaved?.();
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, t.serverError);
    } finally {
      setLoading(false);
    }
  };

  // Mevcut avatar URL'si (backend'den gelen)
  const currentAvatarUrl = user?.avatar_url
    ? `${apiBaseUrl}${user.avatar_url}`
    : null;
  const displayAvatar = avatarUri || currentAvatarUrl;
  const canSave = fullName.trim().length > 0 && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={onClose}
        >
          <Pressable onPress={() => {}}>
            <ScrollView
              style={{ backgroundColor: colors.card, borderTopLeftRadius: s(24), borderTopRightRadius: s(24) }}
              contentContainerStyle={{ padding: s(24), paddingBottom: vs(48) }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Handle */}
              <View style={{
                width: s(40), height: vs(4), borderRadius: s(2),
                backgroundColor: colors.border, alignSelf: 'center', marginBottom: vs(20),
              }} />

              <Text style={{ fontSize: ms(20), fontWeight: '700', color: colors.textMain, marginBottom: vs(24) }}>
                {t.editProfileTitle}
              </Text>

              {/* Avatar seçici */}
              <TouchableOpacity
                onPress={handlePickAvatar}
                style={{ alignItems: 'center', marginBottom: vs(24) }}
                activeOpacity={0.8}
              >
                <View style={{
                  width: s(90), height: s(90), borderRadius: s(28),
                  backgroundColor: Colors.primary + '15',
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  borderWidth: 2, borderColor: Colors.primary + '40',
                }}>
                  {displayAvatar ? (
                    <Image
                      source={{ uri: displayAvatar }}
                      style={{ width: s(90), height: s(90), borderRadius: s(28) }}
                    />
                  ) : (
                    <Ionicons name="person" size={36} color={Colors.primary} />
                  )}
                </View>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', marginTop: vs(8), gap: s(4),
                }}>
                  <Ionicons name="camera-outline" size={14} color={Colors.primary} />
                  <Text style={{ fontSize: ms(13), color: Colors.primary, fontWeight: '600' }}>
                    {t.changePhoto}
                  </Text>
                </View>
              </TouchableOpacity>

              <ProfileField
                label={t.fullName}
                icon="person-outline"
                value={fullName}
                onChange={setFullName}
                autoCapitalize="words"
                colors={colors}
              />
              <CityInput
                label={t.cityLabel}
                value={city}
                onChange={setCity}
                colors={colors}
              />
              <PhoneInput
                label={t.phoneLabel}
                value={phone}
                onChange={setPhone}
                colors={colors}
              />

              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                style={{
                  backgroundColor: canSave ? Colors.primary : Colors.primary + '55',
                  borderRadius: s(14), height: vs(52),
                  alignItems: 'center', justifyContent: 'center',
                  marginTop: vs(8),
                }}
              >
                <Text style={{ color: '#fff', fontSize: ms(16), fontWeight: '700' }}>
                  {loading ? '...' : t.save}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChangePasswordModal({ visible, onClose, userEmail, userToken, t, colors }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const reset = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (newPw !== confirmPw) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, t.passwordMismatch); return;
    }
    if (newPw.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, t.passwordTooShort); return;
    }

    setLoading(true);
    try {
      // 1. Mevcut şifreyi doğrula
      const formData = new FormData();
      formData.append('username', userEmail);
      formData.append('password', currentPw);
      const loginRes = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        body: formData,
      });
      if (!loginRes.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t.error, t.wrongCurrentPassword);
        setLoading(false);
        return;
      }

      // 2. Yeni şifreyi güncelle
      const updateRes = await fetch(apiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ password: newPw }),
      });
      if (!updateRes.ok) throw new Error();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✓', t.passwordChanged);
      handleClose();
    } catch (e) {
      Alert.alert(t.error, t.serverError);
    } finally {
      setLoading(false);
    }
  };

  const PasswordField = ({ label, value, onChange, show, onToggle }) => (
    <View style={{ marginBottom: vs(16) }}>
      <Text style={{ fontSize: ms(13), fontWeight: '600', color: colors.textSecondary, marginBottom: vs(6) }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: s(12), borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: s(14), height: vs(50),
      }}>
        <TextInput
          style={{ flex: 1, fontSize: ms(15), color: colors.textMain }}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.placeholder}
          placeholder="••••••"
        />
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const canSave = currentPw.length > 0 && newPw.length >= 6 && confirmPw.length >= 6 && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={handleClose}
        >
          <Pressable onPress={() => {}}>
            <View style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: s(24), borderTopRightRadius: s(24),
              padding: s(24), paddingBottom: vs(40),
            }}>
              {/* Handle */}
              <View style={{
                width: s(40), height: vs(4), borderRadius: s(2),
                backgroundColor: colors.border, alignSelf: 'center', marginBottom: vs(20),
              }} />

              <Text style={{ fontSize: ms(20), fontWeight: '700', color: colors.textMain, marginBottom: vs(24) }}>
                {t.changePassword}
              </Text>

              <PasswordField
                label={t.currentPassword}
                value={currentPw}
                onChange={setCurrentPw}
                show={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
              />
              <PasswordField
                label={t.newPassword}
                value={newPw}
                onChange={setNewPw}
                show={showNew}
                onToggle={() => setShowNew(v => !v)}
              />
              <PasswordField
                label={t.confirmNewPassword}
                value={confirmPw}
                onChange={setConfirmPw}
                show={showConfirm}
                onToggle={() => setShowConfirm(v => !v)}
              />

              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                style={{
                  backgroundColor: canSave ? Colors.primary : Colors.primary + '55',
                  borderRadius: s(14), height: vs(52),
                  alignItems: 'center', justifyContent: 'center',
                  marginTop: vs(8),
                }}
              >
                <Text style={{ color: '#fff', fontSize: ms(16), fontWeight: '700' }}>
                  {loading ? '...' : t.save}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SettingsScreen({ navigation }) {
  const tabBarHeight = useBottomTabBarHeight();
  const { user, userToken, logout, refreshUser } = useContext(AuthContext);
  const { isDarkMode, colors } = useTheme();
  const { t, language } = useLanguage();
  const { currency, currencySymbol } = useCurrency();
  const { biometricEnabled, isSupported: biometricSupported, toggleBiometric } = useBiometric();
  const { dateFormat, setDateFormat } = useDateFormat();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [darkModeLocal, setDarkModeLocal] = useState(user?.theme_preference === 'dark');
  const [isNotifications, setIsNotifications] = useState(true);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [dateFormatPickerVisible, setDateFormatPickerVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const showComingSoon = (feature) => {
    Alert.alert(t.comingSoon, t.comingSoonMsg(feature));
  };

  const handleThemeToggle = async () => {
    const next = !darkModeLocal;
    setDarkModeLocal(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch(apiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ theme_preference: next ? 'dark' : 'light' }),
      });
      refreshUser?.();
    } catch (e) {}
  };

  const handleLanguageSelect = async (langCode) => {
    setLangPickerVisible(false);
    if (langCode === language) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch(apiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ language_preference: langCode }),
      });
      refreshUser?.();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, t.serverError);
    }
  };

  const handleCurrencySelect = async (currencyCode) => {
    setCurrencyPickerVisible(false);
    if (currencyCode === currency) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch(apiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ currency_preference: currencyCode }),
      });
      refreshUser?.();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, t.serverError);
    }
  };

  const handleDateFormatSelect = async (fmt) => {
    setDateFormatPickerVisible(false);
    if (fmt === dateFormat) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDateFormat(fmt);
    try {
      await fetch(apiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ date_format_preference: fmt }),
      });
      refreshUser?.();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.error, t.serverError);
    }
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      t.deleteAccountTitle,
      t.deleteAccountMsg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.deleteAccountConfirm,
          style: 'destructive',
          onPress: async () => {
            try {
              const r = await fetch(apiUrl('/users/me'), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (r.ok || r.status === 204) {
                await logout();
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(t.error, t.accountDeleteError);
              }
            } catch (e) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t.error, t.serverError);
            }
          },
        },
      ],
    );
  };

  const langLabels = { tr: t.languageTr, en: t.languageEn, de: t.languageDe, fr: t.languageFr, ru: t.languageRu };
  const currentLangLabel = langLabels[language] || t.languageTr;
  const currentCurrencyLabel = `${currency} (${currencySymbol})`;

  const languageItems = [
    { code: 'tr', label: t.languageTr, flag: '🇹🇷', symbol: '' },
    { code: 'en', label: t.languageEn, flag: '🇺🇸', symbol: '' },
    { code: 'de', label: t.languageDe, flag: '🇩🇪', symbol: '' },
    { code: 'fr', label: t.languageFr, flag: '🇫🇷', symbol: '' },
    { code: 'ru', label: t.languageRu, flag: '🇷🇺', symbol: '' },
  ];

  const currencyItems = CURRENCIES.map(c => ({
    code: c.code,
    symbol: c.symbol,
    label: getCurrencyName(c.code, language),
    flag: c.flag,
  }));

  const displayName = user?.full_name || 'Kullanıcı';
  const displayEmail = user?.email || '—';
  const displayCity = user?.city;
  const displayPhone = user?.phone;
  const displayAvatar = user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}` : null;
  const memberSinceText = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(
        language === 'tr' ? 'tr-TR' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'ru' ? 'ru-RU' : 'en-US',
        { month: 'long', year: 'numeric' }
      )
    : null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 50 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{t.settings}</Text>

        {/* Profil Kartı */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={[styles.avatar, { overflow: 'hidden' }]}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={{ width: s(60), height: s(60), borderRadius: s(18) }} />
            ) : (
              <Ionicons name="person" size={30} color={Colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{displayEmail}</Text>
            {displayCity ? (
              <Text style={[styles.email, { fontSize: ms(12), marginTop: vs(2) }]}>
                <Ionicons name="location-outline" size={11} color={colors.textSecondary} /> {displayCity}
              </Text>
            ) : null}
            {displayPhone ? (
              <Text style={[styles.email, { fontSize: ms(12), marginTop: vs(2) }]}>
                <Ionicons name="call-outline" size={11} color={colors.textSecondary} /> {displayPhone}
              </Text>
            ) : null}
            {memberSinceText ? (
              <Text style={[styles.email, { fontSize: ms(11), marginTop: vs(4), color: colors.placeholder }]}>
                {t.memberSince} {memberSinceText}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.editIcon} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEditProfileVisible(true);
          }}>
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t.sectionGeneral}</Text>

        <SettingItem
          icon="moon-outline"
          label={t.darkMode}
          color="#5C6BC0"
          isToggle
          value={isDarkMode}
          onToggle={handleThemeToggle}
          styles={styles}
          colors={colors}
        />

        <SettingItem
          icon="notifications-outline"
          label={t.notifications}
          color="#FFA726"
          isToggle
          value={isNotifications}
          onToggle={() => setIsNotifications(!isNotifications)}
          styles={styles}
          colors={colors}
        />

        <SettingItem
          icon="language-outline"
          label={t.language}
          color="#26A69A"
          onPress={() => setLangPickerVisible(true)}
          rightLabel={currentLangLabel}
          styles={styles}
          colors={colors}
        />

        <SettingItem
          icon="cash-outline"
          label={t.currency}
          color="#FF7043"
          onPress={() => setCurrencyPickerVisible(true)}
          rightLabel={currentCurrencyLabel}
          styles={styles}
          colors={colors}
        />

        <SettingItem
          icon="calendar-outline"
          label={t.dateFormat}
          color="#42A5F5"
          onPress={() => setDateFormatPickerVisible(true)}
          rightLabel={dateFormat}
          styles={styles}
          colors={colors}
        />

        <SettingItem
          icon="pricetags-outline"
          label="Etiketlerim"
          color="#8B5CF6"
          onPress={() => navigation.navigate('Tags')}
          styles={styles}
          colors={colors}
        />

        <Text style={styles.sectionTitle}>{t.sectionSecurity}</Text>

        <SettingItem
          icon="lock-closed-outline"
          label={t.changePassword}
          color="#EF5350"
          onPress={() => setChangePasswordVisible(true)}
          styles={styles}
          colors={colors}
        />

        {biometricSupported && (
          <SettingItem
            icon="finger-print-outline"
            label={t.faceId}
            color="#8D6E63"
            isToggle
            value={biometricEnabled}
            onToggle={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await toggleBiometric(!biometricEnabled);
            }}
            styles={styles}
            colors={colors}
          />
        )}

        <SettingItem
          icon="shield-checkmark-outline"
          label={t.privacyPolicy}
          color="#78909C"
          onPress={() => navigation.navigate('Policy', { type: 'privacy' })}
          styles={styles}
          colors={colors}
        />

        <SettingItem
          icon="document-text-outline"
          label={t.termsOfService}
          color="#AB47BC"
          onPress={() => navigation.navigate('Policy', { type: 'terms' })}
          styles={styles}
          colors={colors}
        />

        <Text style={styles.sectionTitle}>{t.sectionDangerZone}</Text>

        <SettingItem
          icon="trash-outline"
          label={t.deleteAccount}
          color={Colors.error}
          onPress={handleDeleteAccount}
          styles={styles}
          colors={colors}
        />

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(t.logOutTitle, t.logOutMsg, [
              { text: t.cancel, style: 'cancel' },
              { text: t.logOutConfirm, style: 'destructive', onPress: () => logout() },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={24} color={Colors.error} />
          <Text style={styles.logoutText}>{t.logOut}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Dil Seçici */}
      <BottomSheetPicker
        visible={langPickerVisible}
        onClose={() => setLangPickerVisible(false)}
        title={t.selectLanguage}
        items={languageItems}
        currentCode={language}
        onSelect={handleLanguageSelect}
        colors={colors}
      />

      {/* Para Birimi Seçici */}
      <BottomSheetPicker
        visible={currencyPickerVisible}
        onClose={() => setCurrencyPickerVisible(false)}
        title={t.selectCurrency}
        items={currencyItems}
        currentCode={currency}
        onSelect={handleCurrencySelect}
        colors={colors}
      />

      {/* Tarih Formatı Seçici */}
      <BottomSheetPicker
        visible={dateFormatPickerVisible}
        onClose={() => setDateFormatPickerVisible(false)}
        title={t.selectDateFormat}
        items={DATE_FORMATS.map(f => ({
          code: f.key,
          label: f.key,
          flag: '📅',
          symbol: f.example,
        }))}
        currentCode={dateFormat}
        onSelect={handleDateFormatSelect}
        colors={colors}
      />

      {/* Profil Düzenle */}
      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        user={user}
        userToken={userToken}
        apiBaseUrl={API_BASE_URL}
        t={t}
        colors={colors}
        onSaved={refreshUser}
      />

      {/* Şifre Değiştir */}
      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
        userEmail={user?.email}
        userToken={userToken}
        t={t}
        colors={colors}
      />
    </SafeAreaView>
  );
}

export default SettingsScreen;
