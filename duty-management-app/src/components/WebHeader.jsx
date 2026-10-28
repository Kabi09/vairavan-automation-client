import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { usePWAInstall } from '../utils/pwaUtils';
import { useResponsive } from '../hooks/useResponsive';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const WebHeader = ({ navigation, activeTab, onTabSelect, onRefresh, isRefreshing }) => {
  const { user, isAdmin } = useAuth();
  const { unreadCount, unreadDocumentCount } = useNotifications();
  const { canInstall, promptInstall, isOnline } = usePWAInstall();
  const { isDesktop, isTablet } = useResponsive();

  // Show only on tablet and desktop screens (or web)
  if (!isDesktop && !isTablet) return null;

  return (
    <View style={styles.headerRoot}>
      <View style={styles.headerInner}>
        {/* Left: Brand Identity */}
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.brandTextWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.brandTitle}>VairaWorks</Text>
              <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeStaff]}>
                <Text style={[styles.roleBadgeText, isAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextStaff]}>
                  {isAdmin ? 'Admin' : 'Staff'}
                </Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Duty Management System</Text>
          </View>
        </View>

        {/* Right: Actions, Status & Profile */}
        <View style={styles.actionsRow}>
          {/* Offline indicator if disconnected */}
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline" size={14} color="#DC2626" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}

          {/* PWA Install Button */}
          {canInstall && (
            <TouchableOpacity
              style={styles.installBtn}
              onPress={promptInstall}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={15} color="#FFFFFF" />
              <Text style={styles.installBtnText}>Install App</Text>
            </TouchableOpacity>
          )}

          {/* Manual Refresh */}
          {onRefresh && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onRefresh}
              disabled={isRefreshing}
              activeOpacity={0.7}
              title="Refresh Data"
            >
              <Ionicons
                name="refresh"
                size={18}
                color={isRefreshing ? COLORS.textMuted : COLORS.primary}
              />
            </TouchableOpacity>
          )}

          {/* User Profile Pill */}
          <View style={styles.profilePill}>
            <View style={styles.avatarCircle}>
              {user?.avatar?.url || user?.avatar ? (
                <Image
                  source={{ uri: typeof user.avatar === 'string' ? user.avatar : user.avatar.url }}
                  style={styles.avatarImg}
                />
              ) : (
                <Text style={styles.avatarInitials}>
                  {(user?.employeeName || user?.name || 'U').slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.employeeName || user?.name || 'User'}
              </Text>
              <Text style={styles.profileId} numberOfLines={1}>
                {user?.employeeId || user?.email || ''}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerRoot: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeAdmin: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  roleBadgeStaff: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  roleBadgeTextAdmin: {
    color: '#1E40AF',
  },
  roleBadgeTextStaff: {
    color: '#15803D',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  offlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  installBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  profileTextWrap: {
    maxWidth: 140,
  },
  profileName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  profileId: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
});

export default WebHeader;

