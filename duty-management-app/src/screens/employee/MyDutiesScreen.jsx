import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dutyApi from '../../api/dutyApi';
import companyApi from '../../api/companyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import { formatDate, formatTime, getTodayDateString, getYesterdayDateString } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const MyDutiesScreen = ({ navigation }) => {
  const [duties, setDuties] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Active filter criteria
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Filter popup modal & draft filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [draftCompanyId, setDraftCompanyId] = useState('');

  // Pickers visibility
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [singleDatePickerVisible, setSingleDatePickerVisible] = useState(false);
  const [companyDropdownVisible, setCompanyDropdownVisible] = useState(false);

  const today = useMemo(() => getTodayDateString(), []);
  const yesterday = useMemo(() => getYesterdayDateString(), []);

  // Whether any filter criteria are active
  const hasActiveFilters = Boolean(
    startDate || endDate || selectedCompanyId
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (startDate || endDate) count += 1;
    if (selectedCompanyId) count += 1;
    return count;
  }, [startDate, endDate, selectedCompanyId]);

  // Load companies for the filter picker
  const loadCompanies = useCallback(async () => {
    try {
      const compRes = await companyApi.getCompanies({ status: 'active', limit: 200 }).catch(() => ({ data: { companies: [] } }));
      if (compRes.data?.companies) {
        setCompanies(compRes.data.companies);
      }
    } catch (err) {
      console.warn('Failed to load companies for filter:', err);
    }
  }, []);

  const fetchDuties = useCallback(async () => {
    try {
      setError('');
      const params = { limit: 500 };
      if (search.trim()) params.search = search.trim();
      if (selectedCompanyId) params.companyId = selectedCompanyId;
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await dutyApi.getMyDuties(params);
      if (res.data?.duties) {
        setDuties(res.data.duties);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your duty history'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCompanyId, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      fetchDuties();
      loadCompanies();
    }, [fetchDuties, loadCompanies])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDuties();
  };

  // Filter modal controls
  const openFilterModal = () => {
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setDraftCompanyId(selectedCompanyId);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSelectedCompanyId(draftCompanyId);
    setFilterModalVisible(false);
  };

  const resetDraftFilters = () => {
    setDraftStartDate('');
    setDraftEndDate('');
    setDraftCompanyId('');
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCompanyId('');
    setDraftStartDate('');
    setDraftEndDate('');
    setDraftCompanyId('');
  };

  // Real-time client-side filter for instant responsiveness
  const filteredDuties = useMemo(() => {
    return duties.filter((d) => {
      // Company match
      if (selectedCompanyId) {
        const cId = d.company?._id || d.company;
        if (cId !== selectedCompanyId) return false;
      }
      // Date bounds match
      if (startDate) {
        const dDate = d.dutyDate ? d.dutyDate.split('T')[0] : '';
        if (dDate < startDate) return false;
      }
      if (endDate) {
        const dDate = d.dutyDate ? d.dutyDate.split('T')[0] : '';
        if (dDate > endDate) return false;
      }

      // Universal search query match
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const dutyId = (d.dutyId || ('DUTY-' + (d._id || '').slice(-6))).toLowerCase();
      const rawId = (d._id || '').toLowerCase();
      const compName = (d.company?.companyName || '').toLowerCase();
      const custName = (d.customerName || '').toLowerCase();
      const phone = (d.customerPhoneNumber || '').toLowerCase();
      const machine = (d.machineName || '').toLowerCase();
      const workType = (d.workType || '').toLowerCase();
      const desc = (d.workDescription || '').toLowerCase();

      return (
        dutyId.includes(q) ||
        rawId.includes(q) ||
        compName.includes(q) ||
        custName.includes(q) ||
        phone.includes(q) ||
        machine.includes(q) ||
        workType.includes(q) ||
        desc.includes(q)
      );
    });
  }, [duties, selectedCompanyId, startDate, endDate, search]);

  const renderDutyItem = ({ item }) => {
    const dutyId = item.dutyId || ('WORK-' + (item._id || '').slice(-4).toUpperCase());
    const companyLocation = item.company?.location || item.location?.address;

    return (
      <Card
        style={styles.dutyCard}
        onPress={() => navigation.navigate('DutyDetails', { dutyId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <View style={styles.idRow}>
              <Text style={styles.dutyIdBadge}>{dutyId}</Text>
            </View>
            {(() => {
              const isItemOffice =
                item.company?.companyType === 'office' ||
                (typeof item.company?.companyName === 'string' &&
                  item.company.companyName.toLowerCase().includes('office'));
              return (
                <>
                  <Text style={styles.customerName}>
                    {isItemOffice ? (item.company?.companyName || 'Office') : item.customerName}
                  </Text>
                  {!isItemOffice ? (
                    <Text style={styles.companyName}>
                      <Ionicons
                        name="storefront-outline"
                        size={13}
                        color={COLORS.textSecondary}
                      />{' '}
                      {item.company?.companyName || 'Company'}
                      {companyLocation ? ` • ${companyLocation}` : ''}
                    </Text>
                  ) : companyLocation ? (
                    <Text style={styles.companyName}>
                      <Ionicons
                        name="business"
                        size={13}
                        color={COLORS.textSecondary}
                      />{' '}
                      {companyLocation}
                    </Text>
                  ) : null}
                </>
              );
            })()}
          </View>
        </View>

        <Text style={styles.machineText}>
          <Ionicons name="hardware-chip-outline" size={13} color={COLORS.textSecondary} />{' '}
          {item.machineName} ({formatWorkType(item)})
        </Text>

        {item.features && item.features.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 4 }}>
            {item.features.map((feat, fIdx) => (
              <View key={fIdx} style={{ backgroundColor: '#F0F9FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <Text style={{ fontSize: 11, color: '#0369A1', fontWeight: '700' }}>{feat}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.descriptionSnippet} numberOfLines={2}>
          {item.workDescription}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <Text style={styles.timeText}>
              <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />{' '}
              {formatTime(item.inTime)} - {formatTime(item.outTime)}
            </Text>
            <Text style={styles.dateText}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />{' '}
              {formatDate(item.dutyDate)}
            </Text>
          </View>

          {/* Card Actions */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.expenseQuickBtn}
              onPress={() => navigation.navigate('ExpenseForm', { duty: item })}
              activeOpacity={0.7}
            >
              <Ionicons name="receipt-outline" size={13} color="#0284C7" />
              <Text style={styles.expenseQuickBtnText}>+ Expense</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('DutyForm', { dutyToEdit: item })}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={14} color={COLORS.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="My Works"
        subtitle="Your field service visit logs"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.filterToggleBtn,
                hasActiveFilters && styles.filterToggleBtnActive,
              ]}
              onPress={openFilterModal}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasActiveFilters ? 'funnel' : 'funnel-outline'}
                size={16}
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
              {hasActiveFilters && (
                <View style={styles.filterBadgeCount}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('DutyForm')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={COLORS.textLight} />
              <Text style={styles.addButtonText}>New</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.container}>
        {/* Universal Search Bar */}
        <TextInputField
          placeholder="Search by ID, company, phone, name, machine..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        {/* Active Filters Summary Pill Bar */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltersScroll}
            >
              {startDate || endDate ? (
                <View style={styles.activeFilterPill}>
                  <Ionicons name="calendar" size={12} color={COLORS.primary} />
                  <Text style={styles.activeFilterPillText}>
                    {startDate && endDate && startDate === endDate
                      ? startDate === today
                        ? 'Today'
                        : startDate === yesterday
                        ? 'Yesterday'
                        : formatDate(startDate)
                      : `${startDate ? formatDate(startDate) : 'Start'} - ${endDate ? formatDate(endDate) : 'Present'}`}
                  </Text>
                </View>
              ) : null}

              {selectedCompanyId ? (
                <View style={styles.activeFilterPill}>
                  <Ionicons name="business" size={12} color={COLORS.primary} />
                  <Text style={styles.activeFilterPillText}>
                    {companies.find((c) => c._id === selectedCompanyId)?.companyName || 'Company'}
                  </Text>
                </View>
              ) : null}



              <TouchableOpacity onPress={clearFilters} style={styles.clearActiveFiltersBtn}>
                <Ionicons name="close-circle" size={14} color={COLORS.danger} />
                <Text style={styles.clearActiveFiltersText}>Clear</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Results summary count */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            Showing <Text style={styles.summaryHighlight}>{filteredDuties.length}</Text> duties
          </Text>
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearchText}>Clear Search</Text>
            </TouchableOpacity>
          ) : hasActiveFilters ? (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearSearchText}>Reset Filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ErrorMessage message={error} onRetry={fetchDuties} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading work records..." />
        ) : (
          <FlatList
            data={filteredDuties}
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
                icon="document-text-outline"
                title={
                  search
                    ? 'No Matching Works'
                    : hasActiveFilters
                    ? 'No Works Match Filters'
                    : 'No Work Reports Found'
                }
                description={
                  search
                    ? `No works match "${search}". Try searching another name, phone, or company.`
                    : hasActiveFilters
                    ? 'Try adjusting your date range or company filter.'
                    : 'Log your service visits by tapping "New" above.'
                }
                actionTitle={
                  search
                    ? 'Clear Search'
                    : hasActiveFilters
                    ? 'Clear Filters'
                    : 'Submit Work Report'
                }
                onAction={
                  search
                    ? () => setSearch('')
                    : hasActiveFilters
                    ? clearFilters
                    : () => navigation.navigate('DutyForm')
                }
              />
            }
          />
        )}
      </View>

      {/* Centered Filter Popup Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={styles.filterPopupCard}>
            {/* Header */}
            <View style={styles.filterPopupHeader}>
              <View style={styles.filterTitleRow}>
                <Ionicons name="funnel" size={18} color={COLORS.primary} />
                <Text style={styles.filterPopupTitle}>Filter Duty Records</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.filterPopupScroll}>
              {/* Date Presets */}
              <Text style={styles.filterSectionTitle}>Date Presets</Text>
              <View style={styles.presetChipsWrap}>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    !draftStartDate && !draftEndDate && styles.presetChipActive,
                  ]}
                  onPress={() => {
                    setDraftStartDate('');
                    setDraftEndDate('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      !draftStartDate && !draftEndDate && styles.presetChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    draftStartDate === today && draftEndDate === today && styles.presetChipActive,
                  ]}
                  onPress={() => {
                    setDraftStartDate(today);
                    setDraftEndDate(today);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      draftStartDate === today && draftEndDate === today && styles.presetChipTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    draftStartDate === yesterday && draftEndDate === yesterday && styles.presetChipActive,
                  ]}
                  onPress={() => {
                    setDraftStartDate(yesterday);
                    setDraftEndDate(yesterday);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      draftStartDate === yesterday && draftEndDate === yesterday && styles.presetChipTextActive,
                    ]}
                  >
                    Yesterday
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    draftStartDate &&
                      draftStartDate === draftEndDate &&
                      draftStartDate !== today &&
                      draftStartDate !== yesterday &&
                      styles.presetChipActive,
                  ]}
                  onPress={() => setSingleDatePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="calendar"
                    size={13}
                    color={
                      draftStartDate &&
                      draftStartDate === draftEndDate &&
                      draftStartDate !== today &&
                      draftStartDate !== yesterday
                        ? '#FFFFFF'
                        : COLORS.primary
                    }
                  />
                  <Text
                    style={[
                      styles.presetChipText,
                      draftStartDate &&
                        draftStartDate === draftEndDate &&
                        draftStartDate !== today &&
                        draftStartDate !== yesterday &&
                        styles.presetChipTextActive,
                    ]}
                  >
                    {draftStartDate &&
                    draftStartDate === draftEndDate &&
                    draftStartDate !== today &&
                    draftStartDate !== yesterday
                      ? formatDate(draftStartDate)
                      : 'Single Date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom Date Range */}
              <Text style={[styles.filterSectionTitle, { marginTop: SPACING.md }]}>
                Custom Date Range
              </Text>
              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1, marginRight: SPACING.xs }}>
                  <Text style={styles.fieldLabelSmall}>From Date</Text>
                  <TouchableOpacity
                    style={styles.pickerTriggerBtn}
                    onPress={() => setStartDatePickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.pickerTriggerText}>
                      {draftStartDate ? formatDate(draftStartDate) : 'Start (All)'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.xs }}>
                  <Text style={styles.fieldLabelSmall}>To Date</Text>
                  <TouchableOpacity
                    style={styles.pickerTriggerBtn}
                    onPress={() => setEndDatePickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.pickerTriggerText}>
                      {draftEndDate ? formatDate(draftEndDate) : 'To (All)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Company / Office Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: SPACING.md }]}>
                Company / Office
              </Text>
              <TouchableOpacity
                style={styles.dropdownTriggerBtn}
                onPress={() => setCompanyDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                  {draftCompanyId
                    ? companies.find((c) => c._id === draftCompanyId)?.companyName || 'Company Selected'
                    : 'All Companies & Offices (Default)'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={COLORS.textSecondary}
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>


            </ScrollView>

            {/* Modal Actions Footer */}
            <View style={styles.filterPopupFooter}>
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={resetDraftFilters}
                activeOpacity={0.8}
              >
                <Text style={styles.resetFilterBtnText}>Reset All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyFilterBtn}
                onPress={applyFilters}
                activeOpacity={0.8}
              >
                <Text style={styles.applyFilterBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePickerModal
        visible={startDatePickerVisible}
        onClose={() => setStartDatePickerVisible(false)}
        selectedDate={draftStartDate}
        onSelectDate={(date) => setDraftStartDate(date)}
        title="Select From Date"
      />

      <DatePickerModal
        visible={endDatePickerVisible}
        onClose={() => setEndDatePickerVisible(false)}
        selectedDate={draftEndDate}
        onSelectDate={(date) => setDraftEndDate(date)}
        title="Select To Date"
      />

      <DatePickerModal
        visible={singleDatePickerVisible}
        onClose={() => setSingleDatePickerVisible(false)}
        selectedDate={draftStartDate}
        onSelectDate={(date) => {
          setDraftStartDate(date);
          setDraftEndDate(date);
        }}
        title="Select Duty Date"
      />

      {/* Company Dropdown Modal */}
      <DropdownPickerModal
        visible={companyDropdownVisible}
        onClose={() => setCompanyDropdownVisible(false)}
        title="Filter by Company / Office"
        searchPlaceholder="Search company or office..."
        selectedValue={draftCompanyId}
        onSelect={(val) => setDraftCompanyId(val)}
        allOptionLabel="All Companies & Offices"
        items={companies.map((c) => ({
          label: c.companyName,
          value: c._id,
          id: c._id,
          subtitle: `${c.companyType === 'office' ? 'Office' : 'Client Site'}: ${c.location || ''}${c.companyPhoneNumber ? ' • ' + c.companyPhoneNumber : ''}`,
        }))}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  filterToggleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filterToggleTextActive: {
    color: COLORS.textLight,
  },
  filterBadgeCount: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
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
  activeFiltersBar: {
    marginBottom: SPACING.xs,
  },
  activeFiltersScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primarySubtle,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  activeFilterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  clearActiveFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  clearActiveFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  summaryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  summaryHighlight: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  clearSearchText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
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
  headerInfo: {
    flex: 1,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dutyIdBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
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
  machineText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: SPACING.sm,
  },
  descriptionSnippet: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
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
  footerInfo: {
    flexDirection: 'column',
    gap: 3,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  expenseQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Centered Filter Popup Modal Styles
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  filterPopupCard: {
    width: '94%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  filterPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPopupTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterPopupScroll: {
    marginVertical: SPACING.xs,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.xs,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  fieldLabelSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  pickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
  },
  pickerTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  dropdownTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPopupFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
});

export default MyDutiesScreen;
