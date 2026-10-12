import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import taskApi from '../../api/taskApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const EmployeeTaskListScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const fetchMyTasks = useCallback(async () => {
    try {
      setError('');
      const res = await taskApi.getMyTasks();
      if (res.data?.tasks) {
        setTasks(res.data.tasks);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your assigned tasks'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyTasks();
    }, [fetchMyTasks])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyTasks();
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call from this device');
    });
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    setUpdatingTaskId(taskId);
    try {
      await taskApi.updateTaskStatus(taskId, newStatus);
      fetchMyTasks();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to update task status'));
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const renderTaskItem = ({ item }) => {
    const isCompleted = item.status === 'completed';
    const isInProgress = item.status === 'in_progress';

    return (
      <Card style={styles.taskCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.taskName}>{item.taskName}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.companyName}>
            <Ionicons name="business" size={13} color={COLORS.primary} /> {item.companyName}
          </Text>
        </View>

        <View style={styles.detailsBlock}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>Scheduled: <Text style={styles.boldText}>{formatDate(item.date)}</Text></Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="construct" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>Work Details: {item.work}</Text>
          </View>

          {item.description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.descTitle}>Admin Instructions:</Text>
              <Text style={styles.descText}>{item.description}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => handleCall(item.phoneNumber)}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={14} color="#FFFFFF" />
            <Text style={styles.callBtnText}>Call {item.phoneNumber}</Text>
          </TouchableOpacity>

          <View style={styles.actionBtnRow}>
            {!isCompleted && !isInProgress && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => handleUpdateStatus(item._id, 'in_progress')}
                disabled={updatingTaskId === item._id}
                activeOpacity={0.8}
              >
                <Text style={styles.startBtnText}>
                  {updatingTaskId === item._id ? 'Updating...' : 'Start Task'}
                </Text>
              </TouchableOpacity>
            )}

            {isInProgress && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => handleUpdateStatus(item._id, 'completed')}
                disabled={updatingTaskId === item._id}
                activeOpacity={0.8}
              >
                <Text style={styles.completeBtnText}>
                  {updatingTaskId === item._id ? 'Updating...' : 'Mark Done'}
                </Text>
              </TouchableOpacity>
            )}

            {isCompleted && (
              <View style={styles.donePill}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.doneText}>Completed</Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="My Assigned Tasks"
        subtitle="Work orders assigned to you by administration"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <ErrorMessage message={error} onRetry={fetchMyTasks} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading assigned tasks..." />
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item._id}
            renderItem={renderTaskItem}
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
                icon="checkmark-done-circle-outline"
                title="No Tasks Assigned"
                description="You currently have no pending tasks assigned by management."
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
  taskCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    marginBottom: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  companyName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4,
  },
  detailsBlock: {
    marginVertical: SPACING.xs,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  boldText: {
    fontWeight: '700',
    color: COLORS.text,
  },
  descriptionBox: {
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  descTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  descText: {
    fontSize: 12,
    color: COLORS.text,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  startBtn: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  completeBtn: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  doneText: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default EmployeeTaskListScreen;
