import React, { useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { SvgUri, SvgXml } from 'react-native-svg';
import { COLORS, RADIUS } from '../constants/theme';

export const SignatureImage = ({
  uri,
  url,
  style,
  height = 140,
  width = '100%',
  resizeMode = 'contain',
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

  // 1. Inline SVG data URI (data:image/svg+xml;utf8,... or data:image/svg+xml,...)
  if (
    typeof targetUri === 'string' &&
    (targetUri.startsWith('data:image/svg+xml;utf8,') ||
      targetUri.startsWith('data:image/svg+xml,'))
  ) {
    try {
      const prefixMatch = /^data:image\/svg\+xml(;utf8)?,/;
      const rawXml = decodeURIComponent(targetUri.replace(prefixMatch, ''));
      return (
        <View style={[styles.container, style, { height }]}>
          <SvgXml xml={rawXml} width={width} height={height} />
        </View>
      );
    } catch {
      // Fallback
    }
  }

  // 2. Base64 encoded SVG data URI
  if (
    typeof targetUri === 'string' &&
    targetUri.startsWith('data:image/svg+xml;base64,')
  ) {
    try {
      const base64Str = targetUri.replace('data:image/svg+xml;base64,', '');
      const rawXml = typeof atob === 'function' ? atob(base64Str) : base64Str;
      return (
        <View style={[styles.container, style, { height }]}>
          <SvgXml xml={rawXml} width={width} height={height} />
        </View>
      );
    } catch {
      // Fallback
    }
  }

  // 3. Raw SVG XML string (<svg ... </svg>)
  if (
    typeof targetUri === 'string' &&
    targetUri.trim().startsWith('<svg') &&
    targetUri.includes('</svg>')
  ) {
    return (
      <View style={[styles.container, style, { height }]}>
        <SvgXml xml={targetUri} width={width} height={height} />
      </View>
    );
  }

  // 4. Remote SVG URL (.svg)
  const isSvgUrl =
    typeof targetUri === 'string' && targetUri.toLowerCase().includes('.svg');
  if (isSvgUrl && !loadError) {
    return (
      <View style={[styles.container, style, { height }]}>
        <SvgUri
          uri={targetUri}
          width={width}
          height={height}
          onError={() => setLoadError(true)}
        />
      </View>
    );
  }

  // 5. Standard Raster Image (PNG, JPG, WebP, or base64)
  return (
    <Image
      source={{ uri: targetUri }}
      style={[styles.image, style, { height }]}
      resizeMode={resizeMode}
      onError={() => setLoadError(true)}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});

export default SignatureImage;
