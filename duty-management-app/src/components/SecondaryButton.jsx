import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const SecondaryButton = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'outline', // 'outline' | 'ghost' | 'danger'
  style,
  textStyle,
  icon = null,
}) => {
  const isDisabled = disabled || loading;

  const getVariantStyle = () => {
    switch (variant) {
      case 'danger':
        return styles.dangerButton;
      case 'ghost':
        return styles.ghostButton;
      case 'outline':
      default:
        return styles.outlineButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'danger':
        return styles.dangerText;
      case 'ghost':
      case 'outline':
      default:
        return styles.outlineText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getVariantStyle(),
        isDisabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'danger' ? COLORS.danger : COLORS.primary}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  ghostButton: {
    backgroundColor: COLORS.surfaceAlt,
  },
  dangerButton: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  outlineText: {
    color: COLORS.primary,
  },
  dangerText: {
    color: COLORS.danger,
  },
});

export default SecondaryButton;
