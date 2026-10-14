import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import taskApi from '../api/taskApi';
import LoadingIndicator from './LoadingIndicator';
import ErrorMessage from './ErrorMessage';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { formatDate } from '../utils/dateUtils';
import { extractErrorMessage } from '../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const TaskDetailsModal = ({
  visible,
  task: initialTask,
  taskId,
  onClose,
  onTaskUpdated,
  currentUser,
}) => {
  const [task, setTask] = useState(initialTask || null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (initialTask) {
        setTask(initialTask);
      }
      const targetId = initialTask?._id || taskId;
      if (targetId) {
        loadTaskDetails(targetId);
      }
    } else {
      setError('');
    }
  }, [visible, initialTask, taskId]);

  const loadTaskDetails = async (id) => {
    try {
      if (!initialTask) setLoading(true);
      setError('');
      const res = await taskApi.getTaskById(id);
      if (res.data?.task) {
        setTask(res.data.task);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load task details'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!task?._id) return;
    setUpdatingStatus(true);
    try {
      const res = await taskApi.updateTaskStatus(task._id, newStatus);
      if (res.data?.task) {
        setTask(res.data.task);
        if (onTaskUpdated) {
          onTaskUpdated(res.data.task);
        }
      }
      Alert.alert(
        'Task Updated',
        `Task status changed to ${newStatus.replace('_', ' ').toUpperCase()}`
      );
    } catch (err) {
      Alert.alert('Update Failed', extractErrorMessage(err, 'Could not update task status'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!visible) return null;

  const status = task?.status || 'pending';
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';
  const isPending = status === 'pending';

  const company = task?.company || {};
  const companyLocation = company.location || company.address || '';
  const assignedList = Array.isArray(task?.assignedEmployees) ? task.assignedEmployees : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="clipboard" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={2}>
                  {task?.taskName || 'Task Details'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Created {task?.createdAt ? formatDate(task.createdAt) : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <LoadingIndicator message="Loading task details..." />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              <ErrorMessage message={error} onRetry={() => loadTaskDetails(task?._id || taskId)} />

              {/* Status & Priority Row */}
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusPill,
                    isCompleted
                      ? styles.statusPillCompleted
                      : isInProgress
                      ? styles.statusPillInProgress
                      : styles.statusPillPending,
                  ]}
                >
                  <Ionicons
                    name={
                      isCompleted
                        ? 'checkmark-circle'
                        : isInProgress
                        ? 'time'
                        : 'alert-circle'
                    }
                    size={15}
                    color={
                      isCompleted
                        ? '#15803D'
                        : isInProgress
                        ? '#1D4ED8'
                        : '#B45309'
                    }
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      isCompleted
                        ? styles.statusTextCompleted
                        : isInProgress
                        ? styles.statusTextInProgress
                        : styles.statusTextPending,
                    ]}
                  >
                    {status === 'in_progress'
                      ? 'In Progress'
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>

                {task?.priority && (
                  <View style={styles.priorityBadge}>
                    <Text style={styles.priorityBadgeText}>
                      Priority: {task.priority.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Client Company Card */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Ionicons name="business" size={17} color={COLORS.primary} />
                  <Text style={styles.sectionCardTitle}>Client Company</Text>
                </View>

                <Text style={styles.companyNameText}>
                  {company.companyName || 'Not specified'}
                </Text>

                {companyLocation ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={15} color={COLORS.textSecondary} />
                    <Text style={styles.infoText}>{companyLocation}</Text>
                  </View>
                ) : null}

                {company.contactPerson ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={15} color={COLORS.textSecondary} />
                    <Text style={styles.infoText}>Contact: {company.contactPerson}</Text>
                  </View>
                ) : null}

                {company.phone ? (
                  <TouchableOpacity
                    style={[styles.infoRow, styles.phoneLink]}
                    onPress={() => Linking.openURL(`tel:${company.phone}`).catch(() => {})}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={15} color={COLORS.primary} />
                    <Text style={[styles.infoText, { color: COLORS.primary, fontWeight: '600' }]}>
                      {company.phone} (Tap to call)
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Description Card */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Ionicons name="document-text" size={17} color={COLORS.primary} />
                  <Text style={styles.sectionCardTitle}>Description & Work Scope</Text>
                </View>
                <Text style={styles.descriptionText}>
                  {task?.description || 'No additional instructions provided for this task.'}
                </Text>
              </View>

              {/* Assigned Employees Card */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Ionicons name="people" size={17} color={COLORS.primary} />
                  <Text style={styles.sectionCardTitle}>
                    Assigned Employees ({assignedList.length})
                  </Text>
                </View>

                <View style={styles.assignedWrap}>
                  {assignedList.map((emp) => (
                    <View key={emp._id || emp} style={styles.empBadge}>
                      <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empBadgeName}>
                          {emp.employeeName || 'Staff Member'}
                        </Text>
                        <Text style={styles.empBadgeMeta}>
                          {emp.employeeId ? `ID: ${emp.employeeId} • ` : ''}
                          {emp.designation || 'Technician'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Assigned By & Completed Meta */}
              <View style={styles.metaBox}>
                {task?.createdBy ? (
                  <Text style={styles.metaBoxText}>
                    Assigned by: <Text style={{ fontWeight: '600' }}>{task.createdBy.employeeName || 'Admin'}</Text>
                  </Text>
                ) : null}
                {isCompleted && task?.completedAt ? (
                  <Text style={[styles.metaBoxText, { color: '#15803D', marginTop: 3 }]}>
                    Completed on: {formatDate(task.completedAt)}
                    {task.completedBy ? ` by ${task.completedBy.employeeName}` : ''}
                  </Text>
                ) : null}
              </View>

              {/* Status Actions */}
              <View style={styles.actionsContainer}>
                {isPending && (
                  <>
                    <PrimaryButton
                      title="Start Task (In Progress)"
                      onPress={() => handleUpdateStatus('in_progress')}
                      loading={updatingStatus}
                      style={{ marginBottom: SPACING.xs }}
                    />
                    <SecondaryButton
                      title="Mark as Completed"
                      onPress={() => handleUpdateStatus('completed')}
                      disabled={updatingStatus}
                    />
                  </>
                )}

                {isInProgress && (
                  <>
                    <PrimaryButton
                      title="Mark as Completed ✅"
                      onPress={() => handleUpdateStatus('completed')}
                      loading={updatingStatus}
                      style={{ marginBottom: SPACING.xs }}
                    />
                    <SecondaryButton
                      title="Revert to Pending"
                      onPress={() => handleUpdateStatus('pending')}
                      disabled={updatingStatus}
                    />
                  </>
                )}

                {isCompleted && (
                  <SecondaryButton
                    title="Reopen Task (Pending)"
                    onPress={() => handleUpdateStatus('pending')}
                    loading={updatingStatus}
                  />
                )}
              </View>
            </ScrollView>
          )}

          {/* Close Footer */}
          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeFooterBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '88%',
    display: 'flex',
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: SPACING.sm,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scrollBody: {
    paddingVertical: SPACING.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillInProgress: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusPillCompleted: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#92400E',
  },
  statusTextInProgress: {
    color: '#1E40AF',
  },
  statusTextCompleted: {
    color: '#15803D',
  },
  priorityBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.xs,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  companyNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  phoneLink: {
    marginTop: 6,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  assignedWrap: {
    marginTop: 4,
    gap: 6,
  },
  empBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  empBadgeName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  empBadgeMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  metaBox: {
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  metaBoxText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionsContainer: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  closeFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  closeFooterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

export default TaskDetailsModal;
