import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import expenseApi from '../../api/expenseApi';
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
import ImageViewerModal from '../../components/ImageViewerModal';
import ExportLoadingModal from '../../components/ExportLoadingModal';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportExpensesToPDF, exportExpensesToExcel } from '../../utils/exportUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const AdminExpensesScreen = ({ navigation, route }) => {
  const [expenses, setExpenses] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exportingType, setExportingType] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter Modals Visibility
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [employeeDropdownVisible, setEmployeeDropdownVisible] = useState(false);
  const [companyDropdownVisible, setCompanyDropdownVisible] = useState(false);
  const [categoryDropdownVisible, setCategoryDropdownVisible] = useState(false);

  // Details Modal
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Categories Management Modal
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catMode, setCatMode] = useState('manual'); // 'manual' | 'automatic'
  const [catUnit, setCatUnit] = useState('km');
  const [catRate, setCatRate] = useState('');
  const [catStatus, setCatStatus] = useState('active'); // 'active' | 'inactive'
  const [catSaving, setCatSaving] = useState(false);

  // Lightbox Preview Modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Auto-open target expense if navigated with route.params.expenseId
  const targetExpenseId = route?.params?.expenseId;
  const handledExpenseIdRef = useRef(null);

  useEffect(() => {
    if (!targetExpenseId) return;
    if (handledExpenseIdRef.current === targetExpenseId) return;

    const found = expenses.find(
      (e) => String(e._id) === String(targetExpenseId) || String(e.expenseId) === String(targetExpenseId)
    );

    if (found) {
      handledExpenseIdRef.current = targetExpenseId;
      setSelectedExpense(found);
    } else {
      expenseApi
        .getExpenseById(targetExpenseId)
        .then((res) => {
          const exp = res?.data?.expense || res?.data;
          if (exp && (exp._id || exp.expenseId)) {
            handledExpenseIdRef.current = targetExpenseId;
            setSelectedExpense(exp);
          }
        })
        .catch((e) => {
          console.warn('[AdminExpensesScreen] Could not fetch target expense:', e.message);
        });
    }
  }, [targetExpenseId, expenses]);

  // Fetch all initial data
  const fetchData = async () => {
    try {
      setError('');
      const [expRes, catsRes, empsRes, compsRes] = await Promise.all([
        expenseApi.getAllExpenses({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          employee: selectedEmployeeId || undefined,
          company: selectedCompanyId || undefined,
          category: selectedCategoryId || undefined,
          search: search || undefined,
        }),
        expenseApi.getCategories(),
        employeeApi.getEmployees(),
        companyApi.getCompanies(),
      ]);

      if (expRes.data) {
        setExpenses(expRes.data.expenses || []);
        setMetrics(expRes.data.metrics || null);
      }
      if (catsRes.data) {
        setCategories(catsRes.data.categories || []);
      }
      if (empsRes.data) {
        setEmployees(empsRes.data.employees || []);
      }
      if (compsRes.data) {
        setCompanies(compsRes.data.companies || []);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load expense records'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [startDate, endDate, selectedEmployeeId, selectedCompanyId, selectedCategoryId, search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const hasActiveFilters = Boolean(
    startDate || endDate || selectedEmployeeId || selectedCompanyId || selectedCategoryId
  );

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedEmployeeId('');
    setSelectedCompanyId('');
    setSelectedCategoryId('');
    setSearch('');
  };

  // PDF Export
  const handleExportPDF = async () => {
    try {
      setExportingType('PDF');
      const filterParts = [];
      if (startDate || endDate) filterParts.push(`Date: ${startDate || 'Start'} to ${endDate || 'Present'}`);
      if (selectedEmployeeId) {
        const emp = employees.find((e) => e._id === selectedEmployeeId);
        if (emp) filterParts.push(`Staff: ${emp.employeeName}`);
      }
      if (selectedCompanyId) {
        const comp = companies.find((c) => c._id === selectedCompanyId);
        if (comp) filterParts.push(`Company: ${comp.companyName}`);
      }

      await exportExpensesToPDF({
        title: 'Expense Claims Report',
        subtitle: 'All Staff Submitted Expenses',
        expenses,
        filterInfo: filterParts.join(' • '),
      });
    } finally {
      setExportingType(null);
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setExportingType('Excel');
      await exportExpensesToExcel({
        filename: 'Expense_Claims_Report',
        expenses,
      });
    } finally {
      setExportingType(null);
    }
  };

  // Open Category Editor Modal
  const handleOpenCategoryEditor = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatName(cat.name);
      setCatDesc(cat.description || '');
      setCatMode(cat.calculationMode || 'manual');
      setCatUnit(cat.unit || 'km');
      setCatRate(cat.ratePerUnit ? String(cat.ratePerUnit) : '');
      setCatStatus(cat.status || 'active');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatDesc('');
      setCatMode('manual');
      setCatUnit('km');
      setCatRate('');
      setCatStatus('active');
    }
    setCategoryModalVisible(true);
  };

  // Save Category
  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('Validation Error', 'Category name is required.');
      return;
    }
    if (catMode === 'automatic') {
      const rateNum = parseFloat(catRate);
      if (isNaN(rateNum) || rateNum < 0) {
        Alert.alert('Validation Error', 'Please enter a valid rate per unit for automatic calculation.');
        return;
      }
    }

    try {
      setCatSaving(true);
      const payload = {
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        calculationMode: catMode,
        unit: catMode === 'automatic' ? (catUnit.trim() || 'km') : undefined,
        ratePerUnit: catMode === 'automatic' ? parseFloat(catRate) || 0 : 0,
        status: catStatus,
      };

      if (editingCategory) {
        await expenseApi.updateCategory(editingCategory._id, payload);
      } else {
        await expenseApi.createCategory(payload);
      }

      const catsRes = await expenseApi.getCategories();
      if (catsRes.data) {
        setCategories(catsRes.data.categories || []);
      }
      setCategoryModalVisible(false);
      Alert.alert('Success', `Expense category ${editingCategory ? 'updated' : 'created'} successfully.`);
    } catch (saveErr) {
      Alert.alert('Save Failed', extractErrorMessage(saveErr, 'Failed to save expense category'));
    } finally {
      setCatSaving(false);
    }
  };

  // Toggle Category Status (Activate / Deactivate)
  const handleToggleCategoryStatus = async (cat) => {
    try {
      const newStatus = cat.status === 'active' ? 'inactive' : 'active';
      await expenseApi.updateCategory(cat._id, { status: newStatus });
      const catsRes = await expenseApi.getCategories();
      if (catsRes.data) {
        setCategories(catsRes.data.categories || []);
      }
    } catch (toggleErr) {
      Alert.alert('Update Failed', extractErrorMessage(toggleErr, 'Failed to toggle category status'));
    }
  };

  const renderExpenseItem = ({ item }) => {
    const categoriesList = [
      ...new Set(
        (item.items || []).map((it) =>
          it.categoryName === 'Others' && it.customCategoryName
            ? it.customCategoryName
            : it.categoryName
        )
      ),
    ].join(', ');

    return (
      <Card style={styles.expenseCard} onPress={() => setSelectedExpense(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.idContainer}>
            <Text style={styles.expenseIdBadge}>{item.expenseId || 'EXP'}</Text>
            <Text style={styles.expenseDate}>{formatDate(item.expenseDate)}</Text>
          </View>
          <Text style={styles.grandTotalText}>
            ₹{(item.grandTotal || 0).toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.employeeRow}>
          <Ionicons name="person-circle-outline" size={15} color={COLORS.primary} />
          <Text style={styles.employeeName}>
            {item.employee?.employeeName || 'Staff'} ({item.employee?.employeeId})
          </Text>
        </View>

        {item.company ? (
          <View style={styles.companyRow}>
            <Ionicons name="business-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.companyText}>
              {item.company.companyName}
              {item.client ? ` • Client: ${item.client.clientName || item.client.name}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.categoriesRow}>
          <Ionicons name="pricetags-outline" size={13} color={COLORS.primary} />
          <Text style={styles.categoriesText} numberOfLines={1}>
            {categoriesList || 'General Expense'}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.itemsCountText}>
            {item.items?.length || 0} item{item.items?.length === 1 ? '' : 's'}
          </Text>
          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText}>View Full Details</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Expense Management"
        subtitle="Admin dashboard & category configuration"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.headerCategoryBtn}
            onPress={() => handleOpenCategoryEditor()}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={16} color="#FFFFFF" />
            <Text style={styles.headerCategoryBtnText}>Categories</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Metric Cards Banner */}
        {metrics ? (
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Submitted</Text>
              <Text style={styles.metricValue}>
                {metrics.totalExpensesCount ?? metrics.totalExpensesSubmitted ?? 0}
              </Text>
              <Text style={styles.metricSub}>Claims Recorded</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Expense Amount</Text>
              <Text style={styles.metricValue}>
                ₹{(metrics.totalExpensesAmount ?? metrics.totalExpenseAmount ?? 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricSub}>Cumulative Amount</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Expenses Today</Text>
              <Text style={styles.metricValue}>
                ₹{(metrics.todayExpensesAmount ?? metrics.totalExpensesTodayAmount ?? 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricSub}>
                {(metrics.todayExpensesCount ?? metrics.totalExpensesTodayCount ?? 0)} today
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Expenses This Month</Text>
              <Text style={styles.metricValue}>
                ₹{(metrics.monthExpensesAmount ?? metrics.totalExpensesThisMonthAmount ?? 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricSub}>
                {(metrics.monthExpensesCount ?? metrics.totalExpensesThisMonthCount ?? 0)} this month
              </Text>
            </View>
          </View>
        ) : null}

        {/* Filter Controls Bar */}
        <View style={styles.filterControlsRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInputField
              placeholder="Search expenses..."
              value={search}
              onChangeText={setSearch}
              leftIcon="search-outline"
              clearButtonMode="while-editing"
            />
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={hasActiveFilters ? 'funnel' : 'funnel-outline'}
              size={16}
              color={hasActiveFilters ? '#FFFFFF' : COLORS.primary}
            />
          </TouchableOpacity>

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

        {/* Active Filters Pill Bar */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
              {startDate || endDate ? (
                <View style={styles.activeFilterPill}>
                  <Ionicons name="calendar" size={12} color={COLORS.primary} />
                  <Text style={styles.activeFilterPillText}>
                    {startDate ? formatDate(startDate) : 'Start'} - {endDate ? formatDate(endDate) : 'End'}
                  </Text>
                </View>
              ) : null}

              {selectedEmployeeId ? (
                <View style={styles.activeFilterPill}>
                  <Ionicons name="person" size={12} color={COLORS.primary} />
                  <Text style={styles.activeFilterPillText}>
                    {employees.find((e) => e._id === selectedEmployeeId)?.employeeName || 'Staff'}
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

              {selectedCategoryId ? (
                <View style={styles.activeFilterPill}>
                  <Ionicons name="pricetag" size={12} color={COLORS.primary} />
                  <Text style={styles.activeFilterPillText}>
                    {categories.find((c) => c._id === selectedCategoryId)?.name || 'Category'}
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

        <ErrorMessage message={error} onRetry={fetchData} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading expense records..." />
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item) => item._id}
            renderItem={renderExpenseItem}
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
                icon="receipt-outline"
                title="No Expense Records"
                message={
                  hasActiveFilters || search
                    ? 'No expenses match your filters. Try clearing some criteria.'
                    : 'No expenses have been submitted by employees yet.'
                }
              />
            }
          />
        )}
      </View>

      {/* Details Modal (Zero Approval Workflow) */}
      <Modal
        visible={Boolean(selectedExpense)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExpense(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Expense #{selectedExpense?.expenseId}
                </Text>
                <Text style={styles.modalSub}>
                  Submitted on {selectedExpense?.createdAt ? new Date(selectedExpense.createdAt).toLocaleString('en-IN') : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedExpense(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Employee Info */}
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockLabel}>Submitted By (Employee)</Text>
                <Text style={styles.detailBlockValue}>
                  {selectedExpense?.employee?.employeeName} ({selectedExpense?.employee?.employeeId})
                </Text>
                <Text style={styles.detailBlockSub}>
                  {selectedExpense?.employee?.designation || 'Staff'} • {selectedExpense?.employee?.email}
                </Text>
              </View>

              {/* Expense Date */}
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockLabel}>Expense Date</Text>
                <Text style={styles.detailBlockValue}>
                  {selectedExpense?.expenseDate ? formatDate(selectedExpense.expenseDate) : 'N/A'}
                </Text>
              </View>

              {/* Company & Client */}
              {selectedExpense?.company ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Company & Client</Text>
                  <Text style={styles.detailBlockValue}>
                    {selectedExpense.company.companyName}
                    {selectedExpense.client
                      ? ` • Contact: ${selectedExpense.client.clientName || selectedExpense.client.name} (${selectedExpense.client.clientPhoneNumber || selectedExpense.client.phoneNumber || ''})`
                      : ''}
                  </Text>
                </View>
              ) : null}

              {/* Related Duty */}
              {selectedExpense?.relatedDuty ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Related Duty</Text>
                  <Text style={styles.detailBlockValue}>{selectedExpense.relatedDuty}</Text>
                </View>
              ) : null}

              {/* General Description */}
              {selectedExpense?.generalDescription ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>General Description</Text>
                  <Text style={styles.detailBlockDesc}>{selectedExpense.generalDescription}</Text>
                </View>
              ) : null}

              {/* All Items */}
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockLabel}>
                  Expense Items ({selectedExpense?.items?.length || 0})
                </Text>

                {selectedExpense?.items?.map((item, idx) => (
                  <View key={idx} style={styles.itemDetailCard}>
                    <View style={styles.itemDetailTop}>
                      <Text style={styles.itemDetailName}>
                        {item.categoryName === 'Others' && item.customCategoryName
                          ? `Others: ${item.customCategoryName}`
                          : item.categoryName}
                      </Text>
                      <Text style={styles.itemDetailAmount}>
                        ₹{(item.amount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {item.calculationMode === 'automatic' && item.quantity ? (
                      <Text style={styles.itemDetailCalc}>
                        Outbound: {item.outboundDistanceKm || 0} km • Return: {item.returnDistanceKm || 0} km • Total: {item.quantity} {item.unit || 'km'} @ ₹{item.appliedRate}/{item.unit || 'km'}
                      </Text>
                    ) : null}

                    {item.description ? (
                      <Text style={styles.itemDetailDesc}>{item.description}</Text>
                    ) : null}

                    {/* Attachments */}
                    {item.attachments && item.attachments.length > 0 ? (
                      <View style={styles.itemAttachContainer}>
                        <Text style={styles.itemAttachTitle}>Proof Attachments:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                          {item.attachments.map((att, aIdx) => {
                            const imgUri = typeof att === 'string' ? att : att?.url;
                            if (!imgUri) return null;
                            return (
                              <TouchableOpacity
                                key={aIdx}
                                onPress={() => {
                                  setPreviewImageUri(imgUri);
                                  setPreviewTitle(`Proof - ${item.categoryName || 'Receipt'}`);
                                  setPreviewModalVisible(true);
                                }}
                                style={styles.itemAttachThumbWrap}
                              >
                                <Image source={{ uri: imgUri }} style={styles.itemAttachThumb} />
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Grand Total */}
              <View style={styles.grandTotalBox}>
                <Text style={styles.grandTotalBoxLabel}>Grand Total</Text>
                <Text style={styles.grandTotalBoxValue}>
                  ₹{(selectedExpense?.grandTotal || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="funnel" size={18} color={COLORS.primary} />
                <Text style={styles.filterModalTitle}>Filter Expenses</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Date Range */}
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setStartDatePickerVisible(true)}
              >
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.pickerTriggerText}>
                  {startDate ? formatDate(startDate) : 'Select Start Date'}
                </Text>
                {startDate ? (
                  <TouchableOpacity onPress={() => setStartDate('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setEndDatePickerVisible(true)}
              >
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.pickerTriggerText}>
                  {endDate ? formatDate(endDate) : 'Select End Date'}
                </Text>
                {endDate ? (
                  <TouchableOpacity onPress={() => setEndDate('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              {/* Employee */}
              <Text style={styles.inputLabel}>Employee</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setEmployeeDropdownVisible(true)}
              >
                <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                <Text style={styles.pickerTriggerText}>
                  {employees.find((e) => e._id === selectedEmployeeId)?.employeeName || 'All Staff'}
                </Text>
                {selectedEmployeeId ? (
                  <TouchableOpacity onPress={() => setSelectedEmployeeId('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              {/* Company */}
              <Text style={styles.inputLabel}>Company</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setCompanyDropdownVisible(true)}
              >
                <Ionicons name="business-outline" size={16} color={COLORS.primary} />
                <Text style={styles.pickerTriggerText}>
                  {companies.find((c) => c._id === selectedCompanyId)?.companyName || 'All Companies'}
                </Text>
                {selectedCompanyId ? (
                  <TouchableOpacity onPress={() => setSelectedCompanyId('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              {/* Category */}
              <Text style={styles.inputLabel}>Expense Category</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setCategoryDropdownVisible(true)}
              >
                <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
                <Text style={styles.pickerTriggerText}>
                  {categories.find((c) => c._id === selectedCategoryId)?.name || 'All Categories'}
                </Text>
                {selectedCategoryId ? (
                  <TouchableOpacity onPress={() => setSelectedCategoryId('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <View style={styles.filterModalFooter}>
                <SecondaryButton
                  title="Clear All"
                  onPress={() => {
                    clearFilters();
                    setFilterModalVisible(false);
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <PrimaryButton
                  title="Apply Filters"
                  onPress={() => setFilterModalVisible(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Management Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingCategory ? 'Edit Category' : 'Expense Categories'}
                </Text>
                <Text style={styles.modalSub}>
                  Configure automated rates and manual expense types
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Category Form */}
              <Card style={{ backgroundColor: '#F8FAFC', marginBottom: SPACING.md }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
                  {editingCategory ? `Update "${editingCategory.name}"` : '+ Add New Category'}
                </Text>

                <TextInputField
                  label="Category Name *"
                  placeholder="e.g. Travel – Kilometer, Hotel, Toll"
                  value={catName}
                  onChangeText={setCatName}
                />

                <TextInputField
                  label="Description"
                  placeholder="Policy notes, guidelines..."
                  value={catDesc}
                  onChangeText={setCatDesc}
                />

                {/* Calculation Mode Selector */}
                <Text style={styles.inputLabel}>Calculation Mode *</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.modeSelectBtn,
                      catMode === 'manual' && styles.modeSelectBtnActive,
                    ]}
                    onPress={() => setCatMode('manual')}
                  >
                    <Text
                      style={[
                        styles.modeSelectText,
                        catMode === 'manual' && styles.modeSelectTextActive,
                      ]}
                    >
                      Manual
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeSelectBtn,
                      catMode === 'automatic' && styles.modeSelectBtnActive,
                    ]}
                    onPress={() => setCatMode('automatic')}
                  >
                    <Text
                      style={[
                        styles.modeSelectText,
                        catMode === 'automatic' && styles.modeSelectTextActive,
                      ]}
                    >
                      Automatic
                    </Text>
                  </TouchableOpacity>
                </View>

                {catMode === 'automatic' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <TextInputField
                        label="Unit *"
                        placeholder="km"
                        value={catUnit}
                        onChangeText={setCatUnit}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInputField
                        label="Rate per Unit (₹) *"
                        placeholder="3"
                        keyboardType="decimal-pad"
                        value={catRate}
                        onChangeText={setCatRate}
                      />
                    </View>
                  </View>
                )}

                {/* Status Toggle */}
                <Text style={styles.inputLabel}>Status</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      catStatus === 'active' && styles.statusToggleBtnActive,
                    ]}
                    onPress={() => setCatStatus('active')}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        catStatus === 'active' && styles.statusToggleTextActive,
                      ]}
                    >
                      Active
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      catStatus === 'inactive' && styles.statusToggleBtnInactive,
                    ]}
                    onPress={() => setCatStatus('inactive')}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        catStatus === 'inactive' && styles.statusToggleTextInactive,
                      ]}
                    >
                      Inactive
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {editingCategory && (
                    <SecondaryButton
                      title="Cancel Edit"
                      onPress={() => handleOpenCategoryEditor()}
                      style={{ flex: 1 }}
                    />
                  )}
                  <PrimaryButton
                    title={editingCategory ? 'Update Category' : 'Create Category'}
                    onPress={handleSaveCategory}
                    loading={catSaving}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>

              {/* Existing Categories List */}
              <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
                Configured Categories ({categories.length})
              </Text>

              {categories.map((cat) => (
                <View key={cat._id} style={styles.catRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.catRowName}>{cat.name}</Text>
                      <View
                        style={[
                          styles.catStatusBadge,
                          cat.status === 'active' ? styles.catStatusActive : styles.catStatusInactive,
                        ]}
                      >
                        <Text style={styles.catStatusText}>
                          {cat.status === 'active' ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.catRowMode}>
                      Mode: {cat.calculationMode === 'automatic' ? `Auto (₹${cat.ratePerUnit}/${cat.unit || 'km'})` : 'Manual'}
                    </Text>
                    {cat.description ? (
                      <Text style={styles.catRowDesc}>{cat.description}</Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.catActionBtn}
                      onPress={() => handleOpenCategoryEditor(cat)}
                    >
                      <Ionicons name="pencil" size={15} color={COLORS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.catActionBtn}
                      onPress={() => handleToggleCategoryStatus(cat)}
                    >
                      <Ionicons
                        name={cat.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={17}
                        color={cat.status === 'active' ? COLORS.warning : COLORS.success}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePickerModal
        visible={startDatePickerVisible}
        onClose={() => setStartDatePickerVisible(false)}
        selectedDate={startDate}
        onSelectDate={(d) => {
          setStartDate(d);
          setStartDatePickerVisible(false);
        }}
        title="Select Start Date"
      />
      <DatePickerModal
        visible={endDatePickerVisible}
        onClose={() => setEndDatePickerVisible(false)}
        selectedDate={endDate}
        onSelectDate={(d) => {
          setEndDate(d);
          setEndDatePickerVisible(false);
        }}
        title="Select End Date"
      />

      {/* Dropdown Pickers */}
      <DropdownPickerModal
        visible={employeeDropdownVisible}
        onClose={() => setEmployeeDropdownVisible(false)}
        items={employees.map((e) => ({
          label: `${e.employeeName} (${e.employeeId})`,
          value: e._id,
        }))}
        selectedValue={selectedEmployeeId}
        onSelect={(val) => {
          setSelectedEmployeeId(val);
          setEmployeeDropdownVisible(false);
        }}
        title="Select Employee"
        searchable
      />
      <DropdownPickerModal
        visible={companyDropdownVisible}
        onClose={() => setCompanyDropdownVisible(false)}
        items={companies.map((c) => ({
          label: c.companyName,
          value: c._id,
        }))}
        selectedValue={selectedCompanyId}
        onSelect={(val) => {
          setSelectedCompanyId(val);
          setCompanyDropdownVisible(false);
        }}
        title="Select Company"
        searchable
      />
      <DropdownPickerModal
        visible={categoryDropdownVisible}
        onClose={() => setCategoryDropdownVisible(false)}
        items={categories.map((c) => ({
          label: c.name,
          value: c._id,
        }))}
        selectedValue={selectedCategoryId}
        onSelect={(val) => {
          setSelectedCategoryId(val);
          setCategoryDropdownVisible(false);
        }}
        title="Select Category"
      />

      {/* Lightbox Preview */}
      <ImageViewerModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        imageUri={previewImageUri}
        title={previewTitle}
      />

      {/* Export Loading Modal */}
      <ExportLoadingModal visible={Boolean(exportingType)} format={exportingType || 'PDF'} />
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
  headerCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  headerCategoryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    marginRight: 4,
  },
  pdfBtn: {
    backgroundColor: COLORS.danger,
  },
  excelBtn: {
    backgroundColor: COLORS.success,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  activeFiltersBar: {
    marginBottom: SPACING.xs,
  },
  activeFiltersScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  activeFilterPillText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  clearActiveFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearActiveFiltersText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
  },
  expenseCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseIdBadge: {
    backgroundColor: '#F0F9FF',
    color: '#0369A1',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  expenseDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  grandTotalText: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.primary,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  employeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  companyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  categoriesText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  itemsCountText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '90%',
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalScroll: {
    marginBottom: SPACING.md,
  },
  detailBlock: {
    marginBottom: SPACING.md,
  },
  detailBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  detailBlockValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailBlockSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  detailBlockDesc: {
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemDetailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  itemDetailTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetailName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemDetailAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  itemDetailCalc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemDetailDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  itemAttachContainer: {
    marginTop: 6,
  },
  itemAttachTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  itemAttachThumbWrap: {
    marginRight: 8,
  },
  itemAttachThumb: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  grandTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  grandTotalBoxLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalBoxValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  filterModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    maxHeight: '80%',
    ...SHADOWS.md,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  filterModalFooter: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    marginTop: 6,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 6,
  },
  pickerTriggerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  modeSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  modeSelectBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeSelectText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modeSelectTextActive: {
    color: '#FFFFFF',
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  statusToggleBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  statusToggleBtnInactive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusToggleTextActive: {
    color: '#059669',
  },
  statusToggleTextInactive: {
    color: '#DC2626',
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  catRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  catStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catStatusActive: {
    backgroundColor: '#ECFDF5',
  },
  catStatusInactive: {
    backgroundColor: '#FEF2F2',
  },
  catStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  catRowMode: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  catRowDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  catActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

export default AdminExpensesScreen;
