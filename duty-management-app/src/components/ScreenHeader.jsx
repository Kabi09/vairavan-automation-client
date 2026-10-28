import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';

export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  navigation,
  rightAction,
  rightElement,
  style,
}) => {
  const { isDesktop, maxContentWidth } = useResponsive();

  const handleBack =
    onBack ||
    (navigation
      ? () => {
          if (navigation.canGoBack?.()) {
            navigation.goBack();
          } else if (navigation.navigate) {
            navigation.navigate('DashboardTab');
          }
        }
      : undefined);

  const action = rightAction || rightElement;

  return (
    <View style={[styles.headerWrapper, style]}>
      <View
        style={[
          styles.headerInner,
          isDesktop && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        <View style={styles.leftRow}>
          {handleBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {action ? <View style={styles.rightAction}>{action}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    width: '100%',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: SPACING.md,
    padding: SPACING.xs,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rightAction: {
    marginLeft: SPACING.md,
  },
});

export default ScreenHeader;
