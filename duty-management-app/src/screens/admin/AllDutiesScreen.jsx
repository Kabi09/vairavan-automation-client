import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dutyApi from '../../api/dutyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'correction_requested', label: 'Corrections' },
  { key: 'rejected', label: 'Rejected' },
];

export const AllDutiesScreen = () => {
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Review modal state
  const [selectedDuty, setSelectedDuty] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchDuties = useCallback(async () => {
    try {
      setError('');
      const params = { limit: 100 };
      if (activeStatus) params.status = activeStatus;
      if (search.trim()) params.search = search.trim();

      const res = await dutyApi.getAllDuties(params);
      if (res.data?.duties) {
        setDuties(res.data.duties);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load duty reports'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStatus, search]);

  useEffect(() => {
    fetchDuties();
  }, [fetchDuties]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDuties();
  };

  const handleOpenReview = (duty) => {
    setSelectedDuty(duty);
    setReviewStatus(duty.status === 'submitted' ? 'approved' : duty.status);
    setAdminRemarks(duty.adminReview?.remarks || '');
  };

  const handleSubmitReview = async () => {
    if (!selectedDuty) return;
    setReviewLoading(true);

    try {
      await dutyApi.updateDutyStatus(selectedDuty._id, {
        status: reviewStatus,
        remarks: adminRemarks.trim(),
      });
      Alert.alert('Success', `Duty marked as ${reviewStatus}`);
      setSelectedDuty(null);
      fetchDuties();
    } catch (err) {
      Alert.alert('Review Failed', extractErrorMessage(err));
    } finally {
      setReviewLoading(false);
    }
  };

  const renderDutyItem = ({ item }) => (
    <Card style={styles.dutyCard} onPress={() => handleOpenReview(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.companyName}>
            {item.company?.companyName || 'Client Unit'}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.machineRow}>
        <Ionicons name="hardware-chip-outline" size={14} color={COLORS.textSecondary} />{' '}
        {item.machineName} ({item.workType})
      </Text>

      <Text style={styles.descriptionSnippet} numberOfLines={2}>
        {item.workDescription}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.employeeInfo}>
          <Ionicons name="person-outline" size={13} color={COLORS.primary} />
          <Text style={styles.employeeText}>
            {item.employee?.employeeName || 'Technician'} ({item.employee?.employeeId})
          </Text>
        </View>

        <Text style={styles.dateText}>
          {formatDate(item.dutyDate)} • {formatTime(item.inTime)} - {formatTime(item.outTime)}
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Duty Reports"
        subtitle="Review employee field visits and work logs"
      />

      <View style={styles.container}>
        {/* Search */}
        <TextInputField
          placeholder="Search by customer, machine, or description..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        {/* Status Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map((f) => {
            const isSelected = activeStatus === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setActiveStatus(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ErrorMessage message={error} onRetry={fetchDuties} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading duty reports..." />
        ) : (
          <FlatList
            data={duties}
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
                icon="clipboard-outline"
                title="No Reports Found"
                description={
                  activeStatus
                    ? `No duties with status "${activeStatus}".`
                    : 'No field duty reports submitted yet.'
                }
              />
            }
          />
        )}
      </View>

      {/* Review Modal */}
      <Modal
        visible={Boolean(selectedDuty)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDuty(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Review Duty Report</Text>
                <Text style={styles.sheetSub}>
                  {selectedDuty?.customerName} • {formatDate(selectedDuty?.dutyDate)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDuty(null)}>
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody}>
              {/* Report Information */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Technician Details</Text>
                <Text style={styles.detailText}>
                  {selectedDuty?.employee?.employeeName} ({selectedDuty?.employee?.employeeId}) -{' '}
                  {selectedDuty?.employee?.designation}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Machine & Work Type</Text>
                <Text style={styles.detailText}>
                  {selectedDuty?.machineName} • {selectedDuty?.workType}
                </Text>
                <Text style={styles.detailSub}>
                  Timing: {formatTime(selectedDuty?.inTime)} to {formatTime(selectedDuty?.outTime)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Work Description</Text>
                <Text style={styles.descriptionFull}>{selectedDuty?.workDescription}</Text>
              </View>

              {/* Photos & Signature Preview if available */}
              {selectedDuty?.customerProofPhotos?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>Proof Photos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedDuty.customerProofPhotos.map((photo, i) => (
                      <Image
                        key={i}
                        source={{ uri: photo.url }}
                        style={styles.proofThumb}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {selectedDuty?.customerSignature?.url ? (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>Customer Signature</Text>
                  <Image
                    source={{ uri: selectedDuty.customerSignature.url }}
                    style={styles.signatureThumb}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              {/* Decision Section */}
              <View style={styles.decisionSection}>
                <Text style={styles.decisionLabel}>Review Decision</Text>
                <View style={styles.decisionButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.decisionBtn,
                      reviewStatus === 'approved' && styles.decisionBtnApproved,
                    ]}
                    onPress={() => setReviewStatus('approved')}
                  >
                    <Text
                      style={[
                        styles.decisionBtnText,
                        reviewStatus === 'approved' && styles.decisionBtnTextActive,
                      ]}
                    >
                      Approve
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.decisionBtn,
                      reviewStatus === 'correction_requested' && styles.decisionBtnCorrection,
                    ]}
                    onPress={() => setReviewStatus('correction_requested')}
                  >
                    <Text
                      style={[
                        styles.decisionBtnText,
                        reviewStatus === 'correction_requested' && styles.decisionBtnTextActive,
                      ]}
                    >
                      Need Fix
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.decisionBtn,
                      reviewStatus === 'rejected' && styles.decisionBtnRejected,
                    ]}
                    onPress={() => setReviewStatus('rejected')}
                  >
                    <Text
                      style={[
                        styles.decisionBtnText,
                        reviewStatus === 'rejected' && styles.decisionBtnTextActive,
                      ]}
                    >
                      Reject
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInputField
                  label="Admin Remarks (Optional)"
                  placeholder="e.g. Verified by client. Excellent work."
                  value={adminRemarks}
                  onChangeText={setAdminRemarks}
                  multiline
                  numberOfLines={2}
                  style={styles.remarksInput}
                />

                <PrimaryButton
                  title="Submit Decision"
                  onPress={handleSubmitReview}
                  loading={reviewLoading}
                  style={styles.submitDecisionBtn}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  searchBar: {
    marginBottom: SPACING.xs,
  },
  filterScroll: {
    maxHeight: 46,
    marginBottom: SPACING.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.textLight,
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
  headerLeft: {
    flex: 1,
    marginRight: SPACING.sm,
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
  machineRow: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: SPACING.sm,
    fontWeight: '500',
  },
  descriptionSnippet: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
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
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  employeeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  sheetSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sheetBody: {
    marginTop: SPACING.md,
  },
  detailSection: {
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  descriptionFull: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  proofThumb: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  signatureThumb: {
    width: '100%',
    height: 60,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
  },
  decisionSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: SPACING.xxl,
  },
  decisionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  decisionButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  decisionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  decisionBtnApproved: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  decisionBtnCorrection: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  decisionBtnRejected: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  decisionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  decisionBtnTextActive: {
    color: COLORS.textLight,
  },
  remarksInput: {
    marginBottom: SPACING.md,
  },
  submitDecisionBtn: {
    marginTop: SPACING.xs,
  },
});

export default AllDutiesScreen;
