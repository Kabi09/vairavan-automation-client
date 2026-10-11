import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { formatDate } from '../../utils/dateUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

export const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLetters}>
              {(user?.employeeName || 'U').substring(0, 2).toUpperCase()}
            </Text>
          </View>
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
          <Text style={styles.sectionTitle}>Account Details</Text>

          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Employee ID</Text>
              <Text style={styles.infoValue}>{user?.employeeId || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <View>
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
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primarySubtle,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
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
});

export default ProfileScreen;
