import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import MonthlyCalendarView from '../../components/MonthlyCalendarView';
import BrandingFooter from '../../components/BrandingFooter';
import { COLORS, SPACING } from '../../constants/theme';

export const EmployeeCalendarScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Monthly Calendar"
        subtitle="Track daily attendance, working days & leaves"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MonthlyCalendarView isAdminView={false} />
        <BrandingFooter style={styles.brandingFooter} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  brandingFooter: {
    marginBottom: SPACING.xl,
  },
});

export default EmployeeCalendarScreen;
