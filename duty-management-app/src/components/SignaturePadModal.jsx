import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

const { width } = Dimensions.get('window');
const CANVAS_WIDTH = width - 40;
const CANVAS_HEIGHT = 220;

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
  instruction = 'Ask customer to sign with finger inside the box below',
}) => {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [currentTimestamp, setCurrentTimestamp] = useState(formatSignatureTimestamp());

  // Refresh timestamp when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentTimestamp(formatSignatureTimestamp());
    }
  }, [visible]);

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

    // Build standalone SVG string with responsive viewBox and embedded watermark text in the bottom-right corner
    const svgString = `<svg viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${allPaths
      .map(
        (p) =>
          `<path d="${p}" stroke="#0F172A" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join('')}<text x="${CANVAS_WIDTH - 10}" y="${CANVAS_HEIGHT - 8}" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="9" fill="#64748B" font-weight="600">${timestampStr}</text></svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

    onSave({
      dataUri,
      svgString,
      pointCount: allPaths.length,
      signedAt: now.toISOString(),
      timestamp: timestampStr,
    });
    handleClear();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.instruction}>{instruction}</Text>

          <View style={styles.canvasContainer} {...panResponder.panHandlers}>
            <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
              {paths.map((p, index) => (
                <Path
                  key={index}
                  d={p}
                  stroke={COLORS.text}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={COLORS.text}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
            <View style={styles.signatureLine} />
            <Text style={styles.signLabel}>Sign on the line (Stroke count: {paths.length})</Text>

            {/* Bottom Right Corner Watermark: Date & Time */}
            <View style={styles.bottomRightBadge}>
              <Ionicons name="time-outline" size={10} color="#64748B" />
              <Text style={styles.bottomRightBadgeText}>{currentTimestamp}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <SecondaryButton
              title="Clear"
              variant="outline"
              onPress={handleClear}
              style={styles.actionBtn}
            />
            <SecondaryButton
              title="Cancel"
              variant="ghost"
              onPress={onClose}
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
  container: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  instruction: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.sm,
  },
  canvasContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
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
    bottom: 35,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: COLORS.border,
    borderStyle: 'dashed',
  },
  signLabel: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    fontSize: 11,
    color: COLORS.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
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
