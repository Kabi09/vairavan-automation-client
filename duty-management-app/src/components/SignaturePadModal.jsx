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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => `${prev} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          setPaths((prev) => [...prev, currentPath]);
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const handleSave = () => {
    if (paths.length === 0 && !currentPath) {
      alert('Please draw a signature before saving');
      return;
    }

    // Combine all paths
    const allPaths = [...paths, ...(currentPath ? [currentPath] : [])];
    const svgString = `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${allPaths.map((p) => `<path d="${p}" stroke="#0F172A" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}</svg>`;
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
            <Text style={styles.signLabel}>Sign on the line</Text>
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
    borderWidth: 1,
    borderColor: COLORS.border,
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
    fontSize: 12,
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
