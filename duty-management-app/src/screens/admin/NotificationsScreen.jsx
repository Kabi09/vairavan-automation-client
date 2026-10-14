import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import notificationApi from '../../api/notificationApi';
import leaveApi from '../../api/leaveApi';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import MessageDetailsModal from '../../components/MessageDetailsModal';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const NotificationsScreen = ({ navigation }) => {
  const { user, isAdmin } = useAuth();
  const { refreshNotifications: refreshGlobalNotifications } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Decision Modal State
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [decisionType, setDecisionType] = useState('approved'); // 'approved' | 'rejected'
  const [adminRemarks, setAdminRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Message Details Modal State
  const [messageDetailsModalVisible, setMessageDetailsModalVisible] = useState(false);
  const [selectedMessageNotif, setSelectedMessageNotif] = useState(null);


  const fetchNotifications = useCallback(async () => {
    try {
      setError('');
      const res = await notificationApi.getNotifications({ limit: 50 });
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load notifications'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      refreshGlobalNotifications();
    }, [fetchNotifications, refreshGlobalNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
    refreshGlobalNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      refreshGlobalNotifications();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Could not mark all as read'));
    }
  };

  const handleOpenDecision = (notif, type) => {
    setSelectedNotif(notif);
    setDecisionType(type);
    setAdminRemarks(type === 'approved' ? 'Approved' : 'Rejected');
  };

  const handleConfirmDecision = async () => {
    if (!selectedNotif?.data?.leaveId) {
      Alert.alert('Error', 'Missing leave reference on this notification.');
      return;
    }

    const leaveId = typeof selectedNotif.data.leaveId === 'object'
      ? selectedNotif.data.leaveId._id
      : selectedNotif.data.leaveId;

    setSubmittingDecision(true);
    try {
      await leaveApi.reviewLeave(leaveId, {
        status: decisionType,
        adminRemarks: adminRemarks.trim(),
      });

      // Mark notification as read and update its status locally
      await notificationApi.markAsRead(selectedNotif._id);

      setNotifications((prev) =>
        prev.map((n) => {
          if (n._id === selectedNotif._id) {
            return {
              ...n,
              isRead: true,
              data: {
                ...n.data,
                status: decisionType,
                adminRemarks: adminRemarks.trim(),
              },
            };
          }
          return n;
        })
      );

      Alert.alert(
        'Success',
        `Leave request for ${selectedNotif.data?.employeeName || 'employee'} has been ${decisionType}.`
      );
      setSelectedNotif(null);
      fetchNotifications();
      refreshGlobalNotifications();
    } catch (err) {
      Alert.alert('Decision Failed', extractErrorMessage(err, 'Could not process leave review'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleNotificationPress = async (item) => {
    // 1. If unread, mark as read immediately & decrement count
    if (!item.isRead) {
      try {
        await notificationApi.markAsRead(item._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        refreshGlobalNotifications();
      } catch (e) {
        console.warn('Could not mark notification as read on click:', e);
      }
    }

    // 2. Navigate based on notification type
    const notifType = item.type || '';

    if (notifType === 'message') {
      setSelectedMessageNotif(item);
      setMessageDetailsModalVisible(true);
      return;
    }

    if (notifType === 'holiday' || notifType === 'holiday_created') {
      if (isAdmin) {
        navigation.navigate('HolidayManagement');
      } else {
        navigation.navigate('HolidayList');
      }
      return;
    }

    if (notifType === 'leave_request' || notifType === 'leave_reviewed') {
      navigation.navigate('LeavesTab');
      return;
    }

    if (
      notifType.includes('duty') ||
      notifType.includes('work') ||
      item.data?.dutyId ||
      item.data?.workId
    ) {
      const targetId = item.data?.dutyId || item.data?.workId;
      if (targetId) {
        navigation.navigate('DutyDetails', { dutyId: targetId });
      } else if (isAdmin) {
        navigation.navigate('DutiesTab');
      } else {
        navigation.navigate('MyDutiesTab');
      }
      return;
    }
  };

  const renderNotificationCard = ({ item }) => {
    const isHoliday = item.type === 'holiday' || item.type === 'holiday_created';
    const isLeave = item.type === 'leave_request' || item.type === 'leave_reviewed';
    const isMessage = item.type === 'message';
    const leaveData = item.data || {};
    const leaveStatus = leaveData.status || 'pending';
    const isPending = leaveStatus === 'pending';

    return (
      <Card
        style={[styles.card, !item.isRead && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        {/* Top Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.notifLogoImage}
                resizeMode="cover"
              />
              <View
                style={[
                  styles.statusDot,
                  isMessage
                    ? styles.dotMessage
                    : isHoliday
                    ? styles.dotHoliday
                    : item.type === 'leave_request'
                    ? styles.dotWarning
                    : leaveStatus === 'approved'
                    ? styles.dotSuccess
                    : styles.dotDanger,
                ]}
              />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
          {isLeave && <StatusBadge status={leaveStatus} />}
          {isHoliday && (
            <View style={styles.holidayBadgePill}>
              <Text style={styles.holidayBadgePillText}>Holiday 🎉</Text>
            </View>
          )}
          {isMessage && (
            <View style={styles.messageBadgePill}>
              <Text style={styles.messageBadgePillText}>Message 💬</Text>
            </View>
          )}
        </View>

        {/* Message Details */}
        {isMessage && (
          <View style={styles.messageDetailsBox}>
            <View style={styles.detailRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.primary} />
              <Text style={styles.detailLabel}>From:</Text>
              <Text style={[styles.detailValue, { fontWeight: '700', color: COLORS.text }]}>
                {item.data?.senderName || item.sender?.employeeName || 'Management'}
              </Text>
            </View>
            <View style={[styles.detailRow, { alignItems: 'flex-start', marginTop: 4 }]}>
              <Ionicons name="document-text-outline" size={15} color={COLORS.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.detailLabel}>Notice:</Text>
              <Text style={[styles.detailValue, styles.reasonText]} numberOfLines={2}>
                {item.data?.messageText || item.message}
              </Text>
            </View>
            <View style={styles.tapToViewRow}>
              <Text style={styles.tapToViewText}>Tap to view full message details</Text>
              <Ionicons name="arrow-forward" size={12} color="#2563EB" />
            </View>
          </View>
        )}

        {/* Holiday Details */}
        {isHoliday && (
          <View style={styles.holidayDetailsBox}>
            <View style={styles.detailRow}>
              <Ionicons name="sparkles" size={15} color="#15803D" />
              <Text style={styles.detailLabel}>Holiday:</Text>
              <Text style={[styles.detailValue, { fontWeight: '700', color: '#15803D' }]}>
                {item.data?.holidayName || item.title}
              </Text>
            </View>
            {item.data?.startDate ? (
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.detailLabel}>Duration:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(item.data.startDate)}
                  {item.data.endDate && item.data.endDate !== item.data.startDate
                    ? ` - ${formatDate(item.data.endDate)}`
                    : ''}
                </Text>
              </View>
            ) : null}
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="information-circle-outline" size={15} color={COLORS.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.detailLabel}>Details:</Text>
              <Text style={[styles.detailValue, styles.reasonText]}>
                {item.data?.description || item.message}
              </Text>
            </View>
            <View style={styles.tapToViewRow}>
              <Text style={styles.tapToViewText}>Tap to view holiday calendar</Text>
              <Ionicons name="arrow-forward" size={12} color="#15803D" />
            </View>
          </View>
        )}



        {/* Detailed Information for Leave */}
        {isLeave && (
          <View style={styles.detailsBox}>
            {/* User / Employee */}
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={15} color={COLORS.textSecondary} />
              <Text style={styles.detailLabel}>Employee:</Text>
              <Text style={styles.detailValue}>
                {leaveData.employeeName || item.sender?.employeeName || 'Employee'}
                {leaveData.employeeId ? ` (${leaveData.employeeId})` : ''}
              </Text>
            </View>

            {/* Dates */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.textSecondary} />
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>
                {formatDate(leaveData.startDate)} - {formatDate(leaveData.endDate)}
              </Text>
            </View>

            {/* Reason */}
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text-outline" size={15} color={COLORS.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.detailLabel}>Reason:</Text>
              <Text style={[styles.detailValue, styles.reasonText]}>
                {leaveData.reason || item.message}
              </Text>
            </View>

            {/* Admin Remarks if reviewed */}
            {leaveData.adminRemarks ? (
              <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.primary} style={{ marginTop: 2 }} />
                <Text style={styles.detailLabel}>Remarks:</Text>
                <Text style={[styles.detailValue, { color: COLORS.primary }]}>
                  {leaveData.adminRemarks}
                </Text>
              </View>
            ) : null}

            <View style={styles.tapToViewRow}>
              <Text style={styles.tapToViewText}>Tap to view leave details</Text>
              <Ionicons name="arrow-forward" size={12} color="#2563EB" />
            </View>
          </View>
        )}

        {/* Action Buttons for Admin when leave is Pending */}
        {isAdmin && isPending && leaveData.leaveId && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={(e) => {
                e.stopPropagation?.();
                handleOpenDecision(item, 'approved');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={(e) => {
                e.stopPropagation?.();
                handleOpenDecision(item, 'rejected');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={styles.markReadText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ErrorMessage message={error} onRetry={fetchNotifications} />

      {loading && !refreshing ? (
        <LoadingIndicator message="Loading notifications..." />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotificationCard}
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
              icon="notifications-off-outline"
              title="No Notifications"
              message="You have no notifications at this time. New leave requests and updates will appear here."
            />
          }
        />
      )}

      {/* Decision Remarks Modal */}
      <Modal
        visible={!!selectedNotif}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotif(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={decisionType === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={28}
                color={decisionType === 'approved' ? COLORS.success : COLORS.danger}
              />
              <Text style={styles.modalTitle}>
                {decisionType === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </Text>
            </View>

            <Text style={styles.modalSubtitle}>
              {decisionType === 'approved'
                ? `Grant leave for ${selectedNotif?.data?.employeeName || 'employee'}?`
                : `Decline leave for ${selectedNotif?.data?.employeeName || 'employee'}?`}
            </Text>

            <TextInputField
              label="Admin Remarks"
              placeholder="e.g. Approved for family visit / Manpower shortage"
              value={adminRemarks}
              onChangeText={setAdminRemarks}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setSelectedNotif(null)}
                style={{ flex: 1 }}
                disabled={submittingDecision}
              />
              <PrimaryButton
                title={decisionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleConfirmDecision}
                loading={submittingDecision}
                style={[
                  { flex: 1.4 },
                  decisionType === 'rejected' && { backgroundColor: COLORS.danger },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Message Details Modal */}
      <MessageDetailsModal
        visible={messageDetailsModalVisible}
        onClose={() => setMessageDetailsModalVisible(false)}
        messageItem={selectedMessageNotif}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    backgroundColor: '#F8FAFC',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  logoBadgeContainer: {
    position: 'relative',
    width: 42,
    height: 42,
    marginRight: SPACING.sm,
  },
  notifLogoImage: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dotWarning: {
    backgroundColor: COLORS.warning,
  },
  dotSuccess: {
    backgroundColor: COLORS.success,
  },
  dotDanger: {
    backgroundColor: COLORS.danger,
  },
  dotHoliday: {
    backgroundColor: '#16A34A',
  },
  holidayBadgePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  holidayBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  titleBlock: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
    gap: 6,
  },
  holidayDetailsBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tapToViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  tapToViewText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 60,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  reasonText: {
    fontStyle: 'italic',
    color: COLORS.text,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  rejectBtn: {
    backgroundColor: COLORS.danger,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  markReadText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  dotMessage: {
    backgroundColor: '#0284C7',
  },
  messageBadgePill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  messageBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  messageDetailsBox: {
    marginTop: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: '#F0F9FF',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
});

export default NotificationsScreen;
