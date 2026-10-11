import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

export const MyLeavesScreen = ({ navigation }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Cancel leave state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  useEffect(() => {
    fetchMyLeaves();
  }, [fetchMyLeaves]);

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
        <ErrorMessage message={error} onRetry={fetchMyLeaves} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading your leave records..." />
        ) : (
          <FlatList
            data={leaves}
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
                title="No Leave Requests Found"
                description="You haven't submitted any leave requests yet."
                actionTitle="Apply for Leave"
                onAction={() => navigation.navigate('LeaveRequest')}
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
