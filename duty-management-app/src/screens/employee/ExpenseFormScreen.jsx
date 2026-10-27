import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import expenseApi from '../../api/expenseApi';
import companyApi from '../../api/companyApi';
import clientApi from '../../api/clientApi';
import dutyApi from '../../api/dutyApi';
import uploadApi from '../../api/uploadApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import ImageViewerModal from '../../components/ImageViewerModal';
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

// Helper to determine if a company represents internal office
const isOfficeCompany = (c) => {
  if (!c) return false;
  const type = String(c.companyType || '').trim().toLowerCase();
  const name = String(c.companyName || '').trim().toLowerCase();
  return type === 'office' || name.includes('office');
};

// Helper to format date nicely as "Oct 3"
const formatDutyShortDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Safe helper to extract arrays from various response shapes
const extractArray = (res, key) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res[key])) return res[key];
  if (res.data && Array.isArray(res.data[key])) return res.data[key];
  if (res.data?.data && Array.isArray(res.data.data[key])) return res.data.data[key];
  if (Array.isArray(res.data)) return res.data;
  return [];
};

const createEmptyItem = (defaultCategory) => ({
  id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
  categoryId: defaultCategory?._id || '',
  categoryName: defaultCategory?.name || '',
  calculationMode: defaultCategory?.calculationMode || 'manual',
  ratePerUnit: defaultCategory?.ratePerUnit || 0,
  unit: defaultCategory?.unit || '',
  customCategoryName: '',
  outboundDistanceKm: '',
  returnDistanceKm: '',
  totalQuantity: '',
  amount: '',
  description: '',
  localAttachments: [],
  uploadedAttachments: [],
});

export const ExpenseFormScreen = ({ navigation, route }) => {
  const routeDuty = route?.params?.duty || route?.params?.dutyToEdit;

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown options
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [duties, setDuties] = useState([]);

  // Company Category: 'office' (Internal Office) vs 'client' (Client Company)
  const [companyCategory, setCompanyCategory] = useState(() => {
    if (routeDuty) {
      return routeDuty.dutyType === 'office' ? 'office' : 'client';
    }
    return 'client';
  });

  // Form Fields - Basic Details
  const [expenseDate, setExpenseDate] = useState(() => {
    if (routeDuty?.dutyDate) {
      return formatISODateOnly(routeDuty.dutyDate);
    }
    return formatISODateOnly();
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    return routeDuty?.company?._id || routeDuty?.company || '';
  });
  const [selectedClientId, setSelectedClientId] = useState(() => {
    return routeDuty?.client?._id || routeDuty?.client || '';
  });
  const [selectedDutyId, setSelectedDutyId] = useState(() => {
    return routeDuty?._id || '';
  });
  const [relatedDutyId, setRelatedDutyId] = useState(() => {
    return routeDuty?.dutyId || routeDuty?._id || '';
  });
  const [generalDescription, setGeneralDescription] = useState('');

  // Form Fields - Dynamic Items
  const [items, setItems] = useState([]);

  // Modals
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [companyPickerVisible, setCompanyPickerVisible] = useState(false);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [dutyPickerVisible, setDutyPickerVisible] = useState(false);
  const [activeCategoryPickerIndex, setActiveCategoryPickerIndex] = useState(null);

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 1. Load Categories, Companies & Duties on mount
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoadingInitial(true);
        setError('');
        const [catsRes, compsRes, dutiesRes] = await Promise.all([
          expenseApi.getCategories().catch(() => null),
          companyApi.getCompanies({ status: 'active', limit: 200 }).catch(() => null),
          dutyApi.getMyDuties({ limit: 100 }).catch(() => null),
        ]);

        if (!isMounted) return;

        const activeCats = extractArray(catsRes, 'categories').filter(
          (c) => c.status === 'active'
        );
        const allComps = extractArray(compsRes, 'companies');
        const allDuties = extractArray(dutiesRes, 'duties');

        setCategories(activeCats);
        setCompanies(allComps);
        setDuties(allDuties);

        // Pre-select office company if in office mode and not set
        if (companyCategory === 'office' && !selectedCompanyId) {
          const defaultOffice = allComps.find(isOfficeCompany);
          if (defaultOffice) {
            setSelectedCompanyId(defaultOffice._id);
          }
        }

        // Initialize with default item if empty
        const defaultCat =
          activeCats.find((c) => c.name === 'Travel – Kilometer') || activeCats[0];
        setItems([createEmptyItem(defaultCat)]);
      } catch (err) {
        if (isMounted) {
          setError(extractErrorMessage(err, 'Failed to load initial expense settings'));
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. When selected company or companyCategory changes, fetch filtered clients
  useEffect(() => {
    if (!selectedCompanyId || companyCategory === 'office') {
      setClients([]);
      if (companyCategory === 'office') {
        setSelectedClientId('');
      }
      return;
    }

    let isMounted = true;
    const fetchClients = async () => {
      try {
        const res = await clientApi.getClientsByCompany(selectedCompanyId);
        if (isMounted) {
          const clientList = extractArray(res, 'clients');
          setClients(clientList);

          // Reset selected client if not belonging to this company
          if (selectedClientId && !clientList.some((c) => c._id === selectedClientId)) {
            setSelectedClientId('');
          }
        }
      } catch (err) {
        if (isMounted) {
          setClients([]);
        }
      }
    };

    fetchClients();
    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId, companyCategory]);

  // Handle duty selection from the dropdown with date like "Oct 3"
  const handleSelectDuty = (dutyId) => {
    const duty = duties.find((d) => d._id === dutyId);
    if (!duty) return;

    setSelectedDutyId(duty._id);
    setRelatedDutyId(duty.dutyId || duty._id);

    // Sync expense date to duty date if available
    if (duty.dutyDate) {
      setExpenseDate(formatISODateOnly(duty.dutyDate));
    }

    // Determine category based on duty
    const isOffice =
      duty.dutyType === 'office' || (duty.company && isOfficeCompany(duty.company));
    setCompanyCategory(isOffice ? 'office' : 'client');

    // Auto-select company
    if (duty.company) {
      const compId = duty.company._id || duty.company;
      setSelectedCompanyId(compId);
    }

    // Auto-select client if client duty
    if (duty.client) {
      const cliId = duty.client._id || duty.client;
      setSelectedClientId(cliId);
    } else {
      setSelectedClientId('');
    }
  };

  // Clear selected duty
  const handleClearDuty = () => {
    setSelectedDutyId('');
    setRelatedDutyId('');
  };

  // Handle Category selection for a specific item
  const handleSelectCategory = (itemIndex, category) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      const item = { ...updated[itemIndex] };
      item.categoryId = category._id;
      item.categoryName = category.name;
      item.calculationMode = category.calculationMode;
      item.ratePerUnit = category.ratePerUnit || 0;
      item.unit = category.unit || '';
      item.customCategoryName = '';

      if (category.calculationMode === 'automatic') {
        const outbound = parseFloat(item.outboundDistanceKm) || 0;
        const ret = parseFloat(item.returnDistanceKm) || 0;
        const total = outbound + ret;
        item.totalQuantity = total ? String(total) : '';
        item.amount = total ? String(Math.round(total * (category.ratePerUnit || 0))) : '';
      } else {
        item.outboundDistanceKm = '';
        item.returnDistanceKm = '';
        item.totalQuantity = '';
        item.amount = '';
      }

      updated[itemIndex] = item;
      return updated;
    });
    setActiveCategoryPickerIndex(null);
  };

  // Handle distance changes for automatic category
  const handleDistanceChange = (itemIndex, field, value) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      const item = { ...updated[itemIndex] };
      item[field] = value;

      const outbound =
        field === 'outboundDistanceKm'
          ? parseFloat(value) || 0
          : parseFloat(item.outboundDistanceKm) || 0;
      const ret =
        field === 'returnDistanceKm'
          ? parseFloat(value) || 0
          : parseFloat(item.returnDistanceKm) || 0;
      const total = outbound + ret;

      item.totalQuantity = total > 0 ? String(total) : '';
      const rate = item.ratePerUnit || 0;
      item.amount = total > 0 ? String(Math.round(total * rate)) : '';

      updated[itemIndex] = item;
      return updated;
    });
  };

  // Handle generic field changes
  const handleItemFieldChange = (itemIndex, field, value) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      updated[itemIndex] = {
        ...updated[itemIndex],
        [field]: value,
      };
      return updated;
    });
  };

  // Add Item
  const handleAddItem = () => {
    const defaultCat = categories.find((c) => c.name === 'Food') || categories[0];
    setItems((prev) => [...prev, createEmptyItem(defaultCat)]);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      Alert.alert('Cannot Remove', 'An expense must contain at least one item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Attach Proof Photo for item
  const handleAddAttachment = (itemIndex) => {
    Alert.alert('Attach Proof Document / Photo', 'Choose attachment source:', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          if (!result.canceled && result.assets && result.assets[0]) {
            setItems((prev) => {
              const updated = [...prev];
              updated[itemIndex].localAttachments = [
                ...updated[itemIndex].localAttachments,
                result.assets[0].uri,
              ];
              return updated;
            });
          }
        },
      },
      {
        text: 'Photo Gallery / File',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery permission is required.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsMultipleSelection: true,
          });
          if (!result.canceled && result.assets) {
            const newUris = result.assets.map((a) => a.uri);
            setItems((prev) => {
              const updated = [...prev];
              updated[itemIndex].localAttachments = [
                ...updated[itemIndex].localAttachments,
                ...newUris,
              ];
              return updated;
            });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemoveAttachment = (itemIndex, attachIndex) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[itemIndex].localAttachments = updated[itemIndex].localAttachments.filter(
        (_, i) => i !== attachIndex
      );
      return updated;
    });
  };

  // Grand Total calculation
  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const amt = parseFloat(item.amount) || 0;
      return sum + amt;
    }, 0);
  }, [items]);

  // Filtered companies based on category
  const filteredCompanies = useMemo(() => {
    if (companyCategory === 'office') {
      const offices = companies.filter((c) => isOfficeCompany(c));
      return offices.length > 0 ? offices : companies;
    }
    const clientsList = companies.filter((c) => !isOfficeCompany(c));
    return clientsList.length > 0 ? clientsList : companies;
  }, [companies, companyCategory]);

  const selectedCompanyObj = companies.find((c) => c._id === selectedCompanyId);
  const selectedClientObj = clients.find((c) => c._id === selectedClientId);
  const selectedDutyObj = duties.find((d) => d._id === selectedDutyId);

  // Validation & Submission
  const handleSubmit = async () => {
    if (submitting) return;

    // 1. Company & Client category validation rules
    if (companyCategory === 'office') {
      if (!selectedCompanyId) {
        Alert.alert('Office Required', 'Please select the Office location/company.');
        return;
      }
      // Note: In office mode, client is NOT required (no client for internal office)
    } else {
      // Client Company mode: Both Company and Client are strictly required!
      if (!selectedCompanyId) {
        Alert.alert('Company Required', 'Please select a Client Company.');
        return;
      }
      if (!selectedClientId) {
        Alert.alert('Client Contact Required', 'Please select a Client Contact Person.');
        return;
      }
    }

    // 2. Validate Items
    if (!items.length) {
      Alert.alert('Validation Error', 'Please add at least one expense item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNum = i + 1;

      if (!item.categoryId) {
        Alert.alert('Validation Error', `Item #${itemNum}: Please select a category.`);
        return;
      }

      if (item.categoryName === 'Others' && !item.customCategoryName?.trim()) {
        Alert.alert(
          'Validation Error',
          `Item #${itemNum}: Please specify the custom expense name for Others.`
        );
        return;
      }

      if (item.calculationMode === 'automatic') {
        const outbound = parseFloat(item.outboundDistanceKm);
        const ret = parseFloat(item.returnDistanceKm);
        if (isNaN(outbound) || outbound < 0) {
          Alert.alert('Validation Error', `Item #${itemNum}: Please enter a valid outbound distance.`);
          return;
        }
        if (isNaN(ret) || ret < 0) {
          Alert.alert('Validation Error', `Item #${itemNum}: Please enter a valid return distance.`);
          return;
        }
        if (outbound + ret <= 0) {
          Alert.alert('Validation Error', `Item #${itemNum}: Total distance must be greater than 0.`);
          return;
        }
      }

      const amount = parseFloat(item.amount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Validation Error', `Item #${itemNum}: Amount must be greater than ₹0.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');

      // Step 1: Upload attachments per item if any
      const preparedItems = [];
      for (const item of items) {
        let uploadedAttachments = [...(item.uploadedAttachments || [])];

        if (item.localAttachments && item.localAttachments.length > 0) {
          const uploadRes = await uploadApi.uploadProofPhotos(item.localAttachments);
          if (uploadRes.success && uploadRes.photos) {
            uploadedAttachments = [
              ...uploadedAttachments,
              ...uploadRes.photos.map((p) => ({
                url: p.url,
                originalName: p.originalName || 'receipt.jpg',
                size: p.size || 0,
              })),
            ];
          }
        }

        const outbound = parseFloat(item.outboundDistanceKm) || 0;
        const ret = parseFloat(item.returnDistanceKm) || 0;
        const totalDist = outbound + ret;

        preparedItems.push({
          category: item.categoryId,
          categoryName: item.categoryName,
          customCategoryName: item.customCategoryName?.trim() || undefined,
          customTitle: item.customCategoryName?.trim() || undefined,
          calculationMode: item.calculationMode,
          unit: item.unit || undefined,
          appliedRate: item.ratePerUnit || undefined,
          ratePerUnit: item.ratePerUnit || undefined,
          outboundDistanceKm: item.calculationMode === 'automatic' ? outbound : undefined,
          returnDistanceKm: item.calculationMode === 'automatic' ? ret : undefined,
          outboundDistance: item.calculationMode === 'automatic' ? outbound : undefined,
          returnDistance: item.calculationMode === 'automatic' ? ret : undefined,
          totalDistance: item.calculationMode === 'automatic' ? totalDist : undefined,
          quantity: item.calculationMode === 'automatic' ? totalDist : undefined,
          amount: Math.round(parseFloat(item.amount)),
          description: item.description?.trim() || undefined,
          attachments: uploadedAttachments,
        });
      }

      // Step 2: Submit Expense payload
      const payload = {
        expenseDate,
        company: selectedCompanyId,
        companyId: selectedCompanyId,
        client: companyCategory === 'client' ? (selectedClientId || undefined) : undefined,
        clientId: companyCategory === 'client' ? (selectedClientId || undefined) : undefined,
        relatedDuty: selectedDutyObj?.dutyId || relatedDutyId?.trim() || undefined,
        duty: selectedDutyObj?._id || undefined,
        dutyId: selectedDutyObj?._id || undefined,
        generalDescription: generalDescription?.trim() || undefined,
        items: preparedItems,
      };

      const res = await expenseApi.createExpense(payload);
      const expenseObj = res.data?.expense || res.data?.data?.expense || res.expense;
      const expenseCode = expenseObj?.expenseId || '';

      Alert.alert(
        'Expense Submitted',
        `Your expense claim ${expenseCode ? `#${expenseCode} ` : ''}for ₹${grandTotal.toLocaleString('en-IN')} has been submitted successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('EmployeeMainTabs', { screen: 'ExpensesTab' });
              }
            },
          },
        ]
      );
    } catch (submitErr) {
      const msg = extractErrorMessage(submitErr, 'Failed to submit expense claim');
      setError(msg);
      Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Add Expense" onBack={() => navigation.goBack()} />
        <LoadingIndicator message="Loading expense configuration..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Add Expense"
        subtitle="Log employee travel, food, and project expenses"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ErrorMessage message={error} />

        {/* 1. Basic Details Card */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Basic Expense Details</Text>
          </View>

          {/* Expense Date */}
          <Text style={styles.inputLabel}>Expense Date *</Text>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => setDatePickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.pickerTriggerText}>{formatDate(expenseDate)}</Text>
          </TouchableOpacity>

          {/* Related Work / Duty (Dropdown with Dates e.g. "Oct 3") */}
          <Text style={styles.inputLabel}>Related Work / Duty (Optional)</Text>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => setDutyPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="briefcase-outline" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              {selectedDutyObj ? (
                <View>
                  <Text style={styles.pickerTriggerText} numberOfLines={1}>
                    {formatDutyShortDate(selectedDutyObj.dutyDate)} • {selectedDutyObj.dutyId || 'Work'} -{' '}
                    {selectedDutyObj.machineName || selectedDutyObj.workType || 'Duty'}
                  </Text>
                  <Text style={styles.pickerSubText} numberOfLines={1}>
                    {selectedDutyObj.company?.companyName ||
                      (selectedDutyObj.dutyType === 'office' ? 'Office' : 'Company')}{' '}
                    • {selectedDutyObj.customerName || 'General'}
                  </Text>
                </View>
              ) : relatedDutyId ? (
                <Text style={styles.pickerTriggerText} numberOfLines={1}>
                  Duty ID: {relatedDutyId}
                </Text>
              ) : (
                <Text style={[styles.pickerTriggerText, styles.pickerPlaceholder]}>
                  Select from your duties (e.g. Oct 3) or leave blank
                </Text>
              )}
            </View>
            {selectedDutyObj || relatedDutyId ? (
              <TouchableOpacity
                onPress={handleClearDuty}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Category Toggle: Office vs Client Company */}
          <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>
            Company Category *
          </Text>
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.typePill,
                companyCategory === 'office' && styles.typePillActive,
              ]}
              onPress={() => {
                setCompanyCategory('office');
                const defaultOffice = companies.find(isOfficeCompany);
                if (defaultOffice) {
                  setSelectedCompanyId(defaultOffice._id);
                }
                setSelectedClientId('');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="business"
                size={16}
                color={companyCategory === 'office' ? '#FFFFFF' : COLORS.primary}
              />
              <Text
                style={[
                  styles.typePillText,
                  companyCategory === 'office' && styles.typePillTextActive,
                ]}
              >
                Internal Office
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typePill,
                companyCategory === 'client' && styles.typePillActive,
              ]}
              onPress={() => {
                setCompanyCategory('client');
                const current = companies.find((c) => c._id === selectedCompanyId);
                if (!current || isOfficeCompany(current)) {
                  setSelectedCompanyId('');
                  setSelectedClientId('');
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="storefront"
                size={16}
                color={companyCategory === 'client' ? '#FFFFFF' : COLORS.primary}
              />
              <Text
                style={[
                  styles.typePillText,
                  companyCategory === 'client' && styles.typePillTextActive,
                ]}
              >
                Client Company
              </Text>
            </TouchableOpacity>
          </View>

          {/* Company Picker */}
          <Text style={styles.inputLabel}>
            {companyCategory === 'office' ? 'Office Location / Company *' : 'Client Company *'}
          </Text>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => setCompanyPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={companyCategory === 'office' ? 'business-outline' : 'storefront-outline'}
              size={18}
              color={COLORS.primary}
            />
            <Text
              style={[
                styles.pickerTriggerText,
                !selectedCompanyObj && styles.pickerPlaceholder,
              ]}
            >
              {selectedCompanyObj
                ? `${selectedCompanyObj.companyName}${selectedCompanyObj.location ? ` (${selectedCompanyObj.location})` : ''}`
                : companyCategory === 'office'
                ? 'Select Office Location *'
                : 'Select Client Company *'}
            </Text>
            {selectedCompanyObj ? (
              <TouchableOpacity
                onPress={() => {
                  setSelectedCompanyId('');
                  setSelectedClientId('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Client Contact Person */}
          {companyCategory === 'office' ? (
            <View style={styles.officeClientNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
              <Text style={styles.officeClientNoticeText}>
                Office expenses do not require an external client contact.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Client Contact Person *</Text>
              <TouchableOpacity
                style={[
                  styles.pickerTrigger,
                  !selectedCompanyId && styles.pickerTriggerDisabled,
                ]}
                onPress={() => {
                  if (!selectedCompanyId) {
                    Alert.alert('Company Required', 'Please select a Client Company first.');
                    return;
                  }
                  setClientPickerVisible(true);
                }}
                activeOpacity={0.8}
                disabled={!selectedCompanyId}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={selectedCompanyId ? COLORS.primary : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.pickerTriggerText,
                    !selectedClientObj && styles.pickerPlaceholder,
                  ]}
                >
                  {selectedClientObj
                    ? `${selectedClientObj.clientName || selectedClientObj.name} (${selectedClientObj.clientPhoneNumber || selectedClientObj.phoneNumber || 'No phone'})`
                    : selectedCompanyId
                    ? 'Select Client Contact Person *'
                    : 'Select Company first to choose client'}
                </Text>
                {selectedClientObj ? (
                  <TouchableOpacity
                    onPress={() => setSelectedClientId('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </>
          )}

          {/* General Description */}
          <TextInputField
            label="General Description (Optional)"
            placeholder="Brief overview of visit, destination, or purpose"
            value={generalDescription}
            onChangeText={setGeneralDescription}
            multiline
            numberOfLines={2}
            style={{ marginTop: SPACING.xs }}
          />
        </Card>

        {/* 2. Multiple Expense Items */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="list-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              Expense Items ({items.length})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addItemBtn}
            onPress={handleAddItem}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.addItemBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, index) => {
          const isOthers = item.categoryName === 'Others';

          return (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <View style={styles.itemBadge}>
                  <Text style={styles.itemBadgeText}>Item #{index + 1}</Text>
                </View>
                {items.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(index)}
                    style={styles.removeItemBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Picker Trigger */}
              <Text style={styles.inputLabel}>Category *</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setActiveCategoryPickerIndex(index)}
                activeOpacity={0.8}
              >
                <Ionicons name="pricetag-outline" size={18} color={COLORS.primary} />
                <Text style={styles.pickerTriggerText}>
                  {item.categoryName || 'Select Category'}
                </Text>
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeText}>
                    {item.calculationMode === 'automatic' ? 'Automatic' : 'Manual'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Others: Custom Expense Name */}
              {isOthers && (
                <TextInputField
                  label="Expense Title / Name *"
                  placeholder="e.g. Parking Fee, Toll, Tollgate, Courier"
                  value={item.customCategoryName}
                  onChangeText={(val) => handleItemFieldChange(index, 'customCategoryName', val)}
                  leftIcon="pencil-outline"
                />
              )}

              {/* Automatic Mode Details */}
              {item.calculationMode === 'automatic' ? (
                <View style={styles.autoCalcBox}>
                  <View style={styles.rateRow}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.rateText}>
                      Configured Rate:{' '}
                      <Text style={styles.rateHighlight}>
                        ₹{item.ratePerUnit} / {item.unit || 'km'}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.distInputRow}>
                    <View style={styles.distInputCol}>
                      <TextInputField
                        label="Outbound (km) *"
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={item.outboundDistanceKm}
                        onChangeText={(val) =>
                          handleDistanceChange(index, 'outboundDistanceKm', val)
                        }
                      />
                    </View>
                    <View style={styles.distInputCol}>
                      <TextInputField
                        label="Return (km) *"
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={item.returnDistanceKm}
                        onChangeText={(val) =>
                          handleDistanceChange(index, 'returnDistanceKm', val)
                        }
                      />
                    </View>
                  </View>

                  <View style={styles.autoResultRow}>
                    <Text style={styles.autoResultLabel}>
                      Total: {item.totalQuantity || '0'} {item.unit || 'km'} × ₹{item.ratePerUnit} =
                    </Text>
                    <Text style={styles.autoResultValue}>
                      ₹{item.amount || '0'}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Manual Mode: Amount input */
                <TextInputField
                  label="Amount (₹) *"
                  placeholder="Enter amount in ₹"
                  keyboardType="numeric"
                  value={item.amount}
                  onChangeText={(val) => handleItemFieldChange(index, 'amount', val)}
                  leftIcon="cash-outline"
                />
              )}

              {/* Item Description */}
              <TextInputField
                label="Item Description (Optional)"
                placeholder="Details, purpose, or reason for this expense"
                value={item.description}
                onChangeText={(val) => handleItemFieldChange(index, 'description', val)}
              />

              {/* Attachments Section */}
              <View style={styles.attachmentsSection}>
                <View style={styles.attachHeaderRow}>
                  <Text style={styles.attachTitle}>
                    Proof Attachments ({item.localAttachments.length})
                  </Text>
                  <TouchableOpacity
                    style={styles.addAttachBtn}
                    onPress={() => handleAddAttachment(index)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.addAttachBtnText}>+ Attach</Text>
                  </TouchableOpacity>
                </View>

                {item.localAttachments.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.attachScroll}
                  >
                    {item.localAttachments.map((uri, aIdx) => (
                      <View key={aIdx} style={styles.attachThumbWrap}>
                        <TouchableOpacity
                          onPress={() => {
                            setPreviewImageUri(uri);
                            setPreviewTitle(`Proof Receipt - Item #${index + 1}`);
                            setPreviewModalVisible(true);
                          }}
                        >
                          <Image source={{ uri }} style={styles.attachThumb} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeAttachBadge}
                          onPress={() => handleRemoveAttachment(index, aIdx)}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                        >
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.noAttachText}>Optional receipts, bills, or photo proofs</Text>
                )}
              </View>
            </Card>
          );
        })}

        {/* 3. Grand Total & Summary Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Itemized Summary</Text>
          {items.map((item, idx) => {
            const displayName =
              item.categoryName === 'Others' && item.customCategoryName
                ? `Others: ${item.customCategoryName}`
                : item.categoryName || `Item #${idx + 1}`;
            const itemAmt = parseFloat(item.amount) || 0;

            return (
              <View key={item.id} style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryItemName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {item.calculationMode === 'automatic' && item.totalQuantity ? (
                    <Text style={styles.summaryItemSub}>
                      {item.totalQuantity} {item.unit || 'km'} @ ₹{item.ratePerUnit}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.summaryItemAmount}>
                  ₹{itemAmt.toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })}

          <View style={styles.summaryDivider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>
              ₹{grandTotal.toLocaleString('en-IN')}
            </Text>
          </View>
        </Card>

        {/* Submit Action */}
        <View style={styles.submitContainer}>
          <PrimaryButton
            title={
              submitting
                ? 'Submitting Expense...'
                : `Submit Expense (₹${grandTotal.toLocaleString('en-IN')})`
            }
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            icon="checkmark-circle-outline"
          />
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        selectedDate={expenseDate}
        onSelectDate={setExpenseDate}
        title="Select Expense Date"
      />

      {/* Related Duty Picker Modal with "Oct 3" formatting */}
      <DropdownPickerModal
        visible={dutyPickerVisible}
        onClose={() => setDutyPickerVisible(false)}
        items={duties.map((d) => {
          const dateStr = formatDutyShortDate(d.dutyDate);
          const code = d.dutyId || 'Work';
          const title = d.machineName || d.workType || d.customerName || 'Service Duty';
          const comp = d.company?.companyName || (d.dutyType === 'office' ? 'Office' : '');
          return {
            label: `${dateStr} • ${code} - ${title}${comp ? ` (${comp})` : ''}`,
            subtitle: `${comp ? `${comp} • ` : ''}${d.customerName || 'General'}`,
            value: d._id,
            raw: d,
          };
        })}
        selectedValue={selectedDutyId}
        onSelect={(val) => {
          handleSelectDuty(val);
          setDutyPickerVisible(false);
        }}
        title="Select Related Work / Duty"
        showAllOption={false}
        searchPlaceholder="Search work code, machine, date..."
      />

      {/* Company Picker Modal */}
      <DropdownPickerModal
        visible={companyPickerVisible}
        onClose={() => setCompanyPickerVisible(false)}
        items={filteredCompanies.map((c) => ({
          label: c.companyName + (c.location ? ` (${c.location})` : ''),
          subtitle: c.companyType === 'office' ? 'Internal Office' : 'Client Site',
          value: c._id,
        }))}
        selectedValue={selectedCompanyId}
        onSelect={(val) => {
          setSelectedCompanyId(val);
          setCompanyPickerVisible(false);
        }}
        title={companyCategory === 'office' ? 'Select Office Location' : 'Select Client Company'}
        showAllOption={false}
        searchPlaceholder="Search company name or location..."
      />

      {/* Client Picker Modal */}
      <DropdownPickerModal
        visible={clientPickerVisible}
        onClose={() => setClientPickerVisible(false)}
        items={clients.map((c) => ({
          label: `${c.clientName || c.name}${c.clientPhoneNumber || c.phoneNumber ? ` (${c.clientPhoneNumber || c.phoneNumber})` : ''}`,
          subtitle: c.designation || 'Client Contact',
          value: c._id,
        }))}
        selectedValue={selectedClientId}
        onSelect={(val) => {
          setSelectedClientId(val);
          setClientPickerVisible(false);
        }}
        title="Select Client Contact Person"
        showAllOption={false}
        searchPlaceholder="Search contact name or phone..."
      />

      {/* Category Picker Modal */}
      <DropdownPickerModal
        visible={activeCategoryPickerIndex !== null}
        onClose={() => setActiveCategoryPickerIndex(null)}
        items={categories.map((c) => ({
          label: `${c.name} (${c.calculationMode === 'automatic' ? `Auto ₹${c.ratePerUnit}/${c.unit}` : 'Manual'})`,
          value: c._id,
          raw: c,
        }))}
        selectedValue={
          activeCategoryPickerIndex !== null ? items[activeCategoryPickerIndex]?.categoryId : ''
        }
        onSelect={(val) => {
          const selectedCat = categories.find((c) => c._id === val);
          if (selectedCat && activeCategoryPickerIndex !== null) {
            handleSelectCategory(activeCategoryPickerIndex, selectedCat);
          }
        }}
        title="Select Expense Category"
        showAllOption={false}
      />

      {/* Lightbox Preview */}
      <ImageViewerModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        imageUri={previewImageUri}
        title={previewTitle}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  card: {
    marginBottom: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 8,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  officeClientNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  officeClientNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.xs,
  },
  pickerTriggerDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.7,
  },
  pickerTriggerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  pickerSubText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pickerPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  modeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  modeBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemCard: {
    marginBottom: SPACING.md,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  itemBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  removeItemBtn: {
    padding: 4,
  },
  autoCalcBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: 6,
    marginBottom: 6,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rateHighlight: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  distInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  distInputCol: {
    flex: 1,
  },
  autoResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  autoResultLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  autoResultValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },
  attachmentsSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  attachHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  attachTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  addAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addAttachBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  attachScroll: {
    flexDirection: 'row',
    marginTop: 6,
  },
  attachThumbWrap: {
    position: 'relative',
    marginRight: 10,
  },
  attachThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  removeAttachBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAttachText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: '#FAFAF9',
    borderColor: '#E7E5E4',
    marginBottom: SPACING.lg,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  summaryItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  summaryItemSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  summaryItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E7E5E4',
    marginVertical: SPACING.sm,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  submitContainer: {
    marginTop: SPACING.xs,
  },
});

export default ExpenseFormScreen;
