import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dutyApi from '../../api/dutyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import DatePickerModal from '../../components/DatePickerModal';
import SignatureImage from '../../components/SignatureImage';
import ExportLoadingModal from '../../components/ExportLoadingModal';
import { formatDate, formatISODateOnly, getYesterdayDateString } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportDutiesToPDF, exportDutiesToExcel } from '../../utils/exportUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const CompanyDetailsScreen = ({ route, navigation }) => {
  const { company } = route.params || {};
  const today = formatISODateOnly();
  const yesterday = getYesterdayDateString();

  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exportingType, setExportingType] = useState(null); // 'PDF' | 'Excel' | null

  // Date filters (Default: '' to show all duties for this specific company)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pickers visibility
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [singleDatePickerVisible, setSingleDatePickerVisible] = useState(false);

  // Selected duty modal for full view
  const [selectedDuty, setSelectedDuty] = useState(null);

  const fetchCompanyDuties = useCallback(async () => {
    if (!company?._id) return;
    try {
      setError('');
      const params = {
        companyId: company._id,
        limit: 500,
      };
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await dutyApi.getAllDuties(params);
      if (res.data?.duties) {
        setDuties(res.data.duties);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load company duties'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?._id, startDate, endDate]);

  useEffect(() => {
    fetchCompanyDuties();
  }, [fetchCompanyDuties]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompanyDuties();
  };

  const handleExportPDF = async () => {
    const filterInfo =
      startDate || endDate
        ? `From ${startDate || 'Start'} to ${endDate || 'Present'}`
        : 'All Company Records';

    try {
      setExportingType('PDF');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportDutiesToPDF({
        title: `${company.companyName} - Duty Report`,
        subtitle: `Company Service History • ${company.location || 'Site Records'}`,
        duties,
        filterInfo,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExcel = async () => {
    const safeName = (company?.companyName || 'Company').replace(/\s+/g, '_');
    try {
      setExportingType('Excel');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportDutiesToExcel({
        filename: `${safeName}_Duties`,
        duties,
      });
    } finally {
      setExportingType(null);
    }
  };

  // Distinct employees who worked at this company
  const uniqueEmployeeNames = Array.from(
    new Set(duties.map((d) => d.employee?.employeeName).filter(Boolean))
  );

  const renderHeader = () => (
    <View>
      {/* Company Profile Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="business" size={26} color={COLORS.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.companyName}>{company?.companyName}</Text>
            <Text style={styles.companyLocation}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />{' '}
              {company?.location}
            </Text>
          </View>
          <StatusBadge status={company?.status} />
        </View>

        <View style={styles.profileDetailsRow}>
          <Text style={styles.phoneText}>
            <Ionicons name="call-outline" size={14} color={COLORS.textSecondary} />{' '}
            {company?.companyPhoneNumber || 'No phone'}
          </Text>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('CompanyForm', { company })}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{duties.length}</Text>
            <Text style={styles.statLabel}>Total Duties</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{uniqueEmployeeNames.length}</Text>
            <Text style={styles.statLabel}>Staff Assigned</Text>
          </View>
        </View>
      </Card>

      {/* Date Filters & Export Action Toolbar */}
      <Card style={styles.toolbarCard}>
        <View style={styles.toolbarTitleRow}>
          <Text style={styles.toolbarTitle}>Filter & Export Records</Text>
          {(startDate || endDate) && (
            <TouchableOpacity
              onPress={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              <Text style={styles.clearDateLink}>Reset (Show All)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Quick Presets */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetChipsScroll}
          contentContainerStyle={styles.presetChipsRow}
        >
          <TouchableOpacity
            style={[styles.presetChip, (!startDate && !endDate) && styles.presetChipActive]}
            onPress={() => {
              setStartDate('');
              setEndDate('');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetChipText, (!startDate && !endDate) && styles.presetChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, (startDate === today && endDate === today) && styles.presetChipActive]}
            onPress={() => {
              setStartDate(today);
              setEndDate(today);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetChipText, (startDate === today && endDate === today) && styles.presetChipTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetChip, (startDate === yesterday && endDate === yesterday) && styles.presetChipActive]}
            onPress={() => {
              setStartDate(yesterday);
              setEndDate(yesterday);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetChipText, (startDate === yesterday && endDate === yesterday) && styles.presetChipTextActive]}>
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetChip,
              (startDate && startDate === endDate && startDate !== today && startDate !== yesterday) && styles.presetChipActive,
            ]}
            onPress={() => setSingleDatePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={(startDate && startDate === endDate && startDate !== today && startDate !== yesterday) ? '#FFFFFF' : COLORS.primary}
            />
            <Text
              style={[
                styles.presetChipText,
                (startDate && startDate === endDate && startDate !== today && startDate !== yesterday) && styles.presetChipTextActive,
              ]}
            >
              {startDate && startDate === endDate && startDate !== today && startDate !== yesterday
                ? formatDate(startDate)
                : 'Single Date'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetChip,
              ((startDate || endDate) && startDate !== endDate) && styles.presetChipActive,
            ]}
            onPress={() => setStartDatePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={((startDate || endDate) && startDate !== endDate) ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.presetChipText,
                ((startDate || endDate) && startDate !== endDate) && styles.presetChipTextActive,
              ]}
            >
              Custom Range
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.dateFilterRow}>
          <View style={{ flex: 1, marginRight: SPACING.xs }}>
            <Text style={styles.filterFieldLabel}>From Date</Text>
            <TouchableOpacity
              style={styles.datePickerTrigger}
              onPress={() => setStartDatePickerVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.datePickerTriggerText}>{startDate || 'Start Date (All)'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: SPACING.xs }}>
            <Text style={styles.filterFieldLabel}>To Date</Text>
            <TouchableOpacity
              style={styles.datePickerTrigger}
              onPress={() => setEndDatePickerVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.datePickerTriggerText}>{endDate || 'To Date (All)'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Export Buttons */}
        <View style={styles.exportButtonsRow}>
          <TouchableOpacity
            style={[styles.exportBtn, styles.pdfBtn]}
            onPress={handleExportPDF}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={18} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, styles.excelBtn]}
            onPress={handleExportExcel}
            activeOpacity={0.8}
          >
            <Ionicons name="grid" size={18} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export Excel</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Text style={styles.sectionHeading}>
        Service Duties ({duties.length})
      </Text>
    </View>
  );

  const renderDutyItem = ({ item }) => {
    const proofPhotos = Array.isArray(item.customerProofPhotos) ? item.customerProofPhotos : [];
    const signatureUrl = item.customerSignature?.url;

    return (
      <Card style={styles.dutyCard}>
        <View style={styles.dutyHeader}>
          <View style={styles.dutyEmpInfo}>
            <Text style={styles.empName}>
              {item.employee?.employeeName || 'Staff'}
            </Text>
            <Text style={styles.empId}>
              ID: {item.employee?.employeeId || 'N/A'} • {item.workType || 'Service'}
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
            <Text style={styles.dateBadgeText}>{formatDate(item.dutyDate)}</Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.dutyDetailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Machine:</Text>
            <Text style={styles.detailValue}>{item.machineName || 'N/A'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Working Hours:</Text>
            <Text style={styles.detailValue}>
              {item.inTime || 'N/A'} - {item.outTime || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Customer Contact:</Text>
            <Text style={styles.detailValue}>
              {item.customerName || 'N/A'} ({item.customerPhoneNumber || 'N/A'})
            </Text>
          </View>
          {item.location?.latitude ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>GPS Coordinates:</Text>
              <View style={styles.gpsRow}>
                <Text style={styles.detailValue}>
                  {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                </Text>
                <TouchableOpacity
                  style={styles.openMapChip}
                  onPress={() => {
                    const lat = item.location.latitude;
                    const lng = item.location.longitude;
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {
                      Alert.alert('Map Error', 'Unable to open maps application');
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="map-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.openMapChipText}>View Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Work Description */}
        <View style={styles.descBox}>
          <Text style={styles.descTitle}>Work Description:</Text>
          <Text style={styles.descText}>{item.workDescription || 'No description provided'}</Text>
        </View>

        {/* Media row: Signature & Photos */}
        <View style={styles.mediaRow}>
          {signatureUrl ? (
            <View style={styles.mediaThumbBlock}>
              <Text style={styles.mediaLabel}>Signature</Text>
              <SignatureImage uri={signatureUrl} height={70} width={70} />
            </View>
          ) : null}

          {proofPhotos.length > 0 ? (
            <View style={styles.mediaThumbBlock}>
              <Text style={styles.mediaLabel}>Photos ({proofPhotos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {proofPhotos.map((p, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: p.url }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={company?.companyName || 'Company Details'}
        subtitle="Duties, Staff & Export Records"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <ErrorMessage message={error} onRetry={fetchCompanyDuties} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading company duty history..." />
        ) : (
          <FlatList
            data={duties}
            keyExtractor={(item) => item._id}
            renderItem={renderDutyItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <EmptyState
                title="No Duties Recorded"
                description="No duty reports have been logged for this company yet."
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Date Pickers */}
      <DatePickerModal
        visible={startDatePickerVisible}
        onClose={() => setStartDatePickerVisible(false)}
        selectedDate={startDate}
        onSelectDate={(date) => setStartDate(date)}
        title="Select From Date"
      />

      <DatePickerModal
        visible={endDatePickerVisible}
        onClose={() => setEndDatePickerVisible(false)}
        selectedDate={endDate}
        onSelectDate={(date) => setEndDate(date)}
        title="Select To Date"
      />

      <DatePickerModal
        visible={singleDatePickerVisible}
        onClose={() => setSingleDatePickerVisible(false)}
        selectedDate={startDate || today}
        onSelectDate={(date) => {
          setStartDate(date);
          setEndDate(date);
        }}
        title="Select Single Date"
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
  },
  listContent: {
    padding: SPACING.md,
  },
  profileCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  profileInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  companyLocation: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: SPACING.xs,
    marginTop: SPACING.xs,
  },
  phoneText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySubtle,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  toolbarCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  toolbarTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  toolbarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  clearDateLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  presetChipsScroll: {
    marginBottom: SPACING.sm,
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  filterFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
  },
  datePickerTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  openMapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  openMapChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
    ...SHADOWS.sm,
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
    fontSize: 13,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  dutyCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  dutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  dutyEmpInfo: {
    flex: 1,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  empId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  dutyDetailsGrid: {
    gap: 4,
    marginVertical: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 110,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  descBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    marginTop: 6,
    marginBottom: 6,
  },
  descTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  descText: {
    fontSize: 12,
    color: COLORS.text,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  mediaThumbBlock: {
    gap: 4,
  },
  mediaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  signatureThumb: {
    width: 100,
    height: 45,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

export default CompanyDetailsScreen;
