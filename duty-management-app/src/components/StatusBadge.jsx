import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export const StatusBadge = ({ status = 'default', label, size = 'sm' }) => {
  const normalized = String(status).toLowerCase();

  const getTheme = () => {
    switch (normalized) {
      case 'active':
      case 'approved':
        return {
          bg: COLORS.successLight,
          text: COLORS.success,
          dot: COLORS.success,
          display: label || (normalized === 'active' ? 'Active' : 'Approved'),
        };
      case 'pending':
      case 'submitted':
        return {
          bg: COLORS.warningLight,
          text: COLORS.warning,
          dot: COLORS.warning,
          display: label || (normalized === 'pending' ? 'Pending' : 'Submitted'),
        };
      case 'rejected':
      case 'inactive':
      case 'cancelled':
        return {
          bg: COLORS.dangerLight,
          text: COLORS.danger,
          dot: COLORS.danger,
          display:
            label ||
            (normalized === 'rejected'
              ? 'Rejected'
              : normalized === 'inactive'
              ? 'Inactive'
              : 'Cancelled'),
        };
      case 'correction_requested':
        return {
          bg: COLORS.infoLight,
          text: COLORS.info,
          dot: COLORS.info,
          display: label || 'Correction Needed',
        };
      default:
        return {
          bg: COLORS.surfaceAlt,
          text: COLORS.textSecondary,
          dot: COLORS.textMuted,
          display: label || status,
        };
    }
  };

  const theme = getTheme();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: theme.bg },
        isSmall ? styles.badgeSm : styles.badgeMd,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.dot }]} />
      <Text
        style={[
          styles.text,
          { color: theme.text },
          isSmall ? styles.textSm : styles.textMd,
        ]}
      >
        {theme.display}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
  },
  badgeSm: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  textSm: {
    fontSize: 12,
  },
  textMd: {
    fontSize: 13,
  },
});

export default StatusBadge;
