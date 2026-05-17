import React, { useState, useContext, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Alert, StyleSheet,
  KeyboardAvoidingView, Platform, Keyboard, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../../Context/AuthContext';
import { useTheme } from '../../../Context/ThemeContext';
import Colors from '../../../Constants/Colors';
import { apiUrl } from '../../../Constants/Config';
import { s, vs, ms } from '../../../Constants/Responsive';

const PRESET_COLORS = [
  '#008080', '#00A878', '#3B82F6', '#8B5CF6',
  '#EC4899', '#EF4444', '#F97316', '#EAB308',
  '#14B8A6', '#6366F1', '#84CC16', '#06B6D4',
];

export default function TagsScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Düzenleme modu
  const [editingTag, setEditingTag] = useState(null); // null = yeni oluştur

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/tags/'), {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.ok) setTags(await res.json());
    } catch { }
    finally { setLoading(false); }
  }, [userToken]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const openCreateModal = () => {
    setEditingTag(null);
    setTagName('');
    setSelectedColor(PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setSelectedColor(tag.color);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingTag(null);
    setTagName('');
    setSelectedColor(PRESET_COLORS[0]);
  };

  const saveTag = async () => {
    if (!tagName.trim()) return;
    setSaving(true);
    try {
      if (editingTag) {
        // GÜNCELLE
        const res = await fetch(apiUrl(`/tags/${editingTag.id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ name: tagName.trim(), color: selectedColor }),
        });
        if (res.ok) {
          const updated = await res.json();
          setTags(prev => prev.map(t => t.id === updated.id ? updated : t));
          closeModal();
        }
      } else {
        // OLUŞTUR
        const res = await fetch(apiUrl('/tags/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ name: tagName.trim(), color: selectedColor }),
        });
        if (res.ok) {
          const newTag = await res.json();
          setTags(prev => [...prev, newTag]);
          closeModal();
        }
      }
    } catch { }
    finally { setSaving(false); }
  };

  const deleteTag = (tag) => {
    Alert.alert(
      'Etiketi Sil',
      `"${tag.name}" etiketini silmek istediğinden emin misin? Bu işlem fişlerden de kaldırır.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive', onPress: async () => {
            try {
              const res = await fetch(apiUrl(`/tags/${tag.id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok || res.status === 204) {
                setTags(prev => prev.filter(t => t.id !== tag.id));
              }
            } catch { }
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Etiketlerim</Text>
          <Text style={styles.headerSub}>Fişlerini organize et</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* LİSTE */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : tags.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pricetags-outline" size={56} color={colors.placeholder} />
          <Text style={styles.emptyTitle}>Henüz etiket yok</Text>
          <Text style={styles.emptyDesc}>
            Fişlerini organize etmek için etiket oluştur.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal}>
            <Text style={styles.emptyBtnText}>İlk Etiketi Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: s(20), paddingBottom: vs(40) }}>
          {tags.map(tag => (
            <View key={tag.id} style={styles.tagRow}>
              <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
              <Text style={styles.tagName}>{tag.name}</Text>
              <TouchableOpacity onPress={() => openEditModal(tag)} style={styles.actionBtn}>
                <Ionicons name="pencil-outline" size={17} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTag(tag)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={17} color={colors.placeholder} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ETİKET MODAL (Oluştur / Düzenle) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={() => { Keyboard.dismiss(); closeModal(); }}>
            <Pressable onPress={() => {}}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {editingTag ? 'Etiketi Düzenle' : 'Yeni Etiket'}
                </Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Etiket adı (örn: İş, Tatil, Aile)"
                  placeholderTextColor={colors.placeholder}
                  value={tagName}
                  onChangeText={setTagName}
                  maxLength={50}
                  autoFocus
                />

                <Text style={styles.colorLabel}>Renk Seç</Text>
                <View style={styles.colorGrid}>
                  {PRESET_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorDot,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorDotSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      {selectedColor === color && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Önizleme */}
                <View style={styles.previewRow}>
                  <View style={[styles.previewChip, { backgroundColor: selectedColor + '20', borderColor: selectedColor + '50' }]}>
                    <View style={[styles.previewDot, { backgroundColor: selectedColor }]} />
                    <Text style={[styles.previewText, { color: selectedColor }]}>
                      {tagName.trim() || 'Önizleme'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, (!tagName.trim() || saving) && { opacity: 0.5 }]}
                    onPress={saveTag}
                    disabled={!tagName.trim() || saving}
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveText}>{editingTag ? 'Kaydet' : 'Oluştur'}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(20), paddingVertical: vs(14),
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: {
    backgroundColor: colors.background, padding: s(8),
    borderRadius: s(12), marginRight: s(14),
  },
  headerTitle: { fontSize: ms(18), fontWeight: '800', color: colors.textMain },
  headerSub: { fontSize: ms(12), color: colors.textSecondary, marginTop: vs(1) },
  addBtn: {
    width: s(40), height: s(40), borderRadius: s(20),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(32) },
  emptyTitle: { fontSize: ms(17), fontWeight: '700', color: colors.textMain, marginTop: vs(16) },
  emptyDesc: { fontSize: ms(14), color: colors.textSecondary, textAlign: 'center', marginTop: vs(8) },
  emptyBtn: {
    marginTop: vs(20), backgroundColor: Colors.primary,
    paddingHorizontal: s(24), paddingVertical: vs(12), borderRadius: s(12),
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },

  tagRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: s(16),
    paddingHorizontal: s(16), paddingVertical: vs(14),
    marginBottom: vs(10), borderWidth: 1, borderColor: colors.border,
  },
  tagDot: { width: s(14), height: s(14), borderRadius: s(7), marginRight: s(12) },
  tagName: { flex: 1, fontSize: ms(15), fontWeight: '600', color: colors.textMain },
  actionBtn: { padding: s(6), marginLeft: s(4) },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card, borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28), padding: s(24), paddingBottom: vs(24),
  },
  modalTitle: {
    fontSize: ms(18), fontWeight: '800', color: colors.textMain,
    marginBottom: vs(16),
  },
  modalInput: {
    backgroundColor: colors.background, borderRadius: s(14),
    paddingHorizontal: s(16), paddingVertical: vs(12),
    fontSize: ms(15), color: colors.textMain,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: vs(20),
  },
  colorLabel: {
    fontSize: ms(13), fontWeight: '700', color: colors.textSecondary,
    marginBottom: vs(12),
  },
  colorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: s(10),
    marginBottom: vs(20),
  },
  colorDot: {
    width: s(36), height: s(36), borderRadius: s(18),
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  previewRow: { alignItems: 'flex-start', marginBottom: vs(24) },
  previewChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(12), paddingVertical: vs(6),
    borderRadius: s(20), borderWidth: 1, gap: s(6),
  },
  previewDot: { width: s(8), height: s(8), borderRadius: s(4) },
  previewText: { fontSize: ms(13), fontWeight: '600' },

  modalActions: { flexDirection: 'row', gap: s(12) },
  cancelBtn: {
    flex: 1, paddingVertical: vs(14), borderRadius: s(14),
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: ms(15), fontWeight: '600', color: colors.textSecondary },
  saveBtn: {
    flex: 2, paddingVertical: vs(14), borderRadius: s(14),
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveText: { fontSize: ms(15), fontWeight: '700', color: '#fff' },
});
