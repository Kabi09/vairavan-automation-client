import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

/**
 * Helper to format readable timestamp (e.g. "13 Oct 2026, 06:15 PM")
 */
export const formatSignatureTimestamp = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, '0');
  return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
};

export const SignaturePadModal = ({
  visible,
  onClose,
  onSave,
  title = 'Customer Signature',
  instruction = 'Ask customer to sign smoothly with finger inside the box below',
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Responsive canvas dimensions
  const canvasWidth = isLandscape
    ? Math.max(320, Math.min(width - 48, 860))
    : Math.max(280, width - 40);

  const canvasHeight = isLandscape
    ? Math.max(150, Math.min(height - 110, 260))
    : 220;

  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [currentTimestamp, setCurrentTimestamp] = useState(formatSignatureTimestamp());

  // Automatic Screen Orientation: Auto-rotate to LANDSCAPE on open, revert to PORTRAIT on close
  useEffect(() => {
    if (visible) {
      setCurrentTimestamp(formatSignatureTimestamp());
      if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((err) => {
        console.log('[SignaturePad] Orientation lock error:', err?.message || err);
      });
    } else {
      if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((err) => {
        console.log('[SignaturePad] Orientation unlock error:', err?.message || err);
      });
    }

    return () => {
      if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  // Safe close handler ensuring orientation restores to portrait
  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    if (onClose) onClose();
  }, [onClose]);

  // Refs prevent stale closure inside PanResponder handlers
  const pathsRef = useRef([]);
  const currentPathRef = useRef('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = Math.round(locationX);
        const y = Math.round(locationY);
        const newSegment = `M${x},${y} L${x + 0.1},${y + 0.1}`;
        currentPathRef.current = newSegment;
        setCurrentPath(newSegment);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = Math.round(locationX);
        const y = Math.round(locationY);
        currentPathRef.current += ` L${x},${y}`;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          const updated = [...pathsRef.current, currentPathRef.current];
          pathsRef.current = updated;
          setPaths(updated);
          currentPathRef.current = '';
          setCurrentPath('');
        }
      },
      onPanResponderTerminate: () => {
        if (currentPathRef.current) {
          const updated = [...pathsRef.current, currentPathRef.current];
          pathsRef.current = updated;
          setPaths(updated);
          currentPathRef.current = '';
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleClear = () => {
    pathsRef.current = [];
    currentPathRef.current = '';
    setPaths([]);
    setCurrentPath('');
  };

  const handleSave = () => {
    const allPaths = [...pathsRef.current];
    if (currentPathRef.current) {
      allPaths.push(currentPathRef.current);
    }

    if (allPaths.length === 0) {
      alert('Please draw a signature before saving');
      return;
    }

    const now = new Date();
    const timestampStr = formatSignatureTimestamp(now);

    // Build standalone SVG string with responsive viewBox and embedded watermark
    const svgString = `<svg viewBox="0 0 ${canvasWidth} ${canvasHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${allPaths
      .map(
        (p) =>
          `<path d="${p}" stroke="#0F172A" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join('')}<text x="${canvasWidth - 10}" y="${canvasHeight - 8}" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="9" fill="#64748B" font-weight="600">${timestampStr}</text></svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

    // Revert orientation back to normal portrait before closing
    if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    onSave({
      dataUri,
      svgString,
      pointCount: allPaths.length,
      signedAt: now.toISOString(),
      timestamp: timestampStr,
    });
    handleClear();
    if (onClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={[styles.overlay, isLandscape && styles.overlayLandscape]}>
        <View style={[styles.container, isLandscape && styles.containerLandscape]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleWithIcon}>
                <Ionicons name="pencil" size={18} color={COLORS.primary} />
                <Text style={styles.title}>{title}</Text>
                {isLandscape && (
                  <View style={styles.landscapePill}>
                    <Ionicons name="phone-landscape-outline" size={12} color="#059669" />
                    <Text style={styles.landscapePillText}>Landscape Sign Pad</Text>
                  </View>
                )}
              </View>
              <Text style={styles.instruction} numberOfLines={1}>{instruction}</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Canvas Box */}
          <View
            style={[
              styles.canvasContainer,
              { width: canvasWidth, height: canvasHeight },
            ]}
            {...panResponder.panHandlers}
          >
            <Svg width={canvasWidth} height={canvasHeight}>
              {paths.map((p, index) => (
                <Path
                  key={index}
                  d={p}
                  stroke={COLORS.text}
                  strokeWidth={3.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={COLORS.text}
                  strokeWidth={3.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>

            <View style={styles.signatureLine} />
            <Text style={styles.signLabel}>
              Sign smoothly on the line {paths.length > 0 ? `(${paths.length} strokes)` : ''}
            </Text>

            {/* Bottom Right Corner Watermark: Date & Time */}
            <View style={styles.bottomRightBadge}>
              <Ionicons name="time-outline" size={10} color="#64748B" />
              <Text style={styles.bottomRightBadgeText}>{currentTimestamp}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={[styles.actionsRow, isLandscape && styles.actionsRowLandscape]}>
            <SecondaryButton
              title="Clear"
              variant="outline"
              onPress={handleClear}
              style={styles.actionBtn}
            />
            <SecondaryButton
              title="Cancel"
              variant="ghost"
              onPress={handleClose}
              style={styles.actionBtn}
            />
            <PrimaryButton
              title="Save Signature"
              onPress={handleSave}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  overlayLandscape: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xs,
  },
  container: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  containerLandscape: {
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    maxHeight: '96%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  landscapePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginLeft: 6,
  },
  landscapePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  instruction: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  canvasContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  signatureLine: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: COLORS.border,
    borderStyle: 'dashed',
  },
  signLabel: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    fontSize: 10,
    color: COLORS.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  actionsRowLandscape: {
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
  },
  bottomRightBadge: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bottomRightBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
});

export default SignaturePadModal;
