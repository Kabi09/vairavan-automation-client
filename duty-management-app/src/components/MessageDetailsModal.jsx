import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '../utils/dateUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

export const MessageDetailsModal = ({ visible, onClose, messageItem }) => {
  if (!messageItem) return null;

  const title = messageItem.title || 'Message from Management';
  const bodyText =
    messageItem.data?.messageText ||
    messageItem.message ||
    messageItem.data?.description ||
    'No message content provided.';

  const senderName =
    messageItem.data?.senderName ||
    messageItem.sender?.employeeName ||
    (messageItem.senderRole === 'admin' ? 'Administrator' : 'Management');

  const isBroadcast =
    messageItem.data?.isBroadcast ||
    messageItem.recipientRole === 'employee' ||
    messageItem.recipientRole === 'all';

  const recipientName =
    messageItem.data?.recipientName ||
    messageItem.recipient?.employeeName ||
    '';

  const dateStr = messageItem.createdAt
    ? formatDate(messageItem.createdAt)
    : 'Recent';

  // Format time if available
  let timeStr = '';
  if (messageItem.createdAt) {
    try {
      const d = new Date(messageItem.createdAt);
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      timeStr = '';
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.modalSubTitle}>Announcement & Notice</Text>
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

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Target Audience Banner: All Employees vs Specific Employee */}
            <View
              style={[
                styles.targetAudienceCard,
                isBroadcast ? styles.targetAudienceAll : styles.targetAudienceDirect,
              ]}
            >
              <Ionicons
                name={isBroadcast ? 'megaphone' : 'person'}
                size={18}
                color={isBroadcast ? '#047857' : COLORS.primary}
              />
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text
                  style={[
                    styles.targetAudienceTitle,
                    { color: isBroadcast ? '#047857' : COLORS.primary },
                  ]}
                >
                  {isBroadcast ? 'Recipient: All Employees' : 'Recipient: Specific Employee'}
                </Text>
                <Text style={styles.targetAudienceSubtitle}>
                  {isBroadcast
                    ? 'Broadcast message sent to all active employees'
                    : recipientName
                    ? `Direct message sent to ${recipientName}`
                    : 'Direct message sent to designated employee'}
                </Text>
              </View>
            </View>

            {/* Sender and meta card */}
            <View style={styles.senderCard}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarLetter}>
                  {(senderName || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.senderInfo}>
                <Text style={styles.senderName}>{senderName}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {dateStr} {timeStr ? `• ${timeStr}` : ''}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.broadcastPill,
                  isBroadcast ? styles.broadcastPillAll : styles.broadcastPillDirect,
                ]}
              >
                <Ionicons
                  name={isBroadcast ? 'megaphone-outline' : 'person-outline'}
                  size={12}
                  color={isBroadcast ? '#047857' : COLORS.primary}
                />
                <Text
                  style={[
                    styles.broadcastPillText,
                    { color: isBroadcast ? '#047857' : COLORS.primary },
                  ]}
                >
                  {isBroadcast ? 'All Staff' : 'Direct'}
                </Text>
              </View>
            </View>

            {/* Message Body Box */}
            <View style={styles.messageBox}>
              <View style={styles.messageBoxHeader}>
                <Ionicons name="mail-open-outline" size={16} color={COLORS.primary} />
                <Text style={styles.messageBoxLabel}>Message Content</Text>
              </View>
              <Text style={styles.messageContent} selectable>
                {bodyText}
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <PrimaryButton
              title="Close"
              onPress={onClose}
              icon="checkmark-outline"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '100%',
    maxHeight: '80%',
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
  headerTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
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
  scrollArea: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  targetAudienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  targetAudienceAll: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  targetAudienceDirect: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  targetAudienceTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  targetAudienceSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  senderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  broadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  broadcastPillAll: {
    backgroundColor: '#D1FAE5',
  },
  broadcastPillDirect: {
    backgroundColor: COLORS.primarySubtle,
  },
  broadcastPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  messageBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  messageBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  messageBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default MessageDetailsModal;
