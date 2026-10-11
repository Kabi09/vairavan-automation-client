import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import holidayApi from '../../api/holidayApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const HolidayListScreen = ({ navigation }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchHolidays = useCallback(async () => {
    try {
      setError('');
      const res = await holidayApi.getHolidays();
      if (res.data?.holidays) {
        setHolidays(res.data.holidays);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load holidays'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHolidays();
  };

  const renderHolidayItem = ({ item }) => (
    <Card style={styles.holidayCard}>
      <View style={styles.holidayRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="calendar" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.holidayName}>{item.holidayName}</Text>
          <Text style={styles.dateRange}>
            {formatDate(item.startDate)} {item.startDate !== item.endDate && `- ${formatDate(item.endDate)}`}
          </Text>
          {item.description ? (
            <Text style={styles.descriptionText}>{item.description}</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Company Holidays"
        subtitle="Official holidays and factory closure schedule"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      />

      <View style={styles.container}>
        <ErrorMessage message={error} onRetry={fetchHolidays} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading holiday calendar..." />
        ) : (
          <FlatList
            data={holidays}
            keyExtractor={(item) => item._id}
            renderItem={renderHolidayItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title="No Holidays Announced"
                description="Company holidays will be listed here once scheduled by management."
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  holidayCard: {
    marginBottom: SPACING.md,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  infoCol: {
    flex: 1,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateRange: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 3,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
});

export default HolidayListScreen;
