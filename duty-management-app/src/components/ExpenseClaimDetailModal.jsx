import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { formatDate } from '../utils/dateUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Helper to robustly parse expense item category name, calculations, amount, and proof photos
 */
export const parseExpenseItem = (item, index = 0) => {
  // 1. Resolve Category Name: NEVER show ObjectId!
  let catName = item.categoryName;
  if (!catName && item.category) {
    if (typeof item.category === 'object' && (item.category.name || item.category.categoryName)) {
      catName = item.category.name || item.category.categoryName;
    } else if (typeof item.category === 'string' && !/^[0-9a-fA-F]{24}$/.test(item.category)) {
      catName = item.category;
    }
  }
  if (!catName || /^[0-9a-fA-F]{24}$/.test(catName)) {
    catName = item.customTitle || item.customCategory || item.customCategoryName || `Item #${index + 1}`;
  }

  const customTitle = item.customTitle || item.customCategory || item.customCategoryName || '';
  const isOthers = catName === 'Others' || catName === 'other';
  const displayTitle =
    isOthers && customTitle
      ? `Others: ${customTitle}`
      : customTitle && customTitle !== catName
      ? `${catName} (${customTitle})`
      : catName;

  // 2. Resolve Calculation text
  let calcText = null;
  const outbound = Number(item.outboundDistance ?? item.outboundDistanceKm) || 0;
  const returnDist = Number(item.returnDistance ?? item.returnDistanceKm) || 0;
  const totalDist =
    Number(item.totalDistance) ||
    outbound + returnDist ||
    Number(item.distanceKm) ||
    Number(item.quantity) ||
    0;
  const rate = Number(item.ratePerUnit ?? item.ratePerKm ?? item.appliedRate) || 0;
  const unit = item.unit || 'km';

  if (item.calculationMode === 'automatic' || (totalDist > 0 && rate > 0)) {
    if (outbound > 0 || returnDist > 0) {
      calcText = `Out: ${outbound} ${unit} + Ret: ${returnDist} ${unit} = ${totalDist} ${unit} @ ₹${rate}/${unit}`;
    } else {
      calcText = `${totalDist} ${unit} @ ₹${rate}/${unit}`;
    }
  }

  // 3. Resolve Amount
  const amount = Number(item.amount) || 0;

  // 4. Resolve Description
  const description = item.description ? item.description.trim() : '';

  // 5. Resolve Attachments / Proof Images
  const proofUrls = [];
  if (Array.isArray(item.attachments)) {
    item.attachments.forEach((att) => {
      const u = typeof att === 'string' ? att : att?.url;
      if (u && !proofUrls.includes(u)) proofUrls.push(u);
    });
  }
  if (item.billProof) {
    const u = typeof item.billProof === 'string' ? item.billProof : item.billProof?.url;
    if (u && !proofUrls.includes(u)) proofUrls.push(u);
  }

  return {
    categoryName: catName,
    displayTitle,
    calcText,
    amount,
    description,
    proofUrls,
  };
};

/**
 * Modal to display full expense details and proof images when tapping an expense claim
 */
export const ExpenseClaimDetailModal = ({
  visible,
  expense,
  duty,
  onClose,
  onOpenPhoto,
  onEdit,
}) => {
  if (!expense) return null;

  const claimId = expense.expenseId || `EXP-${(expense._id || '').slice(-4).toUpperCase()}`;
  const expDate = expense.expenseDate ? formatDate(expense.expenseDate) : '';
  const totalAmount = Number(expense.grandTotal ?? expense.totalAmount ?? expense.amount ?? 0);

  const rawItems =
    Array.isArray(expense.items) && expense.items.length > 0
      ? expense.items
      : [
          {
            categoryName: expense.categoryName || expense.category,
            customTitle: expense.customTitle || expense.customCategory,
            amount: expense.amount || expense.totalAmount || 0,
            description: expense.description || '',
            attachments: expense.proofs || (expense.billProof ? [expense.billProof] : []),
          },
        ];

  const parsedItems = rawItems.map((it, idx) => parseExpenseItem(it, idx));

  // Global proofs
  const globalProofs = [];
  if (Array.isArray(expense.proofs)) {
    expense.proofs.forEach((p) => {
      const u = typeof p === 'string' ? p : p?.url;
      if (u && !globalProofs.includes(u)) globalProofs.push(u);
    });
  }

  const workCode =
    expense.duty?.dutyId ||
    expense.relatedDuty ||
    duty?.dutyId ||
    (duty?._id ? `WORK-${duty._id.slice(-6).toUpperCase()}` : '');
  const machineName = expense.duty?.machineName || duty?.machineName || '';

  const companyName =
    expense.company?.companyName ||
    duty?.company?.companyName ||
    (typeof expense.company === 'string' ? expense.company : '');
  const clientName =
    expense.client?.name ||
    expense.client?.clientName ||
    duty?.client?.name ||
    duty?.customerName ||
    expense.customerName ||
    '';
  const clientPhone =
    expense.client?.phoneNumber ||
    expense.client?.clientPhoneNumber ||
    duty?.client?.phoneNumber ||
    duty?.customerPhoneNumber ||
    '';

  const employeeName =
    expense.employee?.employeeName || duty?.employee?.employeeName || '';
  const employeeId =
    expense.employee?.employeeId || duty?.employee?.employeeId || '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="receipt" size={20} color={COLORS.primary} />
                <Text style={styles.headerTitle}>Expense Claim Details</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {claimId} • {expDate || 'Logged Record'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {Boolean(onEdit) && (
                <TouchableOpacity
                  style={styles.headerEditBtn}
                  onPress={() => {
                    onClose?.();
                    onEdit(expense);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={15} color="#1E40AF" />
                  <Text style={styles.headerEditBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Top Overview KPI Card */}
            <View style={styles.overviewCard}>
              <View style={styles.overviewTopRow}>
                <View>
                  <Text style={styles.overviewAmountLabel}>Total Claimed Amount</Text>
                  <Text style={styles.overviewAmountVal}>
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
                {expense.status ? (
                  <StatusBadge status={expense.status} />
                ) : (
                  <View style={styles.submittedBadge}>
                    <Text style={styles.submittedBadgeText}>Submitted</Text>
                  </View>
                )}
              </View>

              {/* Work Order Info */}
              {workCode ? (
                <View style={styles.metaRow}>
                  <Ionicons name="briefcase-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.metaText}>
                    Work Order: <Text style={styles.metaHighlight}>{workCode}</Text>
                    {machineName ? ` (${machineName})` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Company & Client */}
              {companyName ? (
                <View style={styles.metaRow}>
                  <Ionicons name="business-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {companyName}
                    {clientName ? ` • Client: ${clientName}` : ''}
                    {clientPhone ? ` (${clientPhone})` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Employee */}
              {employeeName ? (
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    Submitted By: {employeeName}
                    {employeeId ? ` (${employeeId})` : ''}
                  </Text>
                </View>
              ) : null}

              {/* General Note */}
              {expense.generalDescription ? (
                <View style={styles.generalNoteBox}>
                  <Text style={styles.generalNoteLabel}>General Note / Purpose:</Text>
                  <Text style={styles.generalNoteText}>{expense.generalDescription}</Text>
                </View>
              ) : null}
            </View>

            {/* Itemized Expenses Section */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="list-outline" size={16} color={COLORS.text} />
              <Text style={styles.sectionTitle}>
                Itemized Expenses ({parsedItems.length})
              </Text>
            </View>

            <View style={styles.itemsList}>
              {parsedItems.map((item, idx) => (
                <View key={`item-${idx}`} style={styles.itemCard}>
                  {/* Item Header */}
                  <View style={styles.itemCardHeader}>
                    <View style={styles.itemTitleRow}>
                      <View style={styles.itemNumberBadge}>
                        <Text style={styles.itemNumberText}>#{idx + 1}</Text>
                      </View>
                      <Text style={styles.itemCategoryTitle}>{item.displayTitle}</Text>
                    </View>
                    <Text style={styles.itemAmountText}>
                      ₹{item.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  {/* Distance / Rate Calculation if applicable */}
                  {item.calcText ? (
                    <View style={styles.calcBox}>
                      <Ionicons name="calculator-outline" size={13} color="#4338CA" />
                      <Text style={styles.calcText}>{item.calcText}</Text>
                    </View>
                  ) : null}

                  {/* Notes / Description */}
                  {item.description ? (
                    <View style={styles.itemDescBox}>
                      <Text style={styles.itemDescLabel}>Notes / Reason:</Text>
                      <Text style={styles.itemDescText}>{item.description}</Text>
                    </View>
                  ) : null}

                  {/* Proof Photos for this item */}
                  {item.proofUrls.length > 0 ? (
                    <View style={styles.proofsSection}>
                      <Text style={styles.proofsLabel}>
                        📷 Bill / Proof Photos ({item.proofUrls.length}):
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.proofsRow}
                      >
                        {item.proofUrls.map((pUrl, pIdx) => (
                          <TouchableOpacity
                            key={`proof-${pIdx}`}
                            style={styles.proofCard}
                            onPress={() =>
                              onOpenPhoto?.(
                                pUrl,
                                `Bill Proof: ${item.displayTitle}`,
                                `${claimId} • Item #${idx + 1}`
                              )
                            }
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: pUrl }}
                              style={styles.proofImage}
                              resizeMode="cover"
                            />
                            <View style={styles.zoomHintOverlay}>
                              <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                              <Text style={styles.zoomHintText}>Tap to Zoom</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <View style={styles.noProofNote}>
                      <Ionicons name="document-text-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.noProofText}>No bill receipt attached for this item.</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Global Attachments */}
            {globalProofs.length > 0 ? (
              <View style={styles.globalProofsBox}>
                <Text style={styles.sectionTitle}>
                  General Claim Attachments ({globalProofs.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.proofsRow}
                >
                  {globalProofs.map((pUrl, pIdx) => (
                    <TouchableOpacity
                      key={`global-proof-${pIdx}`}
                      style={styles.proofCard}
                      onPress={() =>
                        onOpenPhoto?.(
                          pUrl,
                          `General Claim Attachment #${pIdx + 1}`,
                          claimId
                        )
                      }
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: pUrl }}
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                      <View style={styles.zoomHintOverlay}>
                        <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.zoomHintText}>Tap to Zoom</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            {Boolean(onEdit) && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  onClose?.();
                  onEdit(expense);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Edit Expense Details</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.closeBtn, Boolean(onEdit) && { flex: 1 }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  editBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: SCREEN_HEIGHT * 0.5,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scrollBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  overviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
  },
  overviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  overviewAmountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  overviewAmountVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#047857',
    marginTop: 2,
  },
  submittedBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  submittedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  metaHighlight: {
    fontWeight: '700',
    color: COLORS.text,
  },
  generalNoteBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  generalNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  generalNoteText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemsList: {
    gap: 10,
    marginBottom: SPACING.lg,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    ...SHADOWS.sm,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  itemNumberBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemNumberText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  itemCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  itemAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  calcBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  calcText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '600',
  },
  itemDescBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemDescLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  itemDescText: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 1,
  },
  proofsSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  proofsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  proofsRow: {
    gap: 10,
    paddingVertical: 4,
  },
  proofCard: {
    width: 110,
    height: 110,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  proofImage: {
    width: '100%',
    height: '100%',
  },
  zoomHintOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    gap: 3,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  noProofNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  noProofText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  globalProofsBox: {
    marginBottom: SPACING.xl,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  closeBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ExpenseClaimDetailModal;
