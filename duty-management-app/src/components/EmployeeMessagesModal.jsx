import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import notificationApi from '../api/notificationApi';
import { useNotifications } from '../context/NotificationContext';
import { formatDate } from '../utils/dateUtils';
import { extractErrorMessage } from '../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import EmptyState from './EmptyState';
import MessageDetailsModal from './MessageDetailsModal';

export const EmployeeMessagesModal = ({ visible, onClose }) => {
  const { refreshNotifications } = useNotifications();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      setError('');
      const res = await notificationApi.getMessages({ limit: 50 });
      if (res.data?.notifications) {
        setMessages(res.data.notifications);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load messages'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchMessages();
    }
  }, [visible, fetchMessages]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleMessagePress = async (item) => {
    // 1. Mark as read immediately if unread
    if (!item.isRead) {
      try {
        await notificationApi.markAsRead(item._id);
        setMessages((prev) =>
          prev.map((m) => (m._id === item._id ? { ...m, isRead: true } : m))
        );
        refreshNotifications();
      } catch (err) {
        console.warn('Failed to mark message as read:', err);
      }
    }

    // 2. Open full details modal
    setSelectedMessage(item);
    setDetailsVisible(true);
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const renderMessageCard = ({ item }) => {
    const sender =
      item.data?.senderName ||
      item.sender?.employeeName ||
      'Management';
    const isBroadcast =
      item.data?.isBroadcast ||
      item.recipientRole === 'employee' ||
      item.recipientRole === 'all';
    const recipientName =
      item.data?.recipientName ||
      item.recipient?.employeeName ||
      '';
    const messagePreview =
      item.data?.messageText ||
      item.message ||
      '';

    return (
      <TouchableOpacity
        style={[styles.messageCard, !item.isRead && styles.unreadMessageCard]}
        onPress={() => handleMessagePress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.avatarCircle,
                !item.isRead && styles.avatarCircleUnread,
              ]}
            >
              <Text style={styles.avatarText}>
                {sender.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.senderWrap}>
              <Text style={styles.senderTitle}>{sender}</Text>
              <Text style={styles.timeText}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <View
              style={[
                styles.pill,
                isBroadcast ? styles.pillBroadcast : styles.pillDirect,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: isBroadcast ? '#047857' : COLORS.primary },
                ]}
              >
                {isBroadcast ? 'All Staff' : 'Direct'}
              </Text>
            </View>
            {Boolean(!item.isRead) ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>

        {/* Recipient Target Details: (employee or all) */}
        <View style={styles.recipientTargetRow}>
          <Ionicons
            name={isBroadcast ? 'megaphone-outline' : 'person-outline'}
            size={12}
            color={isBroadcast ? '#047857' : COLORS.primary}
          />
          <Text
            style={[
              styles.recipientTargetText,
              { color: isBroadcast ? '#047857' : COLORS.primary },
            ]}
          >
            {isBroadcast
              ? 'Target: All Employees (Broadcast)'
              : `Target: Specific Employee ${recipientName ? `(${recipientName})` : '(Direct)'}`}
          </Text>
        </View>

        <Text style={styles.previewText} numberOfLines={2}>
          {messagePreview}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailsText}>Tap to view full message</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-unread" size={22} color={COLORS.primary} />
                </View>
                <View>
                  <View style={styles.titleRow}>
                    <Text style={styles.modalTitle}>Messages</Text>
                    {Boolean(unreadCount > 0) ? (
                      <View style={styles.badgeWrap}>
                        <Text style={styles.badgeText}>{unreadCount} new</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.modalSubTitle}>Notices from Management</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* List */}
            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading messages...</Text>
              </View>
            ) : (
              <FlatList
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessageCard}
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
                    icon="chatbox-outline"
                    title="No Messages"
                    description="You have no messages from management yet. Important broadcasts and notes will appear here."
                  />
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Full Message Details Modal */}
      <MessageDetailsModal
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        messageItem={selectedMessage}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '100%',
    height: '82%',
    ...SHADOWS.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeWrap: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  modalSubTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  messageCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  unreadMessageCard: {
    borderColor: COLORS.primaryLight,
    backgroundColor: '#F8FAFF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarCircleUnread: {
    backgroundColor: COLORS.primary,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  senderWrap: {
    flex: 1,
  },
  senderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pillBroadcast: {
    backgroundColor: '#D1FAE5',
  },
  pillDirect: {
    backgroundColor: COLORS.primarySubtle,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  recipientTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 4,
  },
  recipientTargetText: {
    fontSize: 11,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginVertical: SPACING.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default EmployeeMessagesModal;
