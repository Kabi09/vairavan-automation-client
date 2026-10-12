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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dutyApi from '../../api/dutyApi';
import employeeApi from '../../api/employeeApi';
import companyApi from '../../api/companyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportDutiesToPDF, exportDutiesToExcel } from '../../utils/exportUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const AllDutiesScreen = () => {
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Filter options
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter selection modal
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Read-only Duty Detail Modal (No approval workflow)
  const [selectedDuty, setSelectedDuty] = useState(null);

  // Load filter lists (employees and companies)
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [empRes, compRes] = await Promise.all([
          employeeApi.getEmployees({ limit: 200 }).catch(() => ({ data: { employees: [] } })),
          companyApi.getCompanies({ limit: 200 }).catch(() => ({ data: { companies: [] } })),
        ]);
        if (empRes.data?.employees) setEmployees(empRes.data.employees);
        if (compRes.data?.companies) setCompanies(compRes.data.companies);
      } catch (err) {
        console.warn('Failed to load filter options:', err);
      }
    };

    loadFilterData();
  }, []);

  // Fetch duties based on active filters
  const fetchDuties = useCallback(async () => {
    try {
      setError('');
      const params = { limit: 500 };
      if (search.trim()) params.search = search.trim();
      if (selectedEmployeeId) params.employeeId = selectedEmployeeId;
      if (selectedCompanyId) params.companyId = selectedCompanyId;
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await dutyApi.getAllDuties(params);
      if (res.data?.duties) {
        setDuties(res.data.duties);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load duty records'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedEmployeeId, selectedCompanyId, startDate, endDate]);

  useEffect(() => {
    fetchDuties();
  }, [fetchDuties]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDuties();
  };

  // Export actions
  const handleExportPDF = () => {
    const selectedEmpObj = employees.find((e) => e._id === selectedEmployeeId);
    const selectedCompObj = companies.find((c) => c._id === selectedCompanyId);

    const filterDetails = [];
    if (selectedEmpObj) filterDetails.push(`Employee: ${selectedEmpObj.employeeName}`);
    if (selectedCompObj) filterDetails.push(`Company: ${selectedCompObj.companyName}`);
    if (startDate || endDate) {
      filterDetails.push(`Date: ${startDate || 'Start'} to ${endDate || 'Present'}`);
    }

    const filterInfo = filterDetails.length > 0 ? filterDetails.join(' • ') : 'All Submissions';

    exportDutiesToPDF({
      title: 'Duty Field Records',
      subtitle: 'Complete Field Visit & Operational Work Reports',
      duties,
      filterInfo,
    });
  };

  const handleExportExcel = () => {
    exportDutiesToExcel({
      filename: 'Field_Duty_Records',
      duties,
    });
  };

  const clearFilters = () => {
    setSelectedEmployeeId('');
    setSelectedCompanyId('');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  const hasActiveFilters = Boolean(
    selectedEmployeeId || selectedCompanyId || startDate || endDate || search
  );

  const renderDutyItem = ({ item }) => (
    <Card style={styles.dutyCard} onPress={() => setSelectedDuty(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.companyName}>
            <Ionicons name="business-outline" size={13} color={COLORS.textSecondary} />{' '}
            {item.company?.companyName || 'Client Site'}
          </Text>
        </View>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
          <Text style={styles.dateBadgeText}>{formatDate(item.dutyDate)}</Text>
        </View>
      </View>

      <Text style={styles.machineRow}>
        <Ionicons name="hardware-chip-outline" size={13} color={COLORS.textSecondary} />{' '}
        {item.machineName} • <Text style={styles.workTypeLabel}>{item.workType}</Text>
      </Text>

      <Text style={styles.descriptionSnippet} numberOfLines={2}>
        {item.workDescription}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.employeeInfo}>
          <Ionicons name="person-outline" size={13} color={COLORS.primary} />
          <Text style={styles.employeeText}>
            {item.employee?.employeeName || 'Staff'} ({item.employee?.employeeId})
          </Text>
        </View>

        <Text style={styles.timeText}>
          <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />{' '}
          {formatTime(item.inTime)} - {formatTime(item.outTime)}
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Duty Management"
        subtitle="View field visit logs & service records"
        rightAction={
          <TouchableOpacity
            style={[styles.filterToggleBtn, hasActiveFilters && styles.filterToggleBtnActive]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={hasActiveFilters ? 'funnel' : 'funnel-outline'}
              size={18}
              color={hasActiveFilters ? COLORS.textLight : COLORS.primary}
            />
            <Text
              style={[
                styles.filterToggleText,
                hasActiveFilters && styles.filterToggleTextActive,
              ]}
            >
              Filter
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <TextInputField
          placeholder="Search customer, machine, or description..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        {/* Export Toolbar Card */}
        <View style={styles.exportToolbar}>
          <View style={styles.countWrap}>
            <Text style={styles.countText}>
              <Text style={styles.countHighlight}>{duties.length}</Text> reports
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearFilterLink}>
                <Text style={styles.clearFilterText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[styles.exportBtn, styles.pdfBtn]}
              onPress={handleExportPDF}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text" size={15} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, styles.excelBtn]}
              onPress={handleExportExcel}
              activeOpacity={0.8}
            >
              <Ionicons name="grid" size={15} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>Excel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ErrorMessage message={error} onRetry={fetchDuties} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading duty records..." />
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
                title="No Duty Records Found"
                description={
                  hasActiveFilters
                    ? 'No duty reports match the selected filters.'
                    : 'No service reports have been submitted yet.'
                }
                actionTitle={hasActiveFilters ? 'Clear Filters' : undefined}
                onAction={hasActiveFilters ? clearFilters : undefined}
              />
            }
          />
        )}
      </View>

      {/* Filter Modal (Date, Employee, Company) */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter Duty Records</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Date Filters */}
              <Text style={styles.filterSectionLabel}>Date Range</Text>
              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1, marginRight: SPACING.xs }}>
                  <TextInputField
                    label="From Date"
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.xs }}>
                  <TextInputField
                    label="To Date"
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>

              {/* Employee Filter */}
              <Text style={styles.filterSectionLabel}>Filter By Employee</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipScroll}
                contentContainerStyle={styles.filterChipRow}
              >
                <TouchableOpacity
                  style={[
                    styles.pickerChip,
                    !selectedEmployeeId && styles.pickerChipSelected,
                  ]}
                  onPress={() => setSelectedEmployeeId('')}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      !selectedEmployeeId && styles.pickerChipTextSelected,
                    ]}
                  >
                    All Staff
                  </Text>
                </TouchableOpacity>
                {employees.map((emp) => {
                  const isSelected = selectedEmployeeId === emp._id;
                  return (
                    <TouchableOpacity
                      key={emp._id}
                      style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                      onPress={() => setSelectedEmployeeId(emp._id)}
                    >
                      <Text
                        style={[
                          styles.pickerChipText,
                          isSelected && styles.pickerChipTextSelected,
                        ]}
                      >
                        {emp.employeeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Company Filter */}
              <Text style={styles.filterSectionLabel}>Filter By Company</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipScroll}
                contentContainerStyle={styles.filterChipRow}
              >
                <TouchableOpacity
                  style={[
                    styles.pickerChip,
                    !selectedCompanyId && styles.pickerChipSelected,
                  ]}
                  onPress={() => setSelectedCompanyId('')}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      !selectedCompanyId && styles.pickerChipTextSelected,
                    ]}
                  >
                    All Companies
                  </Text>
                </TouchableOpacity>
                {companies.map((comp) => {
                  const isSelected = selectedCompanyId === comp._id;
                  return (
                    <TouchableOpacity
                      key={comp._id}
                      style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                      onPress={() => setSelectedCompanyId(comp._id)}
                    >
                      <Text
                        style={[
                          styles.pickerChipText,
                          isSelected && styles.pickerChipTextSelected,
                        ]}
                      >
                        {comp.companyName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.filterActions}>
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    clearFilters();
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={styles.resetFilterBtnText}>Reset All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyFilterBtn}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={styles.applyFilterBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Read-Only Duty Detail Modal (Pure Viewing, NO Approve/Reject buttons) */}
      <Modal
        visible={Boolean(selectedDuty)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDuty(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Duty Report Details</Text>
                <Text style={styles.sheetSub}>
                  {selectedDuty?.customerName} • {formatDate(selectedDuty?.dutyDate)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDuty(null)}>
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Technician Info */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>Submitted By (Staff)</Text>
                <Text style={styles.blockValue}>
                  {selectedDuty?.employee?.employeeName} ({selectedDuty?.employee?.employeeId})
                </Text>
                <Text style={styles.blockSub}>
                  Designation: {selectedDuty?.employee?.designation || 'Staff'} •{' '}
                  {selectedDuty?.employee?.email}
                </Text>
              </View>

              {/* Company & Customer */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>Client Company & Contact</Text>
                <Text style={styles.blockValue}>
                  {selectedDuty?.company?.companyName} ({selectedDuty?.company?.location})
                </Text>
                <Text style={styles.blockSub}>
                  Contact: {selectedDuty?.customerName} ({selectedDuty?.customerPhoneNumber})
                </Text>
              </View>

              {/* Machine & Working Hours */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>Equipment & Hours</Text>
                <Text style={styles.blockValue}>
                  {selectedDuty?.machineName} ({selectedDuty?.workType})
                </Text>
                <Text style={styles.blockSub}>
                  Hours: {formatTime(selectedDuty?.inTime)} to {formatTime(selectedDuty?.outTime)}
                </Text>
              </View>

              {/* GPS Coordinates */}
              {selectedDuty?.location?.latitude && (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>GPS Location Tag</Text>
                  <Text style={styles.blockValue}>
                    {selectedDuty.location.latitude.toFixed(5)},{' '}
                    {selectedDuty.location.longitude.toFixed(5)}
                  </Text>
                  {selectedDuty.location.accuracy && (
                    <Text style={styles.blockSub}>
                      Accuracy: ~{selectedDuty.location.accuracy} meters
                    </Text>
                  )}
                </View>
              )}

              {/* Work Description */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>Work Description</Text>
                <Text style={styles.descriptionBox}>{selectedDuty?.workDescription}</Text>
              </View>

              {/* Customer Signature */}
              {selectedDuty?.customerSignature?.url ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Customer Signature Verification</Text>
                  <Image
                    source={{ uri: selectedDuty.customerSignature.url }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              {/* Proof Photos */}
              {selectedDuty?.customerProofPhotos?.length > 0 && (
                <View style={[styles.detailBlock, { marginBottom: SPACING.xxl }]}>
                  <Text style={styles.blockLabel}>
                    Service Proof Photos ({selectedDuty.customerProofPhotos.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedDuty.customerProofPhotos.map((photo, i) => (
                      <Image
                        key={i}
                        source={{ uri: photo.url }}
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
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
    padding: SPACING.md,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
  },
  filterToggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filterToggleTextActive: {
    color: COLORS.textLight,
  },
  searchBar: {
    marginBottom: SPACING.xs,
  },
  exportToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  countWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  countText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  countHighlight: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  clearFilterLink: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: RADIUS.xs,
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  pdfBtn: {
    backgroundColor: '#DC2626',
  },
  excelBtn: {
    backgroundColor: '#059669',
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  dutyCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  companyName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  machineRow: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 6,
    fontWeight: '500',
  },
  workTypeLabel: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  descriptionSnippet: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
  timeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  detailSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  sheetSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sheetBody: {
    marginTop: SPACING.sm,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipScroll: {
    marginBottom: SPACING.sm,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: 2,
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pickerChipTextSelected: {
    color: COLORS.textLight,
  },
  filterActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  resetFilterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  applyFilterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  applyFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  detailBlock: {
    marginBottom: SPACING.md,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  blockValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  blockSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  descriptionBox: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 19,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  signatureImage: {
    width: '100%',
    height: 70,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  proofImage: {
    width: 90,
    height: 90,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 4,
  },
});

export default AllDutiesScreen;
