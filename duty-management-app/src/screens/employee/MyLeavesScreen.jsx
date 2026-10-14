import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import leaveApi from '../../api/leaveApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

const STATUS_TABS = [
  { key: 'all', label: 'All', icon: 'list-outline' },
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline' },
  { key: 'cancelled', label: 'Cancelled', icon: 'ban-outline' },
];

export const MyLeavesScreen = ({ navigation }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Cancel leave state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const counts = useMemo(
    () => ({
      all: leaves.length,
      pending: leaves.filter((l) => l.status === 'pending').length,
      approved: leaves.filter((l) => l.status === 'approved').length,
      rejected: leaves.filter((l) => l.status === 'rejected').length,
      cancelled: leaves.filter((l) => l.status === 'cancelled').length,
    }),
    [leaves]
  );

  const filteredLeaves = useMemo(() => {
    if (statusFilter === 'all') return leaves;
    return leaves.filter((l) => l.status === statusFilter);
  }, [leaves, statusFilter]);

  const fetchMyLeaves = useCallback(async () => {
    try {
      setError('');
      const res = await leaveApi.getMyLeaves({ limit: 50 });
      if (res.data?.leaves) {
        setLeaves(res.data.leaves);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your leave requests'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyLeaves();
    }, [fetchMyLeaves])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyLeaves();
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);

    try {
      await leaveApi.cancelLeave(cancelTarget._id);
      Alert.alert('Leave Cancelled', 'Your pending leave request has been cancelled.');
      setCancelTarget(null);
      fetchMyLeaves();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to cancel leave request'));
    } finally {
      setCancelLoading(false);
    }
  };

  const renderLeaveItem = ({ item }) => (
    <Card style={styles.leaveCard}>
      <View style={styles.cardHeader}>
        <View style={styles.dateBanner}>
          <Ionicons name="calendar" size={16} color={COLORS.primary} />
          <Text style={styles.dateRangeText}>
            {formatDate(item.startDate)} - {formatDate(item.endDate)}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.reasonText}>"{item.reason}"</Text>

      {item.adminRemarks ? (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>Manager Remarks:</Text>
          <Text style={styles.remarksText}>{item.adminRemarks}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.requestedAtText}>
          Applied on {formatDate(item.requestedAt || item.createdAt)}
        </Text>

        {item.status === 'pending' && (
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => setCancelTarget(item)}
          >
            <Text style={styles.cancelLinkText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="My Leave Requests"
        subtitle="Track applications and manager decisions"
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('LeaveRequest')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={COLORS.textLight} />
            <Text style={styles.addButtonText}>Apply</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Status Filter Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {STATUS_TABS.map((tab) => {
              const isSelected = statusFilter === tab.key;
              const count = counts[tab.key] || 0;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.statusTabChip, isSelected && styles.statusTabChipActive]}
                  onPress={() => setStatusFilter(tab.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon}
                    size={15}
                    color={isSelected ? COLORS.textLight : COLORS.textSecondary}
                  />
                  <Text
                    style={[styles.statusTabText, isSelected && styles.statusTabTextActive]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.statusCountBadge,
                      isSelected && styles.statusCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusCountText,
                        isSelected && styles.statusCountTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ErrorMessage message={error} onRetry={fetchMyLeaves} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading your leave records..." />
        ) : (
          <FlatList
            data={filteredLeaves}
            keyExtractor={(item) => item._id}
            renderItem={renderLeaveItem}
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
                title={
                  statusFilter === 'all'
                    ? 'No Leave Requests Found'
                    : `No ${STATUS_TABS.find((t) => t.key === statusFilter)?.label || ''} Leaves`
                }
                description={
                  statusFilter === 'all'
                    ? "You haven't submitted any leave requests yet."
                    : `You do not have any leave requests with status "${statusFilter}".`
                }
                actionTitle={statusFilter === 'all' ? 'Apply for Leave' : 'Show All Leaves'}
                onAction={() => {
                  if (statusFilter === 'all') {
                    navigation.navigate('LeaveRequest');
                  } else {
                    setStatusFilter('all');
                  }
                }}
              />
            }
          />
        )}
      </View>

      <ConfirmationDialog
        visible={Boolean(cancelTarget)}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this pending leave request?"
        confirmText="Yes, Cancel"
        confirmVariant="danger"
        loading={cancelLoading}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
      />
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
  tabsContainer: {
    marginBottom: SPACING.md,
  },
  tabsScrollContent: {
    paddingVertical: 2,
    gap: 8,
    flexDirection: 'row',
  },
  statusTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  statusTabChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusTabTextActive: {
    color: COLORS.textLight,
  },
  statusCountBadge: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  statusCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusCountTextActive: {
    color: COLORS.textLight,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  leaveCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  remarksBox: {
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  remarksText: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
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
  requestedAtText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  cancelLink: {
    paddingVertical: 2,
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.danger,
  },
});

export default MyLeavesScreen;
