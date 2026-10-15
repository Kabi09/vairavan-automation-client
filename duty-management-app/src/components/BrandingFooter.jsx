import React from 'react';
import { View, Text, StyleSheet, Linking, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

const BRANDING_URL = 'https://www.ameyy.in/';

/**
 * Reusable Minimal Branding Footer
 * Renders "Developed by Ameyy Digital Services" with small external link icon that opens in a new tab/browser.
 */
export const BrandingFooter = ({ style, textStyle, linkStyle, iconSize = 11 }) => {
  const handleOpenLink = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(BRANDING_URL, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(BRANDING_URL);
      }
    } catch (error) {
      console.warn('Failed to open branding URL:', error);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.touchableRow}
        onPress={handleOpenLink}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel="Developed by Ameyy Digital Services"
        {...(Platform.OS === 'web'
          ? {
              href: BRANDING_URL,
              hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' },
            }
          : {})}
      >
        <Text style={[styles.text, textStyle]}>
          Developed by{' '}
          <Text style={[styles.link, linkStyle]}>
            Ameyy Digital Services
          </Text>
        </Text>
        <Ionicons
          name="open-outline"
          size={iconSize}
          color={(linkStyle && linkStyle.color) || COLORS.primary}
          style={styles.icon}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  touchableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  icon: {
    marginLeft: 3,
    marginTop: 1,
  },
});

export default BrandingFooter;
