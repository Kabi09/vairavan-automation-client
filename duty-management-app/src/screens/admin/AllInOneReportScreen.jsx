import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import WebPullToRefresh from '../../components/WebPullToRefresh';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import reportApi from '../../api/reportApi';
import companyApi from '../../api/companyApi';
import clientApi from '../../api/clientApi';
import employeeApi from '../../api/employeeApi';
import expenseApi from '../../api/expenseApi';
import {
  exportAllInOneToPDF,
  exportAllInOneToExcel,
} from '../../utils/reportExportUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const DATE_RANGE_OPTIONS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'previous_month', label: 'Previous Month' },
  { key: 'custom', label: 'Custom Range' },
];

const WORK_TYPES = [
  'Electrical',
  'Mechanical',
  'Installation',
  'Maintenance',
  'Repair',
  'Other',
];

const WORK_STATUSES = [
  { value: 'checked_in', label: 'Checked In' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'correction_requested', label: 'Correction Requested' },
];

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'works', label: 'Works', icon: 'construct-outline' },
  { key: 'staff', label: 'Staff', icon: 'people-outline' },
  { key: 'leaves', label: 'Leaves', icon: 'calendar-outline' },
  { key: 'ot', label: 'Overtime', icon: 'time-outline' },
  { key: 'expenses', label: 'Expenses', icon: 'wallet-outline' },
  { key: 'calendar', label: 'Calendar', icon: 'today-outline' },
];

export const AllInOneReportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Core Data & State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingType, setExportingType] = useState(null); // 'pdf' | 'excel' | null
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Master Dropdown Options
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  // Active Filters State
  const [dateRange, setDateRange] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedWorkType, setSelectedWorkType] = useState('');
  const [selectedWorkStatus, setSelectedWorkStatus] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState('');

  // Search filter inside lists
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDutyId, setExpandedDutyId] = useState(null);
  const [previewImageUri, setPreviewImageUri] = useState(null);

  // Modal Visibility State
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [workTypeModalVisible, setWorkTypeModalVisible] = useState(false);
  const [workStatusModalVisible, setWorkStatusModalVisible] = useState(false);
  const [leaveTypeModalVisible, setLeaveTypeModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [startDateModalVisible, setStartDateModalVisible] = useState(false);
  const [endDateModalVisible, setEndDateModalVisible] = useState(false);
  const [shareDialogVisible, setShareDialogVisible] = useState(false);

  // Load dropdown catalogs on mount
  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    try {
      const [compRes, empRes, catRes] = await Promise.all([
        companyApi.getCompanies({ limit: 500 }).catch(() => null),
        employeeApi.getEmployees({ limit: 500 }).catch(() => null),
        expenseApi.getCategories().catch(() => null),
      ]);

      const compList =
        compRes?.data?.companies ||
        compRes?.companies ||
        (Array.isArray(compRes?.data) ? compRes.data : []);
      setCompanies(Array.isArray(compList) ? compList : []);

      const empList =
        empRes?.data?.employees ||
        empRes?.employees ||
        (Array.isArray(empRes?.data) ? empRes.data : []);
      setEmployees(Array.isArray(empList) ? empList : []);

      const catList =
        catRes?.data?.categories ||
        catRes?.categories ||
        (Array.isArray(catRes?.data) ? catRes.data : []);
      setExpenseCategories(Array.isArray(catList) ? catList : []);
    } catch (err) {
      console.warn('Error loading filter catalogs:', err);
    }
  };

  // Dynamically load clients when selected company changes
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const params = { limit: 500 };
        if (selectedCompanyId) {
          params.companyId = selectedCompanyId;
        }
        const res = await clientApi.getClients(params).catch(() => null);
        const clientList =
          res?.data?.data?.clients ||
          res?.data?.clients ||
          res?.clients ||
          (Array.isArray(res?.data) ? res.data : []);
        setClients(Array.isArray(clientList) ? clientList : []);
      } catch (err) {
        console.warn('Error loading clients:', err);
        setClients([]);
      }
    };
    fetchClients();
  }, [selectedCompanyId]);

  // Construct query params from active filters
  const buildQueryParams = useCallback(() => {
    const params = { dateRange };
    if (dateRange === 'custom') {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }
    if (selectedCompanyId) params.companyId = selectedCompanyId;
    if (selectedClientId) params.clientId = selectedClientId;
    if (selectedEmployeeId) params.employeeId = selectedEmployeeId;
    if (selectedWorkType) params.workType = selectedWorkType;
    if (selectedWorkStatus) params.workStatus = selectedWorkStatus;
    if (selectedLeaveType) params.leaveType = selectedLeaveType;
    if (selectedExpenseCategory) params.expenseCategory = selectedExpenseCategory;
    params.exportAll = 'true';
    return params;
  }, [
    dateRange,
    startDate,
    endDate,
    selectedCompanyId,
    selectedClientId,
    selectedEmployeeId,
    selectedWorkType,
    selectedWorkStatus,
    selectedLeaveType,
    selectedExpenseCategory,
  ]);

  // Fetch report data
  const fetchReport = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = buildQueryParams();
      const res = await reportApi.getAllInOneReport(params);
      if (res && res.data) {
        setReportData(res.data);
      } else {
        throw new Error('No data returned from report server');
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildQueryParams]);

  // Trigger fetch on filter changes
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateRange !== 'this_month') count++;
    if (selectedCompanyId) count++;
    if (selectedClientId) count++;
    if (selectedEmployeeId) count++;
    if (selectedWorkType) count++;
    if (selectedWorkStatus) count++;
    if (selectedLeaveType) count++;
    if (selectedExpenseCategory) count++;
    return count;
  }, [
    dateRange,
    selectedCompanyId,
    selectedClientId,
    selectedEmployeeId,
    selectedWorkType,
    selectedWorkStatus,
    selectedLeaveType,
    selectedExpenseCategory,
  ]);

  // Clear all filters
  const handleResetFilters = () => {
    setDateRange('this_month');
    setStartDate('');
    setEndDate('');
    setSelectedCompanyId('');
    setSelectedClientId('');
    setSelectedEmployeeId('');
    setSelectedWorkType('');
    setSelectedWorkStatus('');
    setSelectedLeaveType('');
    setSelectedExpenseCategory('');
    setFilterDrawerVisible(false);
  };

  // Exports Handlers
  const handleExportPDF = async (action = 'download') => {
    if (!reportData) {
      Alert.alert('Notice', 'Report data is still loading.');
      return;
    }
    if (exportingType) return; // Prevent concurrent requests
    setExportingType('pdf');
    try {
      await exportAllInOneToPDF({ reportData, action });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExcel = async (action = 'download') => {
    if (exportingType) return;
    setExportingType('excel');
    try {
      const params = buildQueryParams();
      await exportAllInOneToExcel({ filters: params, action });
    } finally {
      setExportingType(null);
    }
  };

  // Helper names
  const selectedCompanyName = useMemo(() => {
    if (!selectedCompanyId) return 'All Companies';
    const list = Array.isArray(companies) ? companies : [];
    const c = list.find((x) => x?._id === selectedCompanyId);
    return c ? c.companyName : 'Selected Company';
  }, [selectedCompanyId, companies]);

  const selectedClientName = useMemo(() => {
    if (!selectedClientId) return 'All Clients';
    const list = Array.isArray(clients) ? clients : [];
    const cl = list.find((x) => x?._id === selectedClientId);
    return cl ? cl.clientName : 'Selected Client';
  }, [selectedClientId, clients]);

  const selectedEmployeeName = useMemo(() => {
    if (!selectedEmployeeId) return 'All Staff';
    const list = Array.isArray(employees) ? employees : [];
    const e = list.find((x) => x?._id === selectedEmployeeId);
    return e ? `${e.employeeName} (${e.employeeId || ''})` : 'Selected Staff';
  }, [selectedEmployeeId, employees]);

  // Format currency
  const formatINR = (val) => {
    const num = Number(val || 0);
    return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Filtered lists for active search input
  const summary = reportData?.summary || {};
  const meta = reportData?.meta || {};

  const filteredDutiesList = useMemo(() => {
    const list = reportData?.duties || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((d) => {
      const matchId = (d.dutyId || '').toLowerCase().includes(q);
      const matchEmp = (d.employee?.employeeName || '').toLowerCase().includes(q);
      const matchComp = (d.company?.companyName || '').toLowerCase().includes(q);
      const matchCust = (d.customerName || '').toLowerCase().includes(q);
      const matchMach = (d.machineName || '').toLowerCase().includes(q);
      return matchId || matchEmp || matchComp || matchCust || matchMach;
    });
  }, [reportData?.duties, searchQuery]);

  const cleanEmployeesList = useMemo(() => {
    return (reportData?.employees || []).filter(
      (e) => !isDeveloperAdmin(e) && e.role !== 'admin'
    );
  }, [reportData?.employees]);

  const filteredEmployeesList = useMemo(() => {
    const list = cleanEmployeesList;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((e) => {
      const matchName = (e.employeeName || '').toLowerCase().includes(q);
      const matchId = (e.employeeId || '').toLowerCase().includes(q);
      const matchDesig = (e.designation || '').toLowerCase().includes(q);
      return matchName || matchId || matchDesig;
    });
  }, [reportData?.employees, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Navigation Header with Back Button */}
      <ScreenHeader
        title="All-in-One Report"
        subtitle="Complete Operational Intelligence"
        navigation={navigation}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else {
            try {
              navigation.navigate('DashboardTab');
            } catch {
              navigation.navigate('AdminMainTabs', { screen: 'DashboardTab' });
            }
          }
        }}
        rightAction={
          <View style={styles.headerActionsRow}>
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                activeFiltersCount > 0 && styles.headerActionBtnActive,
              ]}
              onPress={() => setFilterDrawerVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Open Filters"
            >
              <Ionicons
                name="filter"
                size={18}
                color={activeFiltersCount > 0 ? '#FFFFFF' : COLORS.primary}
              />
              {activeFiltersCount > 0 && (
                <View style={styles.filterCountBadge}>
                  <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => fetchReport(true)}
              activeOpacity={0.7}
              disabled={loading || refreshing}
              accessibilityLabel="Refresh Report"
            >
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Sticky Export & Action Bar */}
      <View style={styles.exportBar}>
        <View style={styles.exportBarLeft}>
          <Text style={styles.periodLabel}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />{' '}
            {meta.dateRangeLabel || 'This Month'}
          </Text>
        </View>

        <View style={styles.exportButtonsGroup}>
          {/* Download PDF Button */}
          <TouchableOpacity
            style={[styles.exportBtn, styles.pdfBtn]}
            onPress={() => handleExportPDF('download')}
            disabled={Boolean(exportingType) || loading}
            activeOpacity={0.8}
          >
            {exportingType === 'pdf' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="document-text" size={14} color="#FFFFFF" />
                <Text style={styles.exportBtnText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Download Excel Button */}
          <TouchableOpacity
            style={[styles.exportBtn, styles.excelBtn]}
            onPress={() => handleExportExcel('download')}
            disabled={Boolean(exportingType) || loading}
            activeOpacity={0.8}
          >
            {exportingType === 'excel' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="grid" size={14} color="#FFFFFF" />
                <Text style={styles.exportBtnText}>Excel</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Share Report Button */}
          <TouchableOpacity
            style={[styles.exportBtn, styles.shareBtn]}
            onPress={() => setShareDialogVisible(true)}
            disabled={Boolean(exportingType) || loading}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social" size={14} color="#1E40AF" />
            <Text style={[styles.exportBtnText, { color: '#1E40AF' }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Quick Pills Carousel */}
      <View style={styles.quickPillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPillsContent}
        >
          {DATE_RANGE_OPTIONS.map((opt) => {
            const isSelected = dateRange === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.datePill, isSelected && styles.datePillSelected]}
                onPress={() => {
                  setDateRange(opt.key);
                  if (opt.key === 'custom') {
                    setFilterDrawerVisible(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.datePillText,
                    isSelected && styles.datePillTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.datePill, styles.moreFiltersPill]}
            onPress={() => setFilterDrawerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.datePillText, { color: COLORS.primary }]}>
              {activeFiltersCount > 0 ? `Filters (${activeFiltersCount})` : 'More Filters'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area with Web Pull-to-Refresh */}
      <WebPullToRefresh
        onRefresh={() => fetchReport(true)}
        refreshing={refreshing}
        style={{ flex: 1 }}
      >
        {loading && !refreshing ? (
          <LoadingIndicator message="Aggregating operational analytics & reports..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchReport()} />
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 88 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchReport(true)}
                colors={[COLORS.primary]}
              />
            }
          >
          {/* Summary Dashboard (9 KPI Cards) */}
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderTitle}>Operational Summary</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Metrics calculated from active filters
            </Text>
          </View>

          <View style={styles.kpiGrid}>
            {/* Card 1: Companies */}
            <Card style={styles.kpiCard}>
              <View style={styles.kpiIconWrap}>
                <Ionicons name="business" size={18} color="#2563EB" />
              </View>
              <Text style={styles.kpiValue}>{summary.totalCompanies || 0}</Text>
              <Text style={styles.kpiTitle}>Companies</Text>
            </Card>

            {/* Card 2: Clients */}
            <Card style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="person-circle" size={18} color="#16A34A" />
              </View>
              <Text style={styles.kpiValue}>{summary.totalClients || 0}</Text>
              <Text style={styles.kpiTitle}>Clients</Text>
            </Card>

            {/* Card 3: Employees */}
            <Card style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="people" size={18} color="#9333EA" />
              </View>
              <Text style={styles.kpiValue}>{cleanEmployeesList.length}</Text>
              <Text style={styles.kpiTitle}>Staff Members</Text>
            </Card>

            {/* Card 4: Work Records */}
            <Card style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="construct" size={18} color="#1E40AF" />
              </View>
              <Text style={styles.kpiValue}>{summary.totalWorkRecords || 0}</Text>
              <Text style={styles.kpiTitle}>Work Records</Text>
            </Card>

            {/* Card 5: Working Days */}
            <Card style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="calendar" size={18} color="#059669" />
              </View>
              <Text style={styles.kpiValue}>{summary.totalWorkingDays || 0}</Text>
              <Text style={styles.kpiTitle}>Days Worked</Text>
            </Card>

            {/* Card 6: Leave Days */}
            <Card style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="airplane" size={18} color="#DC2626" />
              </View>
              <Text style={styles.kpiValue}>{summary.totalLeaveDays || 0}</Text>
              <Text style={styles.kpiTitle}>Leave Days</Text>
            </Card>

            {/* Card 7: Comp-Off Earned */}
            <Card style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="trophy" size={18} color="#2563EB" />
              </View>
              <Text style={[styles.kpiValue, { color: '#2563EB' }]}>
                {summary.totalCompOffRecords || 0}
              </Text>
              <Text style={styles.kpiTitle}>Comp-Off Earned</Text>
            </Card>

            {/* Card 8: OT Hours */}
            <Card style={[styles.kpiCard, styles.kpiHighlightOrange]}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="time" size={18} color="#EA580C" />
              </View>
              <Text style={[styles.kpiValue, { color: '#EA580C' }]}>
                {summary.totalOtHours || 0}h
              </Text>
              <Text style={styles.kpiTitle}>Sunday OT Hours</Text>
            </Card>

            {/* Card 9: Total Expenses */}
            <Card style={[styles.kpiCard, styles.kpiHighlightBlue]}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="wallet" size={18} color="#1E40AF" />
              </View>
              <Text style={[styles.kpiValue, { color: '#1E40AF', fontSize: 13 }]}>
                {formatINR(summary.totalExpenses || 0)}
              </Text>
              <Text style={styles.kpiTitle}>Total Expenses</Text>
            </Card>
          </View>

          {/* Segmented Navigation Tabs */}
          <View style={styles.tabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContent}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => {
                      setActiveTab(tab.key);
                      setSearchQuery('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={14}
                      color={isActive ? '#FFFFFF' : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tabButtonText,
                        isActive && styles.tabButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View style={styles.tabSection}>
              {/* Companies & Clients Summary */}
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>
                  Companies & Clients ({reportData?.companies?.length || 0})
                </Text>
              </View>
              {(reportData?.companies || []).length === 0 ? (
                <EmptyState
                  icon="business-outline"
                  title="No companies match filters"
                  description="Try clearing your company or client filter."
                />
              ) : (
                (reportData?.companies || []).map((comp) => (
                  <Card key={comp._id} style={styles.companyOverviewCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitleText}>{comp.companyName}</Text>
                        <Text style={styles.cardSubText}>
                          <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />{' '}
                          {comp.location || 'Location not specified'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.typeBadge,
                          comp.companyType === 'office'
                            ? styles.typeBadgeOffice
                            : styles.typeBadgeClient,
                        ]}
                      >
                        <Text style={styles.typeBadgeText}>
                          {comp.companyType === 'office' ? 'OFFICE' : 'CLIENT SITE'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.compStatsRow}>
                      <View style={styles.compStatItem}>
                        <Text style={styles.compStatValue}>{comp.totalDuties || 0}</Text>
                        <Text style={styles.compStatLabel}>Duties</Text>
                      </View>
                      <View style={styles.compStatItem}>
                        <Text style={styles.compStatValue}>
                          {(comp.clients || []).length}
                        </Text>
                        <Text style={styles.compStatLabel}>Client Contacts</Text>
                      </View>
                      <View style={styles.compStatItem}>
                        <Text style={[styles.compStatValue, { color: COLORS.primary }]}>
                          {formatINR(comp.totalExpenses || 0)}
                        </Text>
                        <Text style={styles.compStatLabel}>Expenses</Text>
                      </View>
                    </View>

                    {(comp.clients || []).length > 0 && (
                      <View style={styles.clientsListWrap}>
                        <Text style={styles.clientsListTitle}>Client Contacts:</Text>
                        <Text style={styles.clientsListText}>
                          {comp.clients
                            .map((cl) => `${cl.clientName} (${cl.clientPhoneNumber || 'No phone'})`)
                            .join(' • ')}
                        </Text>
                      </View>
                    )}
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 2: WORKS */}
          {activeTab === 'works' && (
            <View style={styles.tabSection}>
              <View style={styles.searchBarWrap}>
                <Ionicons name="search" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by Work ID, Staff, Customer, Machine..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.listCountText}>
                Showing {filteredDutiesList.length} of {reportData?.duties?.length || 0} work records
              </Text>

              {filteredDutiesList.length === 0 ? (
                <EmptyState
                  icon="construct-outline"
                  title="No work records found"
                  description="Adjust your search query or filters."
                />
              ) : (
                filteredDutiesList.map((d) => (
                  <Card key={d._id} style={styles.dutyCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.dutyIdBadge}>
                        <Text style={styles.dutyIdText}>{d.dutyId}</Text>
                      </View>
                      <Text style={styles.dutyDateText}>
                        <Ionicons name="calendar-outline" size={11} /> {d.dutyDateReadable}
                      </Text>
                      <StatusBadge status={d.status} />
                    </View>

                    <View style={styles.dutyBody}>
                      <View style={styles.dutyRow}>
                        <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.dutyTextMain}>
                          {d.employee?.employeeName || 'Unknown Staff'}
                        </Text>
                        <Text style={styles.dutyTextMuted}>
                          ({d.employee?.employeeId || 'ID N/A'})
                        </Text>
                      </View>

                      <View style={styles.dutyRow}>
                        <Ionicons name="business-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.dutyTextMain}>
                          {d.company?.companyName || 'Unknown Company'}
                        </Text>
                        {Boolean(d.customerName) && (
                          <Text style={styles.dutyTextMuted}>• {d.customerName}</Text>
                        )}
                      </View>

                      <View style={styles.dutyRow}>
                        <Ionicons name="hardware-chip-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.dutyTextMain}>
                          {d.machineName || 'Machine N/A'}
                        </Text>
                        <View style={styles.workTypePill}>
                          <Text style={styles.workTypePillText}>{d.workType}</Text>
                        </View>
                      </View>

                      <View style={styles.dutyTimingRow}>
                        <View style={styles.timePill}>
                          <Ionicons name="time-outline" size={12} color="#1E40AF" />
                          <Text style={styles.timePillText}>
                            {d.inTime} - {d.outTime}
                          </Text>
                        </View>

                        <View style={styles.durationPill}>
                          <Text style={styles.durationPillText}>
                            {d.workingHours} hrs
                          </Text>
                        </View>

                        {d.otHours > 0 && (
                          <View style={styles.otPill}>
                            <Text style={styles.otPillText}>+{d.otHours}h OT</Text>
                          </View>
                        )}
                      </View>

                      {Boolean(d.workDescription) && (
                        <View style={styles.descBox}>
                          <Text style={styles.descText} numberOfLines={3}>
                            {d.workDescription}
                          </Text>
                        </View>
                      )}

                      {/* Location & Meta Footer */}
                      <TouchableOpacity
                        style={styles.dutyFooterRow}
                        onPress={() => setExpandedDutyId(expandedDutyId === d._id ? null : d._id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.footerInfoItem}>
                          <Ionicons
                            name={d.customerSignature?.url ? 'checkmark-circle' : 'close-circle'}
                            size={12}
                            color={d.customerSignature?.url ? '#16A34A' : '#94A3B8'}
                          />
                          <Text style={styles.footerInfoText}>
                            {d.customerSignature?.url ? 'Signed' : 'No Sig'}
                          </Text>
                        </View>

                        <View style={styles.footerInfoItem}>
                          <Ionicons name="images-outline" size={12} color={COLORS.textSecondary} />
                          <Text style={styles.footerInfoText}>
                            {(d.customerProofPhotos || []).length} Proofs
                          </Text>
                        </View>

                        {d.totalExpenseAmount > 0 && (
                          <View style={styles.footerInfoItem}>
                            <Ionicons name="wallet-outline" size={12} color="#2563EB" />
                            <Text style={[styles.footerInfoText, { color: '#2563EB', fontWeight: '700' }]}>
                              {formatINR(d.totalExpenseAmount)}
                            </Text>
                          </View>
                        )}

                        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '700', marginRight: 2 }}>
                            {expandedDutyId === d._id ? 'Hide Details' : 'Full Details'}
                          </Text>
                          <Ionicons
                            name={expandedDutyId === d._id ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color={COLORS.primary}
                          />
                        </View>
                      </TouchableOpacity>

                      {/* Expanded Full Details Section */}
                      {expandedDutyId === d._id && (
                        <View style={styles.expandedDutySection}>
                          {/* Locations */}
                          <View style={styles.expandedLocationsBox}>
                            <View style={styles.expandedLocItem}>
                              <Text style={styles.expandedLocLabel}>Check-In Location:</Text>
                              <Text style={styles.expandedLocAddr}>
                                {d.checkInLocation?.address || 'Address not recorded'}
                              </Text>
                              {Boolean(d.checkInLocation?.latitude && d.checkInLocation?.longitude) && (
                                <TouchableOpacity
                                  style={styles.mapsBtn}
                                  onPress={() =>
                                    Linking.openURL(
                                      `https://maps.google.com/?q=${d.checkInLocation.latitude},${d.checkInLocation.longitude}`
                                    ).catch(() => {})
                                  }
                                >
                                  <Ionicons name="navigate" size={12} color="#059669" />
                                  <Text style={styles.mapsBtnText}>
                                    Open Maps ({d.checkInLocation.latitude.toFixed(4)}, {d.checkInLocation.longitude.toFixed(4)})
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <View style={[styles.expandedLocItem, { marginTop: 8 }]}>
                              <Text style={styles.expandedLocLabel}>Check-Out Location:</Text>
                              <Text style={styles.expandedLocAddr}>
                                {d.checkOutLocation?.address || 'Address not recorded'}
                              </Text>
                              {Boolean(d.checkOutLocation?.latitude && d.checkOutLocation?.longitude) && (
                                <TouchableOpacity
                                  style={styles.mapsBtn}
                                  onPress={() =>
                                    Linking.openURL(
                                      `https://maps.google.com/?q=${d.checkOutLocation.latitude},${d.checkOutLocation.longitude}`
                                    ).catch(() => {})
                                  }
                                >
                                  <Ionicons name="navigate" size={12} color="#1E40AF" />
                                  <Text style={[styles.mapsBtnText, { color: '#1E40AF' }]}>
                                    Open Maps ({d.checkOutLocation.latitude.toFixed(4)}, {d.checkOutLocation.longitude.toFixed(4)})
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* Proof Photos */}
                          <View style={styles.expandedMediaBlock}>
                            <Text style={styles.expandedMediaTitle}>
                              Proof Photos ({(d.customerProofPhotos || []).length})
                            </Text>
                            {(d.customerProofPhotos || []).length === 0 ? (
                              <Text style={styles.noMediaText}>No proof photos attached</Text>
                            ) : (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                {(d.customerProofPhotos || []).map((p, pIdx) => {
                                  const pUri = typeof p === 'string' ? p : p?.url || p?.uri;
                                  if (!pUri) return null;
                                  return (
                                    <TouchableOpacity
                                      key={pIdx}
                                      onPress={() => setPreviewImageUri(pUri)}
                                      activeOpacity={0.8}
                                      style={styles.expandedPhotoThumbWrap}
                                    >
                                      <Image source={{ uri: pUri }} style={styles.expandedPhotoThumb} />
                                      <View style={styles.zoomPill}>
                                        <Ionicons name="expand" size={10} color="#FFFFFF" />
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </View>

                          {/* Customer Signature */}
                          <View style={styles.expandedMediaBlock}>
                            <Text style={styles.expandedMediaTitle}>Customer Digital Signature</Text>
                            {d.customerSignature?.url || (typeof d.customerSignature === 'string' && d.customerSignature) ? (
                              <TouchableOpacity
                                onPress={() => setPreviewImageUri(d.customerSignature?.url || d.customerSignature)}
                                activeOpacity={0.8}
                                style={styles.expandedSigBox}
                              >
                                <Image
                                  source={{ uri: d.customerSignature?.url || d.customerSignature }}
                                  style={styles.expandedSigImg}
                                  resizeMode="contain"
                                />
                                {Boolean(d.customerSignature?.signedAt) && (
                                  <Text style={styles.expandedSigTime}>
                                    🕒 {d.customerSignature.signedAt.split('T')[0]}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            ) : (
                              <Text style={styles.noMediaText}>No signature recorded</Text>
                            )}
                          </View>

                          {/* Linked Expenses Breakdown */}
                          {(d.linkedExpenses || []).length > 0 && (
                            <View style={styles.expandedExpenseBlock}>
                              <Text style={styles.expandedMediaTitle}>
                                Linked Expense Claims ({(d.linkedExpenses || []).length})
                              </Text>
                              {(d.linkedExpenses || []).map((exp, expIdx) => (
                                <View key={expIdx} style={styles.expandedExpCard}>
                                  <View style={styles.expandedExpHeader}>
                                    <Text style={styles.expandedExpId}>Claim #{exp.expenseId || 'EXP'}</Text>
                                    <Text style={styles.expandedExpAmt}>{formatINR(exp.grandTotal || 0)}</Text>
                                  </View>
                                  {(exp.items || []).map((it, itIdx) => (
                                    <Text key={itIdx} style={styles.expandedExpItem}>
                                      • {it.categoryName}: {formatINR(it.amount)}
                                      {it.calculationMode === 'automatic'
                                        ? ` (${it.totalDistance || ((it.outboundDistance || 0) + (it.returnDistance || 0))} km @ ₹${it.ratePerUnit}/km)`
                                        : ''}
                                    </Text>
                                  ))}
                                  {/* Receipt Attachments */}
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {(exp.items || []).flatMap((it) => it.attachments || []).map((att, aIdx) => {
                                      const attUri = typeof att === 'string' ? att : att?.url || att?.uri;
                                      if (!attUri) return null;
                                      return (
                                        <TouchableOpacity
                                          key={aIdx}
                                          onPress={() => setPreviewImageUri(attUri)}
                                          activeOpacity={0.8}
                                        >
                                          <Image source={{ uri: attUri }} style={styles.expandedReceiptThumb} />
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 3: STAFF */}
          {activeTab === 'staff' && (
            <View style={styles.tabSection}>
              <View style={styles.searchBarWrap}>
                <Ionicons name="search" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search staff by name, ID or designation..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.listCountText}>
                Showing {filteredEmployeesList.length} staff members
              </Text>

              {filteredEmployeesList.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No staff members found"
                  description="Adjust your search query or filters."
                />
              ) : (
                filteredEmployeesList.map((emp) => (
                  <Card key={emp._id} style={styles.staffCard}>
                    <View style={styles.staffHeaderRow}>
                      <View style={styles.staffAvatarWrap}>
                        {emp.avatar ? (
                          <Image
                            source={{
                              uri: typeof emp.avatar === 'string' ? emp.avatar : emp.avatar?.url,
                            }}
                            style={styles.staffAvatarImg}
                          />
                        ) : (
                          <View style={styles.staffAvatarPlaceholder}>
                            <Text style={styles.staffAvatarInitial}>
                              {(emp.employeeName || 'E').substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffNameText}>{emp.employeeName}</Text>
                        <Text style={styles.staffDesigText}>
                          {emp.designation || 'Staff'} • ID: {emp.employeeId}
                        </Text>
                        <Text style={styles.staffContactText}>
                          <Ionicons name="call-outline" size={11} /> {emp.phoneNumber || 'N/A'} •{' '}
                          <Ionicons name="mail-outline" size={11} /> {emp.email}
                        </Text>
                      </View>
                    </View>

                    {/* Staff Operational Metrics Grid */}
                    <View style={styles.staffMetricsGrid}>
                      <View style={styles.staffMetricItem}>
                        <Text style={styles.staffMetricVal}>{emp.totalDuties || 0}</Text>
                        <Text style={styles.staffMetricLabel}>Works</Text>
                      </View>

                      <View style={styles.staffMetricItem}>
                        <Text style={styles.staffMetricVal}>{emp.totalWorkingDays || 0}</Text>
                        <Text style={styles.staffMetricLabel}>Days Worked</Text>
                      </View>

                      <View style={styles.staffMetricItem}>
                        <Text style={styles.staffMetricVal}>{emp.totalWorkingHours || 0}h</Text>
                        <Text style={styles.staffMetricLabel}>Total Hours</Text>
                      </View>

                      <View style={styles.staffMetricItem}>
                        <Text
                          style={[
                            styles.staffMetricVal,
                            emp.totalOtHours > 0 && { color: '#EA580C' },
                          ]}
                        >
                          {emp.totalOtHours || 0}h
                        </Text>
                        <Text style={styles.staffMetricLabel}>OT Hours</Text>
                      </View>

                      <View style={styles.staffMetricItem}>
                        <Text style={styles.staffMetricVal}>
                          {(emp.casualLeaveDays || 0) + (emp.compOffLeaveDays || 0)}d
                        </Text>
                        <Text style={styles.staffMetricLabel}>Leaves</Text>
                      </View>

                      <View style={styles.staffMetricItem}>
                        <Text style={[styles.staffMetricVal, { color: '#2563EB' }]}>
                          {emp.compOffCreditsEarned || 0}
                        </Text>
                        <Text style={styles.staffMetricLabel}>Comp-Off</Text>
                      </View>
                    </View>

                    {/* Jump to Individual Calendar Action */}
                    <TouchableOpacity
                      style={styles.calendarJumpBtn}
                      onPress={() => {
                        setSelectedEmployeeId(emp._id);
                        setActiveTab('calendar');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="calendar" size={13} color={COLORS.primary} />
                      <Text style={styles.calendarJumpBtnText}>
                        View Monthly Attendance Calendar
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                    </TouchableOpacity>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 4: LEAVES & COMP-OFF */}
          {activeTab === 'leaves' && (
            <View style={styles.tabSection}>
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>
                  Leaves & Comp-Off (
                  {(reportData?.leaves?.length || 0) +
                    (reportData?.compOffCredits?.length || 0)}
                  )
                </Text>
              </View>

              {/* Sunday Comp-Off Credits */}
              {(reportData?.compOffCredits || []).map((c) => (
                <Card key={c._id} style={[styles.leaveCard, styles.compOffCreditCard]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.compOffPill}>
                      <Ionicons name="trophy" size={12} color="#C2410C" />
                      <Text style={styles.compOffPillText}>SUNDAY COMP-OFF EARNED</Text>
                    </View>
                    <Text style={styles.dutyDateText}>
                      {c.sundayDateString || (c.sundayDate ? c.sundayDate.split('T')[0] : '')}
                    </Text>
                    <View style={styles.statusEarnedBadge}>
                      <Text style={styles.statusEarnedBadgeText}>EARNED</Text>
                    </View>
                  </View>

                  <Text style={styles.leaveStaffName}>
                    {c.employee?.employeeName || 'Staff Member'} ({c.employee?.employeeId || ''})
                  </Text>
                  <Text style={styles.leaveReasonText}>
                    {c.notes || 'Earned from Sunday duty attendance. Auto-credited by system.'}
                  </Text>
                </Card>
              ))}

              {/* Leave Applications */}
              {(reportData?.leaves || []).length === 0 && (reportData?.compOffCredits || []).length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title="No leaves recorded"
                  description="No staff leave requests or comp-off credits for this period."
                />
              ) : (
                (reportData?.leaves || []).map((l) => (
                  <Card key={l._id} style={styles.leaveCard}>
                    <View style={styles.cardHeaderRow}>
                      <View
                        style={[
                          styles.leaveTypePill,
                          l.leaveType === 'comp_off'
                            ? styles.leaveTypePillCompOff
                            : styles.leaveTypePillCasual,
                        ]}
                      >
                        <Text style={styles.leaveTypePillText}>
                          {l.leaveType === 'comp_off' ? 'COMP-OFF LEAVE' : 'CASUAL LEAVE'}
                        </Text>
                      </View>
                      <Text style={styles.dutyDateText}>
                        {l.daysCount || 1} day{l.daysCount > 1 ? 's' : ''}
                      </Text>
                      <StatusBadge status={l.status} />
                    </View>

                    <Text style={styles.leaveStaffName}>
                      {l.employee?.employeeName || 'Staff Member'} ({l.employee?.employeeId || ''})
                    </Text>
                    <Text style={styles.leaveDatesText}>
                      <Ionicons name="time-outline" size={12} />{' '}
                      {l.startDate ? l.startDate.split('T')[0] : ''} to{' '}
                      {l.endDate ? l.endDate.split('T')[0] : ''}
                    </Text>
                    <Text style={styles.leaveReasonText}>
                      <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>Reason: </Text>
                      {l.reason || 'No reason provided'}
                    </Text>

                    {Boolean(l.adminRemarks) && (
                      <View style={styles.adminRemarkBox}>
                        <Text style={styles.adminRemarkText}>
                          <Text style={{ fontWeight: '700', color: '#1E3A8A' }}>Admin Remarks: </Text>
                          {l.adminRemarks}
                        </Text>
                      </View>
                    )}
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 5: OVERTIME (OT) */}
          {activeTab === 'ot' && (
            <View style={styles.tabSection}>
              <View style={styles.otSummaryBanner}>
                <View style={styles.otBannerIconWrap}>
                  <Ionicons name="time" size={24} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otBannerTitle}>
                    Total Sunday Overtime: {summary.totalOtHours || 0} Hours
                  </Text>
                  <Text style={styles.otBannerSub}>
                    Recorded strictly for Sunday duties. Weekdays do not calculate overtime.
                  </Text>
                </View>
              </View>

              {(reportData?.overtimeRecords || []).length === 0 ? (
                <EmptyState
                  icon="time-outline"
                  title="No Sunday overtime recorded"
                  description="No duties recorded on Sunday for the selected period and filters."
                />
              ) : (
                (reportData?.overtimeRecords || []).map((ot, idx) => (
                  <Card key={`${ot.dutyId}_${idx}`} style={styles.otCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.dutyIdBadge}>
                        <Text style={styles.dutyIdText}>{ot.dutyId}</Text>
                      </View>
                      <Text style={styles.dutyDateText}>{ot.dutyDateStr}</Text>
                      <View style={styles.otPillLarge}>
                        <Text style={styles.otPillLargeText}>+{ot.otHours}h Sunday OT</Text>
                      </View>
                    </View>

                    <Text style={styles.otStaffName}>
                      {ot.employee?.employeeName || 'Staff'} ({ot.employee?.employeeId || ''})
                    </Text>
                    <Text style={styles.otCompText}>
                      <Ionicons name="business-outline" size={12} />{' '}
                      {ot.company?.companyName || 'Site'}
                    </Text>

                    <View style={styles.otHoursCompareRow}>
                      <View style={styles.otHoursCol}>
                        <Text style={styles.otHoursVal}>{ot.inTime} - {ot.outTime}</Text>
                        <Text style={styles.otHoursLabel}>Shift Timings</Text>
                      </View>
                      <View style={styles.otHoursCol}>
                        <Text style={styles.otHoursVal}>{ot.workingHours} hrs</Text>
                        <Text style={styles.otHoursLabel}>Total Worked</Text>
                      </View>
                      <View style={styles.otHoursCol}>
                        <Text style={styles.otHoursVal}>Sunday</Text>
                        <Text style={styles.otHoursLabel}>Day Type</Text>
                      </View>
                      <View style={styles.otHoursCol}>
                        <Text style={[styles.otHoursVal, { color: '#EA580C' }]}>
                          {ot.otHours} hrs
                        </Text>
                        <Text style={[styles.otHoursLabel, { color: '#EA580C' }]}>
                          Sunday OT
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 6: EXPENSES */}
          {activeTab === 'expenses' && (
            <View style={styles.tabSection}>
              <View style={styles.expenseSummaryBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseBannerTitle}>
                    Total Claims: {formatINR(summary.totalExpenses || 0)}
                  </Text>
                  <Text style={styles.expenseBannerSub}>
                    {reportData?.expenses?.length || 0} claims submitted in this period
                  </Text>
                </View>
              </View>

              {(reportData?.expenses || []).length === 0 ? (
                <EmptyState
                  icon="wallet-outline"
                  title="No expense claims"
                  description="No travel or site expenses recorded for this period."
                />
              ) : (
                (reportData?.expenses || []).map((exp) => (
                  <Card key={exp._id} style={styles.expenseCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.expIdBadge}>
                        <Text style={styles.expIdText}>
                          {exp.expenseId || ('EXP-' + String(exp._id || '').slice(-4).toUpperCase())}
                        </Text>
                      </View>
                      <Text style={styles.dutyDateText}>
                        {exp.expenseDate ? exp.expenseDate.split('T')[0] : ''}
                      </Text>
                      <Text style={styles.expenseTotalText}>
                        {formatINR(exp.grandTotal || 0)}
                      </Text>
                    </View>

                    <Text style={styles.expStaffName}>
                      {exp.employee?.employeeName || 'Staff'} ({exp.employee?.employeeId || ''})
                    </Text>
                    <Text style={styles.expCompName}>
                      <Ionicons name="business-outline" size={12} />{' '}
                      {exp.company?.companyName || 'Office'}
                      {exp.duty?.dutyId ? ` • Linked: ${exp.duty.dutyId}` : ''}
                    </Text>

                    {/* Breakdown items */}
                    <View style={styles.expItemsTray}>
                      {(exp.items || []).map((it, idx) => (
                        <View key={idx} style={styles.expItemRow}>
                          <Text style={styles.expItemCat}>
                            • {it.categoryName}
                            {it.calculationMode === 'automatic'
                              ? ` (${it.totalDistance || ((it.outboundDistance || 0) + (it.returnDistance || 0))} km @ ₹${it.ratePerUnit}/km)`
                              : ''}
                          </Text>
                          <Text style={styles.expItemAmt}>{formatINR(it.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 7: CALENDAR */}
          {activeTab === 'calendar' && (
            <View style={styles.tabSection}>
              {!selectedEmployeeId ? (
                <Card style={styles.calendarPromptCard}>
                  <Ionicons name="calendar" size={32} color={COLORS.primary} />
                  <Text style={styles.calendarPromptTitle}>
                    Select an Employee to View Full Attendance Calendar
                  </Text>
                  <Text style={styles.calendarPromptSub}>
                    View daily check-ins, checkouts, working hours, Comp-Off credits, and leave statuses for any staff member.
                  </Text>
                  <TouchableOpacity
                    style={styles.selectEmployeePromptBtn}
                    onPress={() => setEmployeeModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person" size={14} color="#FFFFFF" />
                    <Text style={styles.selectEmployeePromptBtnText}>
                      Choose Staff Member
                    </Text>
                  </TouchableOpacity>
                </Card>
              ) : (
                <View>
                  {/* Selected Staff Header */}
                  <View style={styles.calStaffHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.calStaffName}>{selectedEmployeeName}</Text>
                      <Text style={styles.calStaffSub}>
                        Daily attendance, duty logs & leave records for {meta.dateRangeLabel}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.calSwitchStaffBtn}
                      onPress={() => setEmployeeModalVisible(true)}
                    >
                      <Text style={styles.calSwitchStaffText}>Change Staff</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Day-by-Day Calendar Feed */}
                  {reportData?.employeeCalendar?.calendarDays?.map((day) => (
                    <Card key={day.dateStr} style={styles.calDayCard}>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.calDateBadge}>
                          <Text style={styles.calDateBadgeDay}>{String(day.dateStr || '').slice(-2)}</Text>
                          <Text style={styles.calDateBadgeName}>{String(day.dayName || '').slice(0, 3)}</Text>
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                              style={[
                                styles.calStatusDot,
                                { backgroundColor: day.statusColor },
                              ]}
                            />
                            <Text
                              style={[
                                styles.calStatusText,
                                { color: day.statusColor },
                              ]}
                            >
                              {day.status}
                            </Text>
                          </View>
                          <Text style={styles.calScheduleText}>
                            {day.isSunday
                              ? 'Sunday Weekly Holiday'
                              : day.isHoliday
                              ? `Company Holiday (${day.holidayName})`
                              : 'Scheduled Working Day'}
                          </Text>
                        </View>

                        {day.compOffEarned && (
                          <View style={styles.compOffMiniBadge}>
                            <Ionicons name="trophy" size={10} color="#C2410C" />
                            <Text style={styles.compOffMiniBadgeText}>Comp-Off</Text>
                          </View>
                        )}
                      </View>

                      {day.duty && (
                        <View style={styles.calDutyBox}>
                          <View style={styles.dutyRow}>
                            <Ionicons name="construct" size={12} color="#1E40AF" />
                            <Text style={styles.dutyTextMain}>
                              {day.duty.dutyId} • {day.duty.companyName}
                            </Text>
                            <View style={styles.timePill}>
                              <Text style={styles.timePillText}>
                                {day.duty.inTime} - {day.duty.outTime}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.calDutyWorkText}>
                            {day.duty.workType} • {day.duty.durationMinutes} mins
                            {day.duty.otHours > 0 ? ` (+${day.duty.otHours}h OT)` : ''}
                          </Text>
                        </View>
                      )}

                      {day.leave && (
                        <View style={styles.calLeaveBox}>
                          <Text style={styles.calLeaveText}>
                            <Ionicons name="airplane" size={12} color="#DC2626" />{' '}
                            {day.leave.leaveType === 'comp_off' ? 'Comp-Off Leave' : 'Casual Leave'} •{' '}
                            {day.leave.status.toUpperCase()}
                            {day.leave.reason ? ` (${day.leave.reason})` : ''}
                          </Text>
                        </View>
                      )}
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
      </WebPullToRefresh>

      {/* Advanced Filters Drawer Overlay */}
      {filterDrawerVisible && (
        <View style={styles.filterDrawerRootOverlay}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setFilterDrawerVisible(false)}
          >
            <View
              style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Report Filters</Text>
                  <Text style={styles.modalSubtitle}>
                    Combine operational filters across companies, staff & dates
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFilterDrawerVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Date Presets */}
                <Text style={styles.filterGroupLabel}>Date Range</Text>
                <View style={styles.filterPillsRow}>
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.filterSelectPill,
                        dateRange === opt.key && styles.filterSelectPillActive,
                      ]}
                      onPress={() => setDateRange(opt.key)}
                    >
                      <Text
                        style={[
                          styles.filterSelectPillText,
                          dateRange === opt.key && styles.filterSelectPillTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Date Pickers */}
                {dateRange === 'custom' && (
                  <View style={styles.customDatePickersRow}>
                    <TouchableOpacity
                      style={styles.datePickerTrigger}
                      onPress={() => setStartDateModalVisible(true)}
                    >
                      <Text style={styles.pickerFieldLabel}>From Date</Text>
                      <Text style={styles.pickerFieldValue}>
                        {startDate || 'Select Start Date'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.datePickerTrigger}
                      onPress={() => setEndDateModalVisible(true)}
                    >
                      <Text style={styles.pickerFieldLabel}>To Date</Text>
                      <Text style={styles.pickerFieldValue}>
                        {endDate || 'Select End Date'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Company Picker */}
                <Text style={styles.filterGroupLabel}>Company</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setCompanyModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>{selectedCompanyName}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Client Picker */}
                <Text style={styles.filterGroupLabel}>Client (Filtered by Company)</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setClientModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>{selectedClientName}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Employee Picker */}
                <Text style={styles.filterGroupLabel}>Staff Member</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setEmployeeModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>{selectedEmployeeName}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Work Type */}
                <Text style={styles.filterGroupLabel}>Work Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setWorkTypeModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {selectedWorkType || 'All Work Types'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Work Status */}
                <Text style={styles.filterGroupLabel}>Work Status</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setWorkStatusModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {selectedWorkStatus
                      ? WORK_STATUSES.find((s) => s.value === selectedWorkStatus)?.label ||
                        selectedWorkStatus
                      : 'All Statuses'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Leave Type */}
                <Text style={styles.filterGroupLabel}>Leave Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setLeaveTypeModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {selectedLeaveType === 'casual_leave'
                      ? 'Casual Leave'
                      : selectedLeaveType === 'comp_off'
                      ? 'Comp-Off'
                      : 'All Leave Types'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Expense Category */}
                <Text style={styles.filterGroupLabel}>Expense Category</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setCategoryModalVisible(true)}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {selectedExpenseCategory || 'All Expense Categories'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </ScrollView>

              {/* Modal Action Buttons */}
              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity
                  style={styles.resetFiltersBtn}
                  onPress={handleResetFilters}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetFiltersBtnText}>Clear All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyFiltersBtn}
                  onPress={() => {
                    setFilterDrawerVisible(false);
                    fetchReport();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyFiltersBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Share Options Dialog Overlay */}
      {shareDialogVisible && (
        <View style={styles.filterDrawerRootOverlay}>
          <TouchableOpacity
            style={[
              styles.modalOverlay,
              { justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
            ]}
            activeOpacity={1}
            onPress={() => setShareDialogVisible(false)}
          >
            <View
              style={styles.shareDialogBox}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.shareDialogTitle}>Share All-in-One Report</Text>
              <Text style={styles.shareDialogSubtitle}>
                Select the file format to share via WhatsApp, Email, or other apps:
              </Text>

              <TouchableOpacity
                style={styles.shareOptionRow}
                onPress={() => {
                  setShareDialogVisible(false);
                  handleExportPDF('share');
                }}
              >
                <View style={[styles.shareIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="document-text" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareOptionTitle}>PDF Document (.pdf)</Text>
                  <Text style={styles.shareOptionSub}>
                    Formatted multi-page visual report with branding
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOptionRow}
                onPress={() => {
                  setShareDialogVisible(false);
                  handleExportExcel('share');
                }}
              >
                <View style={[styles.shareIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="grid" size={20} color="#15803D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareOptionTitle}>Excel Spreadsheet (.xlsx)</Text>
                  <Text style={styles.shareOptionSub}>
                    9 individual styled worksheets with auto-filters
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareCancelBtn}
                onPress={() => setShareDialogVisible(false)}
              >
                <Text style={styles.shareCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Dropdown Pickers */}
      {/* 1. Company Picker */}
      <DropdownPickerModal
        visible={companyModalVisible}
        title="Select Company"
        items={(Array.isArray(companies) ? companies : []).map((c) => ({
          label: c?.companyName || 'Company',
          subtitle: `${c?.companyType === 'office' ? 'Office' : 'Client Site'} • ${c?.location || ''}`,
          value: c?._id,
        }))}
        selectedValue={selectedCompanyId}
        onSelect={(val) => {
          setSelectedCompanyId(val);
          setSelectedClientId(''); // Reset client when company changes
          setCompanyModalVisible(false);
        }}
        onClose={() => setCompanyModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Companies"
      />

      {/* 2. Client Picker */}
      <DropdownPickerModal
        visible={clientModalVisible}
        title="Select Client Contact"
        items={(Array.isArray(clients) ? clients : []).map((cl) => ({
          label: cl?.clientName || 'Client',
          subtitle: cl?.clientPhoneNumber || 'No phone',
          value: cl?._id,
        }))}
        selectedValue={selectedClientId}
        onSelect={(val) => {
          setSelectedClientId(val);
          setClientModalVisible(false);
        }}
        onClose={() => setClientModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Clients"
      />

      {/* 3. Employee Picker */}
      <DropdownPickerModal
        visible={employeeModalVisible}
        title="Select Staff Member"
        items={(Array.isArray(employees) ? employees : []).filter((e) => !isDeveloperAdmin(e) && e.role !== 'admin').map((e) => ({
          label: e?.employeeName || 'Staff',
          subtitle: `${e?.designation || 'Staff'} • ID: ${e?.employeeId || ''}`,
          value: e?._id,
        }))}
        selectedValue={selectedEmployeeId}
        onSelect={(val) => {
          setSelectedEmployeeId(val);
          setEmployeeModalVisible(false);
        }}
        onClose={() => setEmployeeModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Staff Members"
      />

      {/* 4. Work Type Picker */}
      <DropdownPickerModal
        visible={workTypeModalVisible}
        title="Select Work Type"
        items={WORK_TYPES.map((wt) => ({ label: wt, value: wt }))}
        selectedValue={selectedWorkType}
        onSelect={(val) => {
          setSelectedWorkType(val);
          setWorkTypeModalVisible(false);
        }}
        onClose={() => setWorkTypeModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Work Types"
      />

      {/* 5. Work Status Picker */}
      <DropdownPickerModal
        visible={workStatusModalVisible}
        title="Select Work Status"
        items={WORK_STATUSES.map((ws) => ({ label: ws.label, value: ws.value }))}
        selectedValue={selectedWorkStatus}
        onSelect={(val) => {
          setSelectedWorkStatus(val);
          setWorkStatusModalVisible(false);
        }}
        onClose={() => setWorkStatusModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Statuses"
      />

      {/* 6. Leave Type Picker */}
      <DropdownPickerModal
        visible={leaveTypeModalVisible}
        title="Select Leave Type"
        items={[
          { label: 'Casual Leave', value: 'casual_leave' },
          { label: 'Comp-Off', value: 'comp_off' },
        ]}
        selectedValue={selectedLeaveType}
        onSelect={(val) => {
          setSelectedLeaveType(val);
          setLeaveTypeModalVisible(false);
        }}
        onClose={() => setLeaveTypeModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Leave Types"
      />

      {/* 7. Expense Category Picker */}
      <DropdownPickerModal
        visible={categoryModalVisible}
        title="Select Expense Category"
        items={(Array.isArray(expenseCategories) ? expenseCategories : []).map((c) => ({
          label: c?.name || 'Category',
          subtitle: `${c?.calculationMode === 'automatic' ? 'Automatic (km)' : 'Manual'}`,
          value: c?.name,
        }))}
        selectedValue={selectedExpenseCategory}
        onSelect={(val) => {
          setSelectedExpenseCategory(val);
          setCategoryModalVisible(false);
        }}
        onClose={() => setCategoryModalVisible(false)}
        showAllOption={true}
        allOptionLabel="All Categories"
      />

      {/* 8. Start Date Modal */}
      <DatePickerModal
        visible={startDateModalVisible}
        selectedDate={startDate}
        onSelectDate={(date) => {
          setStartDate(date);
          setStartDateModalVisible(false);
        }}
        onClose={() => setStartDateModalVisible(false)}
        title="Select From Date"
      />

      {/* 9. End Date Modal */}
      <DatePickerModal
        visible={endDateModalVisible}
        selectedDate={endDate}
        onSelectDate={(date) => {
          setEndDate(date);
          setEndDateModalVisible(false);
        }}
        onClose={() => setEndDateModalVisible(false)}
        title="Select To Date"
      />

      {/* 10. Full-Screen Image Preview Modal */}
      {Boolean(previewImageUri) && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewImageUri(null)}
        >
          <View style={styles.imagePreviewOverlay}>
            <TouchableOpacity
              style={styles.imagePreviewCloseBtn}
              onPress={() => setPreviewImageUri(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: previewImageUri }}
              style={styles.imagePreviewFull}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  filterCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  exportBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  exportBarLeft: {
    flex: 1,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  exportButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  shareBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickPillsContainer: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
  },
  quickPillsContent: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  datePillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  moreFiltersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  datePillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  sectionHeaderWrap: {
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionHeaderSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    width: '31.5%',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  kpiHighlightOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  kpiHighlightBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  kpiTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  tabsContainer: {
    marginBottom: 12,
  },
  tabsContent: {
    gap: 6,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabSection: {
    marginBottom: 20,
  },
  subSectionHeader: {
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    paddingHorizontal: 8,
  },
  listCountText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  companyOverviewCard: {
    padding: 12,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSubText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeBadgeOffice: {
    backgroundColor: '#DBEAFE',
  },
  typeBadgeClient: {
    backgroundColor: '#DCFCE7',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E40AF',
  },
  compStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginVertical: 8,
  },
  compStatItem: {
    alignItems: 'center',
  },
  compStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  compStatLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  clientsListWrap: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  clientsListTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  clientsListText: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 14,
  },
  dutyCard: {
    padding: 12,
    marginBottom: 10,
  },
  dutyIdBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dutyIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dutyDateText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  dutyBody: {
    marginTop: 6,
  },
  dutyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dutyTextMain: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  dutyTextMuted: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  workTypePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  workTypePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dutyTimingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  durationPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  otPill: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  otPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
  },
  descBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 6,
    marginTop: 4,
  },
  descText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  dutyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 8,
  },
  footerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerInfoText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  staffCard: {
    padding: 12,
    marginBottom: 10,
  },
  staffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  staffAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  staffAvatarImg: {
    width: '100%',
    height: '100%',
  },
  staffAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAvatarInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  staffNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  staffDesigText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  staffContactText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  staffMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginBottom: 10,
  },
  staffMetricItem: {
    alignItems: 'center',
  },
  staffMetricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  staffMetricLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  calendarJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.sm,
  },
  calendarJumpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  leaveCard: {
    padding: 12,
    marginBottom: 10,
  },
  compOffCreditCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  compOffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compOffPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
  },
  statusEarnedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusEarnedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  leaveTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  leaveTypePillCompOff: {
    backgroundColor: '#DBEAFE',
  },
  leaveTypePillCasual: {
    backgroundColor: '#FEE2E2',
  },
  leaveTypePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E40AF',
  },
  leaveStaffName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  leaveDatesText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginVertical: 2,
  },
  leaveReasonText: {
    fontSize: 11,
    color: COLORS.text,
    marginTop: 2,
  },
  adminRemarkBox: {
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
  },
  adminRemarkText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  otSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
  },
  otBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EA580C',
  },
  otBannerSub: {
    fontSize: 10,
    color: '#9A3412',
    marginTop: 2,
  },
  otCard: {
    padding: 12,
    marginBottom: 10,
  },
  otPillLarge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  otPillLargeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
  },
  otStaffName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  otCompText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  otHoursCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 8,
  },
  otHoursCol: {
    alignItems: 'center',
  },
  otHoursVal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  otHoursLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  expenseSummaryBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
  },
  expenseBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E40AF',
  },
  expenseBannerSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  expenseCard: {
    padding: 12,
    marginBottom: 10,
  },
  expIdBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  expenseTotalText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E40AF',
  },
  expStaffName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  expCompName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  expItemsTray: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 6,
  },
  expItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  expItemCat: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  expItemAmt: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  calendarPromptCard: {
    padding: 24,
    alignItems: 'center',
    textAlign: 'center',
  },
  calendarPromptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 10,
  },
  calendarPromptSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 16,
  },
  selectEmployeePromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  selectEmployeePromptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calStaffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: 10,
  },
  calStaffName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  calStaffSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  calSwitchStaffBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  calSwitchStaffText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  calDayCard: {
    padding: 10,
    marginBottom: 8,
  },
  calDateBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calDateBadgeDay: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  calDateBadgeName: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  calStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  calScheduleText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  compOffMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compOffMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
  },
  calDutyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    padding: 6,
    marginTop: 6,
  },
  calDutyWorkText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  calLeaveBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
    padding: 6,
    marginTop: 6,
  },
  calLeaveText: {
    fontSize: 10,
    color: '#991B1B',
  },
  filterDrawerRootOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 990,
    elevation: 990,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: SPACING.md,
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterSelectPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterSelectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterSelectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customDatePickersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  datePickerTrigger: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: 8,
  },
  pickerFieldLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pickerFieldValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownTriggerText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  resetFiltersBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFiltersBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  applyFiltersBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFiltersBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareDialogBox: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 18,
    ...SHADOWS.lg,
  },
  shareDialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  shareDialogSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginVertical: 8,
  },
  shareOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shareIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  shareOptionSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  shareCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  shareCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  expandedDutySection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  expandedLocationsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expandedLocItem: {
    marginBottom: 4,
  },
  expandedLocLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 1,
  },
  expandedLocAddr: {
    fontSize: 11,
    color: COLORS.text,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  mapsBtnText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  expandedMediaBlock: {
    marginTop: 10,
  },
  expandedMediaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  noMediaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  expandedPhotoThumbWrap: {
    marginRight: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  expandedPhotoThumb: {
    width: 80,
    height: 60,
    borderRadius: RADIUS.sm,
  },
  zoomPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 2,
  },
  expandedSigBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.sm,
    padding: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  expandedSigImg: {
    width: 140,
    height: 50,
  },
  expandedSigTime: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  expandedExpenseBlock: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  expandedExpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  expandedExpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  expandedExpId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },
  expandedExpAmt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  expandedExpItem: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  expandedReceiptThumb: {
    width: 44,
    height: 36,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 999,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  imagePreviewFull: {
    width: '90%',
    height: '80%',
  },
});

export default AllInOneReportScreen;

