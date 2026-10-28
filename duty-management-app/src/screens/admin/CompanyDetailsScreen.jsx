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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dutyApi from '../../api/dutyApi';
import clientApi from '../../api/clientApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import DatePickerModal from '../../components/DatePickerModal';
import SignatureImage from '../../components/SignatureImage';
import ExportLoadingModal from '../../components/ExportLoadingModal';
import { formatDate, formatISODateOnly, getYesterdayDateString } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportDutiesToPDF, exportDutiesToExcel } from '../../utils/exportUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { isValidPhone } from '../../utils/validators';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const CompanyDetailsScreen = ({ route, navigation }) => {
  const { company } = route.params || {};
  const today = formatISODateOnly();
  const yesterday = getYesterdayDateString();

  const [duties, setDuties] = useState([]);
  const [clients, setClients] = useState([]);
  const [activeTab, setActiveTab] = useState(company?.companyType === 'office' ? 'duties' : 'clients');
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exportingType, setExportingType] = useState(null); // 'PDF' | 'Excel' | null

  // Add / Edit Client Modal State
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');
  const [clientStatusInput, setClientStatusInput] = useState('active');
  const [clientSubmitting, setClientSubmitting] = useState(false);

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

  const fetchClients = useCallback(async () => {
    if (!company?._id) return;
    try {
      setLoadingClients(true);
      const res = await clientApi.getClientsByCompany(company._id);
      const list = res.data?.data?.clients || res.data?.clients || res.data || [];
      setClients(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load company clients:', err);
    } finally {
      setLoadingClients(false);
    }
  }, [company?._id]);

  useFocusEffect(
    useCallback(() => {
      fetchCompanyDuties();
      fetchClients();
    }, [fetchCompanyDuties, fetchClients])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompanyDuties();
    fetchClients();
  };

  const handleOpenAddClient = () => {
    setEditingClient(null);
    setClientNameInput('');
    setClientPhoneInput('');
    setClientStatusInput('active');
    setClientModalVisible(true);
  };

  const handleOpenEditClient = (client) => {
    setEditingClient(client);
    setClientNameInput(client.clientName || '');
    setClientPhoneInput(client.clientPhoneNumber || '');
    setClientStatusInput(client.status || 'active');
    setClientModalVisible(true);
  };

  const handleCloseClientModal = () => {
    if (clientSubmitting) return;
    setClientModalVisible(false);
    setEditingClient(null);
    setClientNameInput('');
    setClientPhoneInput('');
    setClientStatusInput('active');
  };

  const handleSaveClient = async () => {
    if (!clientNameInput.trim()) {
      Alert.alert('Name Required', 'Please enter a contact name for the client.');
      return;
    }
    if (clientPhoneInput.trim() && !isValidPhone(clientPhoneInput.trim())) {
      Alert.alert('Invalid Phone', 'Phone number must be exactly 10 digits.');
      return;
    }

    try {
      setClientSubmitting(true);
      if (editingClient?._id) {
        await clientApi.updateClient(editingClient._id, {
          clientName: clientNameInput.trim(),
          clientPhoneNumber: clientPhoneInput.trim(),
          status: clientStatusInput,
        });
        Alert.alert('Success', 'Client contact updated successfully!');
      } else {
        await clientApi.createClient({
          companyId: company._id,
          clientName: clientNameInput.trim(),
          clientPhoneNumber: clientPhoneInput.trim(),
        });
        Alert.alert('Success', 'Client contact added successfully!');
      }
      setClientModalVisible(false);
      setEditingClient(null);
      setClientNameInput('');
      setClientPhoneInput('');
      setClientStatusInput('active');
      fetchClients();
    } catch (err) {
      Alert.alert(
        'Error',
        extractErrorMessage(err, editingClient ? 'Failed to update client contact.' : 'Failed to add client contact.')
      );
    } finally {
      setClientSubmitting(false);
    }
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
          <View style={styles.badgeCol}>
            <StatusBadge status={company?.status} />
            <View
              style={[
                styles.typeBadgePill,
                company?.companyType === 'office'
                  ? styles.typeBadgePillOffice
                  : styles.typeBadgePillClient,
              ]}
            >
              <Ionicons
                name={company?.companyType === 'office' ? 'business' : 'storefront'}
                size={11}
                color={company?.companyType === 'office' ? '#1E40AF' : '#047857'}
              />
              <Text
                style={[
                  styles.typeBadgePillText,
                  { color: company?.companyType === 'office' ? '#1E40AF' : '#047857' },
                ]}
              >
                {company?.companyType === 'office' ? 'Office' : 'Client'}
              </Text>
            </View>
          </View>
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
          <TouchableOpacity
            style={styles.statBox}
            onPress={() => setActiveTab('clients')}
            activeOpacity={0.7}
          >
            <Text style={[styles.statNum, activeTab === 'clients' && { color: COLORS.primary }]}>
              {clients.length}
            </Text>
            <Text style={styles.statLabel}>Client Contacts</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statBox}
            onPress={() => setActiveTab('duties')}
            activeOpacity={0.7}
          >
            <Text style={[styles.statNum, activeTab === 'duties' && { color: COLORS.primary }]}>
              {duties.length}
            </Text>
            <Text style={styles.statLabel}>Total Duties</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{uniqueEmployeeNames.length}</Text>
            <Text style={styles.statLabel}>Staff Assigned</Text>
          </View>
        </View>
      </Card>

      {/* 2-Segment Switcher: Client Contacts vs Work Duties */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'clients' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('clients')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'clients' ? '#FFFFFF' : COLORS.textSecondary}
          />
          <Text
            style={[styles.segmentBtnText, activeTab === 'clients' && styles.segmentBtnTextActive]}
          >
            Client Contacts ({clients.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'duties' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('duties')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="construct"
            size={16}
            color={activeTab === 'duties' ? '#FFFFFF' : COLORS.textSecondary}
          />
          <Text
            style={[styles.segmentBtnText, activeTab === 'duties' && styles.segmentBtnTextActive]}
          >
            Work Duties ({duties.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'clients' ? (
        <View style={styles.clientsHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeading}>
              Registered Client Contacts ({clients.length})
            </Text>
            <Text style={styles.sectionSubHeading}>
              Authorized client representatives for service sign-offs
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addClientBtn}
            onPress={handleOpenAddClient}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addClientBtnText}>Add Client</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Date Filters & Export Action Toolbar */}
          <Card style={styles.toolbarCard}>
            <View style={styles.toolbarTitleRow}>
              <Text style={styles.toolbarTitle}>Filter & Export Records</Text>
              {Boolean(startDate || endDate) ? (
                <TouchableOpacity
                  onPress={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  <Text style={styles.clearDateLink}>Reset (Show All)</Text>
                </TouchableOpacity>
              ) : null}
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
        </>
      )}
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
              ID: {item.employee?.employeeId || 'N/A'} • {formatWorkType(item)}
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

  const renderClientItem = ({ item }) => {
    return (
      <Card style={styles.clientCard}>
        <View style={styles.clientCardRow}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>
              {(item.clientName || 'C').substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.clientNameText} numberOfLines={1}>
                {item.clientName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.clientStatusBadge,
                    item.status === 'active' ? styles.clientActiveBadge : styles.clientInactiveBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.clientStatusText,
                      item.status === 'active' ? styles.clientActiveText : styles.clientInactiveText,
                    ]}
                  >
                    {item.status ? item.status.toUpperCase() : 'ACTIVE'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.clientEditChip}
                  onPress={() => handleOpenEditClient(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="create-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.clientEditChipText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.clientPhoneRow}>
              <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.clientPhoneText}>
                {item.clientPhoneNumber || 'No phone recorded'}
              </Text>
            </View>
          </View>
        </View>

        {Boolean(item.clientPhoneNumber) && (
          <View style={styles.clientActionRow}>
            <TouchableOpacity
              style={styles.clientCallBtn}
              onPress={() => Linking.openURL(`tel:${item.clientPhoneNumber}`).catch(() => {})}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={14} color="#FFFFFF" />
              <Text style={styles.clientCallBtnText}>Call Client</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clientWhatsappBtn}
              onPress={() => {
                const cleanPhone = item.clientPhoneNumber.replace(/[^0-9]/g, '');
                const formatted = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                Linking.openURL(`whatsapp://send?phone=${formatted}`).catch(() => {
                  Linking.openURL(`sms:${item.clientPhoneNumber}`);
                });
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#059669" />
              <Text style={styles.clientWhatsappBtnText}>WhatsApp / SMS</Text>
            </TouchableOpacity>
          </View>
        )}
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
          <LoadingIndicator message="Loading company details..." />
        ) : (
          <FlatList
            data={activeTab === 'clients' ? clients : duties}
            keyExtractor={(item) => item._id}
            renderItem={activeTab === 'clients' ? renderClientItem : renderDutyItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              activeTab === 'clients' ? (
                loadingClients ? (
                  <LoadingIndicator message="Loading client contacts..." />
                ) : (
                  <EmptyState
                    title="No Client Contacts Registered"
                    description={`No client contacts have been registered for ${company?.companyName || 'this company'} yet.`}
                    actionLabel="+ Add Client Contact"
                    onAction={handleOpenAddClient}
                  />
                )
              ) : (
                <EmptyState
                  title="No Duties Recorded"
                  description="No duty reports have been logged for this company yet."
                />
              )
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

      {/* Add / Edit Client Contact Modal */}
      <Modal
        visible={clientModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseClientModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.clientModalContainer}>
            <View style={styles.clientModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.clientModalIconWrap}>
                  <Ionicons
                    name={editingClient ? 'create-outline' : 'person-add'}
                    size={18}
                    color={COLORS.primary}
                  />
                </View>
                <View>
                  <Text style={styles.clientModalTitle}>
                    {editingClient ? 'Edit Client Contact' : 'Add Client Contact'}
                  </Text>
                  <Text style={styles.clientModalSubtitle}>
                    {editingClient
                      ? `Modify contact details for ${company?.companyName}`
                      : `Link a contact person to ${company?.companyName}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleCloseClientModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.clientModalBody}>
              <Text style={styles.inputLabel}>Contact Person Name *</Text>
              <TextInputField
                placeholder="e.g. Ramesh Kumar, Plant Manager"
                value={clientNameInput}
                onChangeText={setClientNameInput}
                autoCapitalize="words"
              />

              <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>
                Phone Number (10 digits)
              </Text>
              <TextInputField
                placeholder="e.g. 9876543210"
                value={clientPhoneInput}
                onChangeText={setClientPhoneInput}
                keyboardType="phone-pad"
                maxLength={10}
              />

              {Boolean(editingClient) && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>Contact Status</Text>
                  <View style={styles.statusToggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.statusToggleBtn,
                        clientStatusInput === 'active' && styles.statusToggleActiveBtn,
                      ]}
                      onPress={() => setClientStatusInput('active')}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color={clientStatusInput === 'active' ? '#059669' : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.statusToggleText,
                          clientStatusInput === 'active' && styles.statusToggleActiveText,
                        ]}
                      >
                        Active
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.statusToggleBtn,
                        clientStatusInput === 'inactive' && styles.statusToggleInactiveBtn,
                      ]}
                      onPress={() => setClientStatusInput('inactive')}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={15}
                        color={clientStatusInput === 'inactive' ? '#DC2626' : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.statusToggleText,
                          clientStatusInput === 'inactive' && styles.statusToggleInactiveText,
                        ]}
                      >
                        Inactive
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.clientModalActions}>
                <PrimaryButton
                  title={
                    clientSubmitting
                      ? (editingClient ? 'Updating...' : 'Adding...')
                      : (editingClient ? 'Update Client Contact' : 'Save Client Contact')
                  }
                  onPress={handleSaveClient}
                  loading={clientSubmitting}
                  disabled={clientSubmitting || !clientNameInput.trim()}
                  leftIcon="checkmark-circle-outline"
                />
                <TouchableOpacity
                  style={styles.clientModalCancelBtn}
                  onPress={handleCloseClientModal}
                  disabled={clientSubmitting}
                >
                  <Text style={styles.clientModalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  badgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  typeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
  },
  typeBadgePillOffice: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  typeBadgePillClient: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  typeBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Segment Switcher
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.xs,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Clients section header
  clientsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
    gap: 8,
  },
  sectionSubHeading: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginLeft: 4,
  },
  addClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    gap: 4,
    ...SHADOWS.xs,
  },
  addClientBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Client cards
  clientCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  clientCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  clientAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  clientNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  clientStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginLeft: 6,
  },
  clientActiveBadge: {
    backgroundColor: '#ECFDF5',
  },
  clientInactiveBadge: {
    backgroundColor: '#F3F4F6',
  },
  clientStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clientActiveText: {
    color: '#059669',
  },
  clientInactiveText: {
    color: '#6B7280',
  },
  clientEditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  clientEditChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  clientPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  clientPhoneText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  clientActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  clientCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  clientCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clientWhatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  clientWhatsappBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  clientModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  clientModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: SPACING.md,
  },
  clientModalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  clientModalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  clientModalBody: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggleActiveBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusToggleInactiveBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusToggleActiveText: {
    color: '#059669',
    fontWeight: '700',
  },
  statusToggleInactiveText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  clientModalActions: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  clientModalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  clientModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

export default CompanyDetailsScreen;
