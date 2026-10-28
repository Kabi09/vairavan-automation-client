import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { COLORS } from '../constants/theme';

/**
 * Universal Responsive Content Container
 * Centers layout, enforces optimal readable max-width on tablet/desktop,
 * and maintains seamless 100% touch layout on mobile.
 */
export const ResponsiveContainer = ({
  children,
  style,
  contentContainerStyle,
  scrollable = false,
  maxWidth,
  noPadding = false,
  ...rest
}) => {
  const { maxContentWidth, gutter, isMobile } = useResponsive();

  const effectiveMaxWidth = maxWidth !== undefined ? maxWidth : maxContentWidth;
  const paddingH = noPadding ? 0 : gutter;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.scrollRoot, style]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: paddingH,
            maxWidth: effectiveMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: effectiveMaxWidth,
          paddingHorizontal: paddingH,
          alignSelf: 'center',
          width: '100%',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollRoot: {
    flex: 1,
    backgroundColor: 'transparent',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default ResponsiveContainer;

