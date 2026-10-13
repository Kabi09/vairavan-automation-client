import React from 'react';
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

/**
 * Reusable modal popup showing a smooth loading spinner while exporting PDF or Excel
 */
export const ExportLoadingModal = ({ visible, type = 'PDF', message = '' }) => {
  if (!visible) return null;

  const isExcel = type?.toLowerCase?.() === 'excel' || type?.toLowerCase?.() === 'csv';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, isExcel ? styles.excelCircle : styles.pdfCircle]}>
            <Ionicons
              name={isExcel ? 'grid' : 'document-text'}
              size={28}
              color={isExcel ? '#059669' : '#DC2626'}
            />
          </View>

          <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />

          <Text style={styles.title}>
            {isExcel ? 'Generating Spreadsheet...' : 'Preparing PDF Report...'}
          </Text>

          <Text style={styles.subtitle}>
            {message ||
              (isExcel
                ? 'Compiling duty records into Excel format. Please wait...'
                : 'Formatting records and embedding assets. Please wait...')}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.lg,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pdfCircle: {
    backgroundColor: '#FEE2E2',
  },
  excelCircle: {
    backgroundColor: '#D1FAE5',
  },
  spinner: {
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ExportLoadingModal;
