import React, { useState } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SvgUri, SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/theme';

export const SignatureImage = ({
  uri,
  url,
  style,
  height = 140,
  width = '100%',
  resizeMode = 'contain',
  timestamp = '',
  onPress,
}) => {
  const targetUri = uri || url || '';
  const [loadError, setLoadError] = useState(false);

  if (!targetUri) {
    return (
      <View style={[styles.emptyBox, style, { height }]}>
        <Text style={styles.emptyText}>No signature available</Text>
      </View>
    );
  }

  // Render SVG or Image core
  const renderCore = () => {
    // 1. Inline SVG data URI (data:image/svg+xml;utf8,... or data:image/svg+xml,...)
    if (
      typeof targetUri === 'string' &&
      (targetUri.startsWith('data:image/svg+xml;utf8,') ||
        targetUri.startsWith('data:image/svg+xml,'))
    ) {
      try {
        const prefixMatch = /^data:image\/svg\+xml(;utf8)?,/;
        const rawXml = decodeURIComponent(targetUri.replace(prefixMatch, ''));
        return <SvgXml xml={rawXml} width={width} height={height} />;
      } catch {}
    }

    // 2. Base64 encoded SVG data URI
    if (
      typeof targetUri === 'string' &&
      targetUri.startsWith('data:image/svg+xml;base64,')
    ) {
      try {
        const base64Str = targetUri.replace('data:image/svg+xml;base64,', '');
        const rawXml = typeof atob === 'function' ? atob(base64Str) : base64Str;
        return <SvgXml xml={rawXml} width={width} height={height} />;
      } catch {}
    }

    // 3. Raw SVG XML string (<svg ... </svg>)
    if (
      typeof targetUri === 'string' &&
      targetUri.trim().startsWith('<svg') &&
      targetUri.includes('</svg>')
    ) {
      return <SvgXml xml={targetUri} width={width} height={height} />;
    }

    // 4. Remote SVG URL (.svg)
    const isSvgUrl =
      typeof targetUri === 'string' && targetUri.toLowerCase().includes('.svg');
    if (isSvgUrl && !loadError) {
      return (
        <SvgUri
          uri={targetUri}
          width={width}
          height={height}
          onError={() => setLoadError(true)}
        />
      );
    }

    // 5. Standard Raster Image (PNG, JPG, WebP, or base64)
    return (
      <Image
        source={{ uri: targetUri }}
        style={[styles.image, { height }]}
        resizeMode={resizeMode}
        onError={() => setLoadError(true)}
      />
    );
  };

  const content = (
    <View style={[styles.container, style, { height }]}>
      {renderCore()}

      {/* Bottom Right Corner: Date & Time Watermark */}
      {timestamp ? (
        <View style={styles.timestampBadge}>
          <Ionicons name="time-outline" size={11} color="#475569" />
          <Text style={styles.timestampText}>{timestamp}</Text>
        </View>
      ) : null}

      {/* Tap to expand hint */}
      {onPress ? (
        <View style={styles.expandHint}>
          <Ionicons name="expand-outline" size={12} color="#64748B" />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
  },
  emptyBox: {
    width: '100%',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  timestampBadge: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  timestampText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  expandHint: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 3,
    borderRadius: RADIUS.xs,
  },
});

export default SignatureImage;
