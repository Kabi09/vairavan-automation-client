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
import TextInputField from '../../components/TextInputField';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const AdminTaskListScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('all');

  // Deletion
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setError('');
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await taskApi.getTasks(params);
      if (res.data?.tasks) {
        setTasks(res.data.tasks);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load assigned tasks'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call on this device');
    });
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await taskApi.deleteTask(taskToDelete._id);
      setTaskToDelete(null);
      fetchTasks();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to cancel task'));
    } finally {
      setDeleting(false);
    }
  };

  const renderTaskItem = ({ item }) => {
    return (
      <Card style={styles.taskCard}>
        <View style={styles.cardHeader}>
          <View style={styles.taskTitleRow}>
            <Text style={styles.taskName}>{item.taskName}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.companyName}>
            <Ionicons name="business" size={13} color={COLORS.primary} /> {item.companyName}
          </Text>
        </View>

        <View style={styles.detailsBlock}>
          <View style={styles.detailRow}>
            <Ionicons name="person" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>
              Assigned to: <Text style={styles.boldText}>{item.employee?.employeeName || 'Staff'}</Text> ({item.employee?.employeeId})
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="construct" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>Work: {item.work}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>Scheduled: {formatDate(item.date)}</Text>
          </View>

          {item.description ? (
            <View style={styles.descriptionBox}>
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

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setTaskToDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Assigned Tasks"
        subtitle="Manage work orders dispatched to employees"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('TaskAssign')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={COLORS.textLight} />
            <Text style={styles.addButtonText}>Assign Task</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        <TextInputField
          placeholder="Search by task, company, or staff..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        {/* Status filter tabs */}
        <View style={styles.tabRow}>
          {['all', 'assigned', 'in_progress', 'completed'].map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.filterTab, statusFilter === st && styles.filterTabActive]}
              onPress={() => setStatusFilter(st)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterTabText,
                  statusFilter === st && styles.filterTabTextActive,
                ]}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'in_progress'
                  ? 'In Progress'
                  : st.charAt(0).toUpperCase() + st.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ErrorMessage message={error} onRetry={fetchTasks} />

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
                icon="clipboard-outline"
                title="No Tasks Assigned"
                description={
                  search
                    ? `No tasks matching "${search}".`
                    : 'Dispatch operational work to technicians and employees.'
                }
                actionTitle="Assign New Task"
                onAction={() => navigation.navigate('TaskAssign')}
              />
            }
          />
        )}
      </View>

      <ConfirmationDialog
        visible={Boolean(taskToDelete)}
        title="Cancel Assigned Task"
        message={`Are you sure you want to cancel and remove "${taskToDelete?.taskName}"?`}
        confirmText="Cancel Task"
        confirmVariant="danger"
        loading={deleting}
        onCancel={() => setTaskToDelete(null)}
        onConfirm={handleDeleteConfirm}
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
  searchBar: {
    marginBottom: SPACING.xs,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
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
  taskTitleRow: {
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
  descText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteBtn: {
    padding: SPACING.xs,
  },
});

export default AdminTaskListScreen;
