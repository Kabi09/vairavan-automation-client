import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureImage from './SignatureImage';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Fullscreen lightbox modal for viewing proof photos and digital signatures
 */
export const ImageViewerModal = ({
  visible,
  onClose,
  imageUri,
  title = 'Image Preview',
  subtitle = '',
  timestamp = '',
  isSignature = false,
}) => {
  if (!visible || !imageUri) return null;

  // Auto-detect whether image is a signature (SVG format or explicitly flagged)
  const isSvg =
    isSignature ||
    (typeof imageUri === 'string' &&
      (imageUri.startsWith('data:image/svg+xml') ||
        imageUri.trim().startsWith('<svg') ||
        imageUri.toLowerCase().includes('.svg') ||
        imageUri.toLowerCase().includes('signature')));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SafeAreaView style={styles.safeContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.8}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Centered Image / Signature Content */}
          <View style={styles.body}>
            {isSvg ? (
              <View style={styles.signatureCard}>
                <View style={styles.signatureCanvasWrap}>
                  <SignatureImage
                    uri={imageUri}
                    height={Math.min(280, SCREEN_HEIGHT * 0.42)}
                    width="100%"
                    timestamp={timestamp}
                  />
                </View>
                <View style={styles.signatureMetaFooter}>
                  <View style={styles.signatureBadgeRow}>
                    <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                    <Text style={styles.signatureMetaText}>Verified Customer Signature</Text>
                  </View>
                  {timestamp ? (
                    <Text style={styles.signatureTimestampText}>
                      Signed: {timestamp}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>

          {/* Footer with Timestamp and Action */}
          <View style={styles.footer}>
            {timestamp && !isSvg ? (
              <View style={styles.footerTimestampBadge}>
                <Ionicons name="time-outline" size={14} color="#CBD5E1" />
                <Text style={styles.footerTimestampText}>{timestamp}</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
  },
  safeContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  photoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.72,
    borderRadius: RADIUS.md,
  },
  signatureCard: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  signatureCanvasWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signatureMetaFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  signatureBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signatureMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  signatureTimestampText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerTimestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  footerTimestampText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginLeft: 'auto',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ImageViewerModal;
