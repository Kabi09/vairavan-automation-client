import React, { useState, useRef } from 'react';
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
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

const { width } = Dimensions.get('window');
const CANVAS_WIDTH = width - 40;
const CANVAS_HEIGHT = 220;

export const SignaturePadModal = ({ visible, onClose, onSave }) => {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');

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

    // Build standalone SVG string
    const svgString = `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${allPaths
      .map(
        (p) =>
          `<path d="${p}" stroke="#0F172A" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join('')}</svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

    onSave({
      dataUri,
      svgString,
      pointCount: allPaths.length,
    });
    handleClear();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Customer Signature</Text>
          <Text style={styles.instruction}>
            Ask customer to sign with finger inside the box below
          </Text>

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
});

export default SignaturePadModal;
