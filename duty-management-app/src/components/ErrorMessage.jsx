import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const ErrorMessage = ({
  message,
  onRetry,
  style,
}) => {
  if (!message) return null;

  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name="alert-circle-outline"
        size={24}
        color={COLORS.danger}
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <Text style={styles.messageText}>{message}</Text>
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Tap to Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  icon: {
    marginRight: SPACING.sm,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    color: COLORS.danger,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  retryButton: {
    marginTop: SPACING.xs,
  },
  retryText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default ErrorMessage;
