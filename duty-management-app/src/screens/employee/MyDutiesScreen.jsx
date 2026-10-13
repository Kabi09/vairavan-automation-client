import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dutyApi from '../../api/dutyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const MyDutiesScreen = ({ navigation }) => {
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchDuties = useCallback(async () => {
    try {
      setError('');
      const params = { limit: 500 };
      if (search.trim()) params.search = search.trim();

      const res = await dutyApi.getMyDuties(params);
      if (res.data?.duties) {
        setDuties(res.data.duties);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your duty history'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      fetchDuties();
    }, [fetchDuties])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDuties();
  };

  // Real-time client-side filter for instant typing feedback
  const filteredDuties = duties.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const dutyId = (d.dutyId || ('DUTY-' + (d._id || '').slice(-6))).toLowerCase();
    const rawId = (d._id || '').toLowerCase();
    const compName = (d.company?.companyName || '').toLowerCase();
    const custName = (d.customerName || '').toLowerCase();
    const phone = (d.customerPhoneNumber || '').toLowerCase();
    const machine = (d.machineName || '').toLowerCase();
    const workType = (d.workType || '').toLowerCase();
    const desc = (d.workDescription || '').toLowerCase();

    return (
      dutyId.includes(q) ||
      rawId.includes(q) ||
      compName.includes(q) ||
      custName.includes(q) ||
      phone.includes(q) ||
      machine.includes(q) ||
      workType.includes(q) ||
      desc.includes(q)
    );
  });

  const renderDutyItem = ({ item }) => {
    const dutyId = item.dutyId || ('DUTY-' + (item._id || '').slice(-6).toUpperCase());

    return (
      <Card
        style={styles.dutyCard}
        onPress={() => navigation.navigate('DutyDetails', { dutyId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <View style={styles.idRow}>
              <Text style={styles.dutyIdBadge}>{dutyId}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.companyName}>
              <Ionicons name="business-outline" size={13} color={COLORS.textSecondary} />{' '}
              {item.company?.companyName || 'Client Site'}
            </Text>
          </View>
        </View>

        <Text style={styles.machineText}>
          <Ionicons name="hardware-chip-outline" size={13} color={COLORS.textSecondary} />{' '}
          {item.machineName} ({item.workType})
        </Text>

        <Text style={styles.descriptionSnippet} numberOfLines={2}>
          {item.workDescription}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <Text style={styles.timeText}>
              <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />{' '}
              {formatTime(item.inTime)} - {formatTime(item.outTime)}
            </Text>
            <Text style={styles.dateText}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />{' '}
              {formatDate(item.dutyDate)}
            </Text>
          </View>

          {/* Employee Edit Action */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('DutyForm', { dutyToEdit: item })}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={14} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="My Duty Reports"
        subtitle="Your field service visit logs"
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('DutyForm')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={COLORS.textLight} />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Universal Search Bar */}
        <TextInputField
          placeholder="Search by ID, company, phone, name, machine..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            Showing <Text style={styles.summaryHighlight}>{filteredDuties.length}</Text> duties
          </Text>
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearchText}>Clear Search</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ErrorMessage message={error} onRetry={fetchDuties} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading duty records..." />
        ) : (
          <FlatList
            data={filteredDuties}
            keyExtractor={(item) => item._id}
            renderItem={renderDutyItem}
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
                icon="document-text-outline"
                title={search ? 'No Matching Duties' : 'No Duty Reports Found'}
                description={
                  search
                    ? `No duties match "${search}". Try searching another name, phone, or company.`
                    : 'Log your service visits by tapping "New" above.'
                }
                actionTitle={search ? 'Clear Search' : 'Submit Duty Report'}
                onAction={search ? () => setSearch('') : () => navigation.navigate('DutyForm')}
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
  addButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addButtonText: {
    color: COLORS.textLight,
    fontWeight: '600',
    fontSize: 13,
  },
  searchBar: {
    marginBottom: SPACING.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  summaryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  summaryHighlight: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  clearSearchText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  dutyCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dutyIdBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  companyName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  machineText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: SPACING.sm,
  },
  descriptionSnippet: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  footerInfo: {
    flexDirection: 'column',
    gap: 3,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default MyDutiesScreen;
