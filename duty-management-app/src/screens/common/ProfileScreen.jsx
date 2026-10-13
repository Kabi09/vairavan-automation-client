import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import authApi from '../../api/authApi';
import uploadApi from '../../api/uploadApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { formatDate } from '../../utils/dateUtils';
import { isValidEmail, isValidPhone } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

export const ProfileScreen = ({ navigation }) => {
  const { user, logout, updateProfile } = useAuth();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit contact info state (Phone and Email only)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setLoggingOut(false);
      setLogoutModalVisible(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll access is required to upload a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        setUploadingAvatar(true);

        const uploadRes = await uploadApi.uploadAvatar(localUri);
        if (uploadRes?.data?.avatar?.url) {
          const avatarUrl = uploadRes.data.avatar.url;
          const profileRes = await authApi.updateProfile({ avatar: avatarUrl });
          if (profileRes?.data?.user) {
            updateProfile(profileRes.data.user);
          } else {
            updateProfile({ ...user, avatar: avatarUrl });
          }
          Alert.alert('Avatar Updated', 'Your profile picture has been updated successfully.');
        }
      }
    } catch (err) {
      Alert.alert('Upload Failed', extractErrorMessage(err, 'Failed to update avatar photo. Please try again.'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openEditModal = () => {
    setEditPhone(user?.phoneNumber || '');
    setEditEmail(user?.email || '');
    setEditError('');
    setEditModalVisible(true);
  };

  const handleSaveContact = async () => {
    const cleanEmail = editEmail.trim().toLowerCase();
    const cleanPhone = editPhone.trim().replace(/\D/g, '').slice(-10);

    if (!cleanEmail) {
      setEditError('Email address is required');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setEditError('Please enter a valid email address');
      return;
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      setEditError('Phone number must be exactly 10 digits');
      return;
    }

    setSavingProfile(true);
    setEditError('');
    try {
      const res = await authApi.updateProfile({
        email: cleanEmail,
        phoneNumber: cleanPhone,
      });

      if (res?.data?.user) {
        updateProfile(res.data.user);
      } else {
        updateProfile({ ...user, email: cleanEmail, phoneNumber: cleanPhone });
      }

      setEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your phone number and email have been saved successfully.');
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Failed to update contact info'));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="My Profile"
        subtitle={APP_CONFIG.COMPANY_NAME}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileHeaderCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            disabled={uploadingAvatar}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLetters}>
                  {(user?.employeeName || 'U').substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.employeeName}</Text>
          <Text style={styles.profileDesignation}>
            {user?.designation || (user?.role === 'admin' ? 'Administrator' : 'Service Technician')}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{user?.role?.toUpperCase()}</Text>
            </View>
            <StatusBadge status={user?.accountStatus || 'active'} />
          </View>
        </Card>

        {/* Account Details */}
        <Card style={styles.detailsCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={openEditModal}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Employee ID (Read Only)</Text>
              <Text style={styles.infoValue}>{user?.employeeId || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoValue}>{user?.phoneNumber || 'Not provided'}</Text>
            </View>
          </View>

          {user?.address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
              <View>
                <Text style={styles.infoLabel}>Branch / Address</Text>
                <Text style={styles.infoValue}>{user.address}</Text>
              </View>
            </View>
          ) : null}

          {user?.joiningDate ? (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
              <View>
                <Text style={styles.infoLabel}>Joining Date</Text>
                <Text style={styles.infoValue}>{formatDate(user.joiningDate)}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Security & Actions */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Security & Settings</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="key-outline" size={20} color={COLORS.text} style={styles.infoIcon} />
              <Text style={styles.settingText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </Card>

        {/* Logout Button */}
        <SecondaryButton
          title="Sign Out"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />}
          onPress={() => setLogoutModalVisible(true)}
          style={styles.logoutButton}
        />
      </ScrollView>

      {/* Edit Contact Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Contact Info</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Update your email address and 10-digit mobile number. Name and credentials remain managed by administration.
            </Text>

            {editError ? <ErrorMessage message={editError} style={{ marginBottom: SPACING.md }} /> : null}

            <TextInputField
              label="Email Address *"
              placeholder="e.g. employee@vairavan.com"
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <TextInputField
              label="Phone Number (10 digits)"
              placeholder="e.g. 9876543210"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              maxLength={10}
              icon="call-outline"
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                style={{ flex: 1, marginRight: SPACING.sm }}
                disabled={savingProfile}
              />
              <PrimaryButton
                title={savingProfile ? 'Saving...' : 'Save'}
                onPress={handleSaveContact}
                loading={savingProfile}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation */}
      <ConfirmationDialog
        visible={logoutModalVisible}
        title="Sign Out"
        message="Are you sure you want to log out of your session on this device?"
        confirmText="Sign Out"
        confirmVariant="danger"
        loading={loggingOut}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  profileHeaderCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySubtle,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  avatarLetters: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileDesignation: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  roleTag: {
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  detailsCard: {
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySubtle,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  infoIcon: {
    marginRight: SPACING.md,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  logoutButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});

export default ProfileScreen;
