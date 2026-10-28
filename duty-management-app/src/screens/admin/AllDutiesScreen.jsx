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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dutyApi from '../../api/dutyApi';
import employeeApi from '../../api/employeeApi';
import companyApi from '../../api/companyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import SignatureImage from '../../components/SignatureImage';
import ImageViewerModal from '../../components/ImageViewerModal';
import ExportLoadingModal from '../../components/ExportLoadingModal';
import ExpenseClaimDetailModal, { parseExpenseItem } from '../../components/ExpenseClaimDetailModal';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { formatDate, formatTime, formatISODateOnly, getYesterdayDateString } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportDutiesToPDF, exportDutiesToExcel } from '../../utils/exportUtils';
import { reverseGeocodeCoords, openMapLocation } from '../../utils/locationUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { isDeveloperAdmin } from '../../utils/validators';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const AllDutiesScreen = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();
  const today = formatISODateOnly();
  const yesterday = getYesterdayDateString();
  const initialFilterToday = Boolean(route?.params?.filterToday);
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [exportingType, setExportingType] = useState(null); // 'PDF' | 'Excel' | null

  // Active filter state
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [startDate, setStartDate] = useState(initialFilterToday ? today : '');
  const [endDate, setEndDate] = useState(initialFilterToday ? today : '');

  // Whether filter modal criteria are active
  const hasActiveFilters = Boolean(
    startDate || endDate || selectedEmployeeId || selectedCompanyId
  );

  // Filter popup modal & draft filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(initialFilterToday ? today : '');
  const [draftEndDate, setDraftEndDate] = useState(initialFilterToday ? today : '');
  const [draftEmployeeId, setDraftEmployeeId] = useState('');
  const [draftCompanyId, setDraftCompanyId] = useState('');

  // Pickers visibility
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [singleDatePickerVisible, setSingleDatePickerVisible] = useState(false);
  const [employeeDropdownVisible, setEmployeeDropdownVisible] = useState(false);
  const [companyDropdownVisible, setCompanyDropdownVisible] = useState(false);

  // Read-only Duty Detail Modal (No approval workflow)
  const [selectedDuty, setSelectedDuty] = useState(null);
  const [selectedDutyCheckInAddress, setSelectedDutyCheckInAddress] = useState('');
  const [selectedDutyCheckOutAddress, setSelectedDutyCheckOutAddress] = useState('');
  const [selectedExpenseForModal, setSelectedExpenseForModal] = useState(null);

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewSubtitle, setPreviewSubtitle] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState('');
  const [previewIsSignature, setPreviewIsSignature] = useState(false);

  // Automatically resolve reverse-geocoded location for selected duty
  useEffect(() => {
    if (!selectedDuty) {
      setSelectedDutyCheckInAddress('');
      setSelectedDutyCheckOutAddress('');
      return;
    }

    const checkInLoc = selectedDuty.checkInLocation?.latitude
      ? selectedDuty.checkInLocation
      : selectedDuty.location;
    if (checkInLoc?.address) {
      setSelectedDutyCheckInAddress(checkInLoc.address);
    } else if (checkInLoc?.latitude && checkInLoc?.longitude) {
      setSelectedDutyCheckInAddress('');
      reverseGeocodeCoords(checkInLoc.latitude, checkInLoc.longitude)
        .then((addr) => {
          if (addr) setSelectedDutyCheckInAddress(addr);
        })
        .catch(() => {});
    } else {
      setSelectedDutyCheckInAddress('');
    }

    const checkOutLoc = selectedDuty.checkOutLocation;
    if (checkOutLoc?.address) {
      setSelectedDutyCheckOutAddress(checkOutLoc.address);
    } else if (checkOutLoc?.latitude && checkOutLoc?.longitude) {
      setSelectedDutyCheckOutAddress('');
      reverseGeocodeCoords(checkOutLoc.latitude, checkOutLoc.longitude)
        .then((addr) => {
          if (addr) setSelectedDutyCheckOutAddress(addr);
        })
        .catch(() => {});
    } else {
      setSelectedDutyCheckOutAddress('');
    }
  }, [selectedDuty]);

  // Lightbox openers
  const isSelectedDutyOffice =
    selectedDuty?.company?.companyType === 'office' ||
    (typeof selectedDuty?.company?.companyName === 'string' &&
      selectedDuty.company.companyName.toLowerCase().includes('office'));

  const handleOpenPhotoPreview = (url, index) => {
    setPreviewImageUri(url);
    setPreviewTitle(`Proof Photo #${index + 1}`);
    setPreviewSubtitle(
      isSelectedDutyOffice
        ? (selectedDuty?.company?.companyName || 'Office Duty')
        : (selectedDuty?.customerName ? `Client: ${selectedDuty.customerName}` : 'Service Verification')
    );
    setPreviewTimestamp(selectedDuty?.dutyDate ? formatDate(selectedDuty.dutyDate) : '');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  const handleOpenSignaturePreview = (url, title = isSelectedDutyOffice ? 'Office Sign-Off' : 'Customer Signature') => {
    const sigTime = selectedDuty?.customerSignature?.signedAt
      ? new Date(selectedDuty.customerSignature.signedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ', ' +
        new Date(selectedDuty.customerSignature.signedAt).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : selectedDuty?.dutyDate && selectedDuty?.outTime
      ? `${formatDate(selectedDuty.dutyDate)}, ${formatTime(selectedDuty.outTime)}`
      : '';

    setPreviewImageUri(url);
    setPreviewTitle(title);
    setPreviewSubtitle(
      isSelectedDutyOffice
        ? (selectedDuty?.company?.companyName || 'Office Duty')
        : (selectedDuty?.customerName ? `Client: ${selectedDuty.customerName}` : 'Service Verification')
    );
    setPreviewTimestamp(sigTime);
    setPreviewIsSignature(true);
    setPreviewModalVisible(true);
  };

  const handleOpenExpensePhotoPreview = (url, itemName) => {
    setPreviewImageUri(url);
    setPreviewTitle(itemName ? `Expense Proof: ${itemName}` : 'Expense Bill / Proof');
    setPreviewSubtitle(selectedDuty?.dutyId ? `Duty #${selectedDuty.dutyId}` : '');
    setPreviewTimestamp('');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  // Load filter lists (employees and companies)
  const loadFilterData = useCallback(async () => {
    try {
      const [empRes, compRes] = await Promise.all([
        employeeApi.getEmployees({ limit: 200 }).catch(() => ({ data: { employees: [] } })),
        companyApi.getCompanies({ limit: 200 }).catch(() => ({ data: { companies: [] } })),
      ]);
      if (empRes.data?.employees) {
        const isCurrentDev = isDeveloperAdmin(currentUser);
        setEmployees(
          empRes.data.employees.filter((e) => e.role !== 'admin' && (isCurrentDev || !isDeveloperAdmin(e)))
        );
      }
      if (compRes.data?.companies) setCompanies(compRes.data.companies);
    } catch (err) {
      console.warn('Failed to load filter options:', err);
    }
  }, [currentUser]);

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

  useFocusEffect(
    useCallback(() => {
      fetchDuties();
      loadFilterData();
    }, [fetchDuties, loadFilterData])
  );

  useEffect(() => {
    if (route?.params?.filterToday) {
      setStartDate(today);
      setEndDate(today);
      setDraftStartDate(today);
      setDraftEndDate(today);
    }
  }, [route?.params?.filterToday, today]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDuties();
  };

  // Delete duty handler (Admin only)
  const handleDeleteDuty = (dutyId) => {
    Alert.alert(
      'Delete Duty Report',
      'Are you sure you want to permanently delete this duty record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dutyApi.deleteDuty(dutyId);
              setDuties((prev) => prev.filter((d) => d._id !== dutyId));
              if (selectedDuty?._id === dutyId) {
                setSelectedDuty(null);
              }
              Alert.alert('Deleted', 'Duty report has been permanently deleted.');
            } catch (err) {
              Alert.alert('Delete Failed', extractErrorMessage(err, 'Failed to delete duty report'));
            }
          },
        },
      ]
    );
  };

  // Edit duty handler
  const handleEditDuty = (duty) => {
    setSelectedDuty(null);
    navigation.navigate('DutyForm', { dutyToEdit: duty });
  };

  // Client-side real-time multi-field search filter
  const filteredDuties = duties.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const dutyId = (d.dutyId || ('DUTY-' + (d._id || '').slice(-6))).toLowerCase();
    const rawId = (d._id || '').toLowerCase();
    const compName = (d.company?.companyName || '').toLowerCase();
    const custName = (d.customerName || '').toLowerCase();
    const phone = (d.customerPhoneNumber || '').toLowerCase();
    const empName = (d.employee?.employeeName || '').toLowerCase();
    const empId = (d.employee?.employeeId || '').toLowerCase();
    const machine = (d.machineName || '').toLowerCase();
    const workType = (d.workType || '').toLowerCase();
    const desc = (d.workDescription || '').toLowerCase();

    return (
      dutyId.includes(q) ||
      rawId.includes(q) ||
      compName.includes(q) ||
      custName.includes(q) ||
      phone.includes(q) ||
      empName.includes(q) ||
      empId.includes(q) ||
      machine.includes(q) ||
      workType.includes(q) ||
      desc.includes(q)
    );
  });

  // Filter Modal Controls
  const openFilterModal = () => {
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setDraftEmployeeId(selectedEmployeeId);
    setDraftCompanyId(selectedCompanyId);
    setFilterModalVisible(true);
  };

  const applyFilterModal = () => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSelectedEmployeeId(draftEmployeeId);
    setSelectedCompanyId(draftCompanyId);
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    setSelectedEmployeeId('');
    setSelectedCompanyId('');
    setStartDate('');
    setEndDate('');
    setDraftEmployeeId('');
    setDraftCompanyId('');
    setDraftStartDate('');
    setDraftEndDate('');
    setSearch('');
    setFilterModalVisible(false);
  };

  // Export actions
  const handleExportPDF = async () => {
    const selectedEmpObj = employees.find((e) => e._id === selectedEmployeeId);
    const selectedCompObj = companies.find((c) => c._id === selectedCompanyId);

    const filterDetails = [];
    if (selectedEmpObj) filterDetails.push(`Employee: ${selectedEmpObj.employeeName}`);
    if (selectedCompObj) filterDetails.push(`Company: ${selectedCompObj.companyName}`);
    if (startDate || endDate) {
      filterDetails.push(`Date: ${startDate || 'Start'} to ${endDate || 'Present'}`);
    }

    const filterInfo = filterDetails.length > 0 ? filterDetails.join(' • ') : 'All Submissions';

    try {
      setExportingType('PDF');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportDutiesToPDF({
        title: 'Work Field Records',
        subtitle: 'Complete Field Visit & Operational Work Reports',
        duties,
        filterInfo,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingType('Excel');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportDutiesToExcel({
        filename: 'Field_Work_Records',
        duties,
      });
    } finally {
      setExportingType(null);
    }
  };

  const renderDutyItem = ({ item }) => {
    const dutyId = item.dutyId || ('WORK-' + (item._id || '').slice(-4).toUpperCase());
    const isItemOffice =
      item.company?.companyType === 'office' ||
      (typeof item.company?.companyName === 'string' &&
        item.company.companyName.toLowerCase().includes('office'));
    const companyLocation = item.company?.location || item.location?.address;

    return (
      <Card style={styles.dutyCard} onPress={() => setSelectedDuty(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.idRow}>
              <Text style={styles.dutyIdBadge}>{dutyId}</Text>
            </View>
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
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
            <Text style={styles.dateBadgeText}>{formatDate(item.dutyDate)}</Text>
          </View>
        </View>

        <Text style={styles.machineRow}>
          <Ionicons name="hardware-chip-outline" size={13} color={COLORS.textSecondary} />{' '}
          {item.machineName} • <Text style={styles.workTypeLabel}>{formatWorkType(item)}</Text>
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
          <View style={styles.employeeInfo}>
            <Ionicons name="person-outline" size={13} color={COLORS.primary} />
            <Text style={styles.employeeText}>
              {item.employee?.employeeName || 'Employee'} ({item.employee?.employeeId})
            </Text>
          </View>

          <Text style={styles.timeText}>
            <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />{' '}
            {formatTime(item.inTime)} - {formatTime(item.outTime)}
          </Text>

          {item.totalExpenseAmount > 0 ? (
            <View style={styles.cardExpenseBadge}>
              <Ionicons name="receipt" size={11} color="#047857" />
              <Text style={styles.cardExpenseBadgeText}>
                ₹{Number(item.totalExpenseAmount).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Admin Quick Action Buttons: Only Editable & Expense functions */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.cardActionEditBtn}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleEditDuty(item);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={14} color={COLORS.primary} />
            <Text style={styles.cardActionEditText}>Edit Work Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionExpenseBtn}
            onPress={(e) => {
              e?.stopPropagation?.();
              if (item.expenses && item.expenses.length > 0) {
                setSelectedDuty(item);
                setSelectedExpenseForModal(item.expenses[0]);
              } else {
                navigation.navigate('ExpenseForm', { duty: item });
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={14} color="#047857" />
            <Text style={styles.cardActionExpenseText}>
              {Number(item.totalExpenseAmount) > 0
                ? `₹${Number(item.totalExpenseAmount).toLocaleString('en-IN')} Expense`
                : '+ Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="All Works"
        subtitle="View field visit logs & service records"
        rightAction={
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
              size={18}
              color={hasActiveFilters ? COLORS.textLight : COLORS.primary}
            />
            <Text
              style={[
                styles.filterToggleText,
                hasActiveFilters && styles.filterToggleTextActive,
              ]}
            >
              {hasActiveFilters ? 'Filter (Active)' : 'Filter'}
            </Text>
          </TouchableOpacity>
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

        {/* Export Toolbar Card */}
        <View style={styles.exportToolbar}>
          <View style={styles.countWrap}>
            <Text style={styles.countText}>
              <Text style={styles.countHighlight}>{filteredDuties.length}</Text> reports
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

        {/* Active Filters Pill Summary Bar */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
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

              {selectedEmployeeId ? (
                <View style={styles.activeFilterPill}>
                  <Ionicons name="person" size={12} color={COLORS.primary} />
                  <Text style={styles.activeFilterPillText}>
                    {employees.find((e) => e._id === selectedEmployeeId)?.employeeName || 'Employee'}
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
                <Text style={styles.sheetTitle}>
                  {isSelectedDutyOffice ? 'Office Work Report' : 'Service Work Report'} #{selectedDuty?.dutyId || ('WORK-' + (selectedDuty?._id || '').slice(-6).toUpperCase())}
                </Text>
                <Text style={styles.sheetSub}>
                  {isSelectedDutyOffice ? (selectedDuty?.company?.companyName || 'Office') : selectedDuty?.customerName} • {formatDate(selectedDuty?.dutyDate)}
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

              {/* Company & Customer / Client */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>
                  {isSelectedDutyOffice ? 'Office Location' : 'Client Company & Contact'}
                </Text>
                <Text style={styles.blockValue}>
                  {selectedDuty?.company?.companyName || (isSelectedDutyOffice ? 'Office' : 'Client Company')}
                  {selectedDuty?.company?.location ? ` (${selectedDuty?.company?.location})` : ''}
                </Text>
                {!isSelectedDutyOffice ? (
                  <Text style={styles.blockSub}>
                    Contact: {selectedDuty?.client?.name || selectedDuty?.customerName || 'N/A'}{' '}
                    ({selectedDuty?.client?.phoneNumber || selectedDuty?.customerPhoneNumber || 'N/A'})
                  </Text>
                ) : null}
              </View>

              {/* Machine & Working Hours */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>Equipment & Hours</Text>
                <Text style={styles.blockValue}>
                  {selectedDuty?.machineName} ({formatWorkType(selectedDuty)})
                </Text>
                <Text style={styles.blockSub}>
                  Hours: {formatTime(selectedDuty?.inTime)} to {formatTime(selectedDuty?.outTime)}
                </Text>
              </View>

              {/* Check-In / Check-Out & Working Duration */}
              {selectedDuty?.checkInTime ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Check-In & Check-Out Times</Text>
                  <Text style={styles.blockValue}>
                    In: {new Date(selectedDuty.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    {selectedDuty.checkOutTime ? `  •  Out: ${new Date(selectedDuty.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ' (In Progress)'}
                  </Text>
                  {selectedDuty.totalDurationMinutes ? (
                    <Text style={[styles.blockSub, { color: COLORS.primary, fontWeight: '700' }]}>
                      Total Duration: {Math.floor(selectedDuty.totalDurationMinutes / 60)}h {selectedDuty.totalDurationMinutes % 60}m ({selectedDuty.totalDurationMinutes} mins)
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Features */}
              {selectedDuty?.features && selectedDuty.features.length > 0 ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Features</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {selectedDuty.features.map((feat, idx) => (
                      <View key={idx} style={{ backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="sparkles" size={11} color="#0369A1" />
                        <Text style={{ fontSize: 13, color: '#0369A1', fontWeight: '700' }}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Manpower Members */}
              {selectedDuty?.manpowerMembers && selectedDuty.manpowerMembers.length > 0 ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Manpower Team ({selectedDuty.manpowerMembers.length})</Text>
                  {selectedDuty.manpowerMembers.map((m, idx) => (
                    <View key={idx} style={{ marginTop: 6, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>{m.name} {m.phone ? `(${m.phone})` : ''}</Text>
                      {m.description ? <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{m.description}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Check-In GPS Location */}
              {(selectedDuty?.checkInLocation?.latitude || selectedDuty?.location?.latitude) ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Check-In Location (GPS)</Text>

                  {(selectedDutyCheckInAddress || selectedDuty.checkInLocation?.address || selectedDuty.location?.address) ? (
                    <View style={styles.exactAddressCard}>
                      <Ionicons name="location" size={20} color="#059669" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.exactAddressTitle, { color: '#059669' }]}>Check-In Address</Text>
                        <Text style={styles.exactAddressText}>
                          {selectedDutyCheckInAddress || selectedDuty.checkInLocation?.address || selectedDuty.location?.address}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={[styles.mapCard, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
                    <View style={styles.mapInfo}>
                      <Ionicons name="log-in" size={24} color="#059669" />
                      <View>
                        <Text style={styles.blockValue}>
                          {(selectedDuty.checkInLocation?.latitude || selectedDuty.location?.latitude).toFixed(5)},{' '}
                          {(selectedDuty.checkInLocation?.longitude || selectedDuty.location?.longitude).toFixed(5)}
                        </Text>
                        {(selectedDuty.checkInLocation?.accuracy || selectedDuty.location?.accuracy) ? (
                          <Text style={styles.blockSub}>
                            Accuracy: ~{selectedDuty.checkInLocation?.accuracy || selectedDuty.location?.accuracy} meters
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.openMapBtn, { backgroundColor: '#059669' }]}
                      onPress={() => {
                        const lat = selectedDuty.checkInLocation?.latitude || selectedDuty.location?.latitude;
                        const lng = selectedDuty.checkInLocation?.longitude || selectedDuty.location?.longitude;
                        openMapLocation(lat, lng, `${selectedDuty.customerName || 'Service'} Check-In`);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.openMapBtnText}>Open Check-In on Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Check-Out GPS Location */}
              {selectedDuty?.checkOutLocation?.latitude ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Check-Out Location (GPS)</Text>

                  {(selectedDutyCheckOutAddress || selectedDuty.checkOutLocation?.address) ? (
                    <View style={styles.exactAddressCard}>
                      <Ionicons name="location" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exactAddressTitle}>Check-Out Address</Text>
                        <Text style={styles.exactAddressText}>
                          {selectedDutyCheckOutAddress || selectedDuty.checkOutLocation?.address}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={[styles.mapCard, { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' }]}>
                    <View style={styles.mapInfo}>
                      <Ionicons name="log-out" size={24} color={COLORS.primary} />
                      <View>
                        <Text style={styles.blockValue}>
                          {selectedDuty.checkOutLocation.latitude.toFixed(5)},{' '}
                          {selectedDuty.checkOutLocation.longitude.toFixed(5)}
                        </Text>
                        {selectedDuty.checkOutLocation.accuracy ? (
                          <Text style={styles.blockSub}>
                            Accuracy: ~{selectedDuty.checkOutLocation.accuracy} meters
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.openMapBtn}
                      onPress={() => {
                        openMapLocation(
                          selectedDuty.checkOutLocation.latitude,
                          selectedDuty.checkOutLocation.longitude,
                          `${selectedDuty.customerName || 'Service'} Check-Out`
                        );
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.openMapBtnText}>Open Check-Out on Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Work Description */}
              <View style={styles.detailBlock}>
                <Text style={styles.blockLabel}>Work Description</Text>
                <Text style={styles.descriptionBox}>{selectedDuty?.workDescription}</Text>
              </View>

              {/* Signature Verification */}
              {(selectedDuty?.customerSignature?.url || (typeof selectedDuty?.customerSignature === 'string' && selectedDuty?.customerSignature)) ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>
                    {isSelectedDutyOffice ? 'Office Sign-Off Verification' : 'Customer Signature Verification'}
                  </Text>
                  <SignatureImage
                    uri={selectedDuty.customerSignature?.url || selectedDuty.customerSignature}
                    height={130}
                    timestamp={
                      selectedDuty.customerSignature?.signedAt
                        ? new Date(selectedDuty.customerSignature.signedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          }) +
                          ', ' +
                          new Date(selectedDuty.customerSignature.signedAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : selectedDuty.dutyDate && selectedDuty.outTime
                        ? `${formatDate(selectedDuty.dutyDate)}, ${formatTime(selectedDuty.outTime)}`
                        : ''
                    }
                    onPress={() => {
                      const sigUrl = selectedDuty.customerSignature?.url || selectedDuty.customerSignature;
                      handleOpenSignaturePreview(sigUrl, isSelectedDutyOffice ? 'Office Sign-Off' : 'Customer Signature');
                    }}
                  />
                </View>
              ) : null}

              {/* Employee/Technician Signature (if uploaded) */}
              {selectedDuty?.signature?.url && selectedDuty?.signature?.url !== selectedDuty?.customerSignature?.url ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>Employee Signature Verification</Text>
                  <SignatureImage
                    uri={selectedDuty.signature.url}
                    height={130}
                    timestamp={
                      selectedDuty.dutyDate && selectedDuty.outTime
                        ? `${formatDate(selectedDuty.dutyDate)}, ${formatTime(selectedDuty.outTime)}`
                        : ''
                    }
                    onPress={() => handleOpenSignaturePreview(selectedDuty.signature.url, 'Employee Signature')}
                  />
                </View>
              ) : null}

              {/* Proof Photos */}
              {selectedDuty?.customerProofPhotos?.length > 0 && (
                <View style={styles.detailBlock}>
                  <Text style={styles.blockLabel}>
                    {isSelectedDutyOffice ? 'Office Proof Photos' : 'Service Proof Photos'} ({selectedDuty.customerProofPhotos.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedDuty.customerProofPhotos.map((photo, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handleOpenPhotoPreview(photo.url, i)}
                        activeOpacity={0.85}
                        style={styles.proofThumbWrap}
                      >
                        <Image
                          source={{ uri: photo.url }}
                          style={styles.proofImage}
                          resizeMode="cover"
                        />
                        <View style={styles.photoZoomHint}>
                          <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Linked Expenses & Claims */}
              {selectedDuty?.expenses && selectedDuty.expenses.length > 0 && (
                <View style={styles.detailBlock}>
                  <View style={styles.detailRowBetween}>
                    <Text style={styles.blockLabel}>
                      Expenses & Claims ({selectedDuty.expenses.length})
                    </Text>
                    <View style={styles.expenseTotalPill}>
                      <Text style={styles.expenseTotalPillText}>
                        Total: ₹{Number(selectedDuty.totalExpenseAmount || selectedDuty.expenses.reduce((s, e) => s + (Number(e.totalAmount) || Number(e.amount) || 0), 0)).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dutyExpenseClaimsList}>
                    {selectedDuty.expenses.map((exp, expIdx) => {
                      const claimCode = exp.expenseId || `EXP-${expIdx + 1}`;
                      const expDate = exp.expenseDate ? formatDate(exp.expenseDate) : '';
                      const items = exp.items && exp.items.length > 0 ? exp.items : [
                        {
                          category: exp.category || 'other',
                          customCategory: exp.customCategory || '',
                          amount: exp.amount || exp.totalAmount || 0,
                          description: exp.description || '',
                          billProof: exp.billProof || null,
                        }
                      ];
                      const totalClaimAmt = Number(exp.grandTotal ?? exp.totalAmount ?? exp.amount ?? 0);

                      return (
                        <TouchableOpacity
                          key={exp._id || `exp-${expIdx}`}
                          style={styles.dutyExpenseCard}
                          onPress={() => setSelectedExpenseForModal(exp)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.dutyExpenseCardHeader}>
                            <View>
                              <Text style={styles.dutyExpenseClaimId}>{claimCode}</Text>
                              {expDate ? <Text style={styles.dutyExpenseClaimDate}>{expDate}</Text> : null}
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={styles.dutyExpenseClaimAmt}>
                                ₹{totalClaimAmt.toLocaleString('en-IN')}
                              </Text>
                              {exp.status ? <StatusBadge status={exp.status} /> : null}
                            </View>
                          </View>

                          {/* Items breakdown - full text detail without cluttered img */}
                          <View style={{ gap: 6, marginTop: 4 }}>
                            {items.map((it, itIdx) => {
                              const item = parseExpenseItem(it, itIdx);

                              return (
                                <View key={`item-${itIdx}`} style={styles.dutyExpenseItemRow}>
                                  <View style={{ flex: 1, paddingRight: 6 }}>
                                    <Text style={styles.dutyExpenseItemTitle}>{item.displayTitle}</Text>
                                    {item.calcText ? <Text style={styles.dutyExpenseItemCalc}>{item.calcText}</Text> : null}
                                    {item.description ? <Text style={styles.dutyExpenseItemDesc}>{item.description}</Text> : null}
                                  </View>
                                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text style={styles.dutyExpenseItemAmt}>
                                      ₹{item.amount.toLocaleString('en-IN')}
                                    </Text>
                                    {item.proofUrls.length > 0 && (
                                      <View style={styles.proofCountPill}>
                                        <Ionicons name="document-attach" size={11} color="#0369A1" />
                                        <Text style={styles.proofCountPillText}>
                                          {item.proofUrls.length} {item.proofUrls.length === 1 ? 'Proof' : 'Proofs'}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>

                          {/* Action row with Admin Edit button & Tap hint */}
                          <View style={styles.claimTapHintRow}>
                            <TouchableOpacity
                              style={styles.claimInlineEditBtn}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                setInspectionModalVisible(false);
                                navigation.navigate('ExpenseForm', { expenseToEdit: exp, isAdmin: true });
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="create-outline" size={12} color="#1E40AF" />
                              <Text style={styles.claimInlineEditBtnText}>Edit Expense</Text>
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                              <Text style={styles.claimTapHintText}>Tap to view full detail</Text>
                              <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

            </ScrollView>

            {/* Admin Action Buttons: Work Details & Expense */}
            <View style={styles.modalActionFooter}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalEditBtn]}
                onPress={() => handleEditDuty(selectedDuty)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={styles.modalActionBtnText}>Edit Work Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalExpenseBtn]}
                onPress={() => {
                  const dutyRef = selectedDuty;
                  setSelectedDuty(null);
                  navigation.navigate('ExpenseForm', { duty: dutyRef });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={16} color="#FFFFFF" />
                <Text style={styles.modalActionBtnText}>
                  {selectedDuty?.expenses?.length > 0 ? 'Add / Manage Expense' : '+ Add Expense'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Popup Modal (Centered on Screen) */}
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
              {/* Date Filter Quick Presets */}
              <Text style={styles.filterSectionTitle}>Date Presets</Text>
              <View style={styles.presetChipsWrap}>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    (!draftStartDate && !draftEndDate) && styles.presetChipActive,
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
                      (!draftStartDate && !draftEndDate) && styles.presetChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    (draftStartDate === today && draftEndDate === today) && styles.presetChipActive,
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
                      (draftStartDate === today && draftEndDate === today) && styles.presetChipTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    (draftStartDate === yesterday && draftEndDate === yesterday) && styles.presetChipActive,
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
                      (draftStartDate === yesterday && draftEndDate === yesterday) && styles.presetChipTextActive,
                    ]}
                  >
                    Yesterday
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    (draftStartDate && draftStartDate === draftEndDate && draftStartDate !== today && draftStartDate !== yesterday) && styles.presetChipActive,
                  ]}
                  onPress={() => setSingleDatePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="calendar"
                    size={13}
                    color={(draftStartDate && draftStartDate === draftEndDate && draftStartDate !== today && draftStartDate !== yesterday) ? '#FFFFFF' : COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.presetChipText,
                      (draftStartDate && draftStartDate === draftEndDate && draftStartDate !== today && draftStartDate !== yesterday) && styles.presetChipTextActive,
                    ]}
                  >
                    {draftStartDate && draftStartDate === draftEndDate && draftStartDate !== today && draftStartDate !== yesterday
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
                    <Text style={styles.pickerTriggerText}>{draftStartDate || 'Start Date (All)'}</Text>
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
                    <Text style={styles.pickerTriggerText}>{draftEndDate || 'To Date (All)'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Employee Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: SPACING.md }]}>
                Employee
              </Text>
              <TouchableOpacity
                style={styles.dropdownTriggerBtn}
                onPress={() => setEmployeeDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                <Text style={styles.dropdownTriggerText}>
                  {draftEmployeeId
                    ? employees.find((e) => e._id === draftEmployeeId)?.employeeName || 'Employee Selected'
                    : 'All Employees (Default)'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              {/* Company Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: SPACING.md }]}>
                Company / Office
              </Text>
              <TouchableOpacity
                style={styles.dropdownTriggerBtn}
                onPress={() => setCompanyDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                <Text style={styles.dropdownTriggerText}>
                  {draftCompanyId
                    ? companies.find((c) => c._id === draftCompanyId)?.companyName || 'Company Selected'
                    : 'All Companies & Offices (Default)'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.filterPopupFooter}>
              <SecondaryButton
                title="Reset All"
                onPress={clearFilters}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Apply Filter"
                onPress={applyFilterModal}
                style={{ flex: 1.3 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Reusable Date Pickers */}
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
        selectedDate={draftStartDate || today}
        onSelectDate={(date) => {
          setDraftStartDate(date);
          setDraftEndDate(date);
        }}
        title="Select Single Date"
      />

      {/* Reusable Dropdown Pickers */}
      <DropdownPickerModal
        visible={employeeDropdownVisible}
        onClose={() => setEmployeeDropdownVisible(false)}
        title="Filter by Employee"
        selectedValue={draftEmployeeId}
        onSelect={(val) => setDraftEmployeeId(val)}
        allOptionLabel="All Employees"
        items={employees.map((e) => ({
          label: `${e.employeeName} (${e.employeeId || 'Employee'})`,
          value: e._id,
          id: e._id,
          subtitle: `${e.designation || 'Employee'} • ${e.phoneNumber || 'No phone'}`,
        }))}
      />

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

      <ExpenseClaimDetailModal
        visible={Boolean(selectedExpenseForModal)}
        expense={selectedExpenseForModal}
        duty={selectedDuty}
        onClose={() => setSelectedExpenseForModal(null)}
        onOpenPhoto={(url, title) => handleOpenExpensePhotoPreview(url, title)}
        onEdit={(exp) => {
          setSelectedExpenseForModal(null);
          navigation.navigate('ExpenseForm', { expenseToEdit: exp, isAdmin: true });
        }}
      />

      <ImageViewerModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        imageUri={previewImageUri}
        title={previewTitle}
        subtitle={previewSubtitle}
        timestamp={previewTimestamp}
        isSignature={previewIsSignature}
      />

      <ExportLoadingModal
        visible={Boolean(exportingType)}
        type={exportingType}
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
  inlineFilterCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: SPACING.sm,
  },
  inlineFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: SPACING.xs,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineFilterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  inlineFilterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickFilterChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    backgroundColor: '#E2E8F0',
  },
  quickFilterChipActive: {
    backgroundColor: COLORS.primary,
  },
  quickFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  quickFilterChipTextActive: {
    color: '#FFFFFF',
  },
  inlineResetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  inlineResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
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
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
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
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  exactAddressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
    marginBottom: 6,
  },
  exactAddressTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  exactAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 18,
    marginTop: 2,
  },
  proofThumbWrap: {
    position: 'relative',
    marginRight: SPACING.sm,
  },
  photoZoomHint: {
    position: 'absolute',
    bottom: 6,
    right: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 4,
    padding: 3,
  },
  mapCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: 6,
  },
  mapInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  openMapBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Active Filter Summary Bar
  activeFiltersBar: {
    marginBottom: SPACING.sm,
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
  // Filter Popup Modal
  filterPopupCard: {
    width: '92%',
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
  filterPopupTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterPopupScroll: {
    marginVertical: SPACING.xs,
  },
  filterPopupSectionTitle: {
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
  filterPopupFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  idRow: {
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
    alignSelf: 'flex-start',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  cardActionEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  cardActionEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  cardActionExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cardActionExpenseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  cardExpenseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cardExpenseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  detailRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  expenseTotalPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  expenseTotalPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  dutyExpenseClaimsList: {
    gap: 8,
    marginTop: 4,
  },
  dutyExpenseCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  dutyExpenseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  dutyExpenseClaimId: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  dutyExpenseClaimDate: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  dutyExpenseClaimAmt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  dutyExpenseItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  dutyExpenseItemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  dutyExpenseItemCalc: {
    fontSize: 10,
    color: '#6366F1',
    fontWeight: '600',
  },
  dutyExpenseItemDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  dutyExpenseItemAmt: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dutyExpenseProofThumb: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
  },
  modalActionFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  modalEditBtn: {
    backgroundColor: COLORS.primary,
  },
  modalExpenseBtn: {
    backgroundColor: '#059669',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  proofCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 2,
  },
  proofCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  claimTapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  claimTapHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  claimInlineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  claimInlineEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
});

export default AllDutiesScreen;
