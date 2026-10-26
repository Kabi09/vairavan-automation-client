import React, { useState, useEffect, useMemo } from 'react';
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
  localAttachments: [], // array of local URIs
  uploadedAttachments: [], // array of { url, originalName, size }
});

export const ExpenseFormScreen = ({ navigation, route }) => {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown data
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);

  // Form Fields - Basic Details
  const [expenseDate, setExpenseDate] = useState(formatISODateOnly());
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [relatedDutyId, setRelatedDutyId] = useState('');
  const [generalDescription, setGeneralDescription] = useState('');

  // Form Fields - Dynamic Items
  const [items, setItems] = useState([]);

  // Modals
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [companyPickerVisible, setCompanyPickerVisible] = useState(false);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [activeCategoryPickerIndex, setActiveCategoryPickerIndex] = useState(null);

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Load Categories & Companies
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoadingInitial(true);
        setError('');
        const [catsRes, compsRes] = await Promise.all([
          expenseApi.getCategories(),
          companyApi.getCompanies(),
        ]);

        if (!isMounted) return;

        const activeCats = (catsRes.data?.categories || []).filter(
          (c) => c.status === 'active'
        );
        setCategories(activeCats);
        setCompanies(compsRes.data?.companies || []);

        // Initialize with one empty item
        const defaultCat = activeCats.find((c) => c.name === 'Travel – Kilometer') || activeCats[0];
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

  // When selected company changes, fetch filtered clients
  useEffect(() => {
    if (!selectedCompanyId) {
      setClients([]);
      setSelectedClientId('');
      return;
    }

    let isMounted = true;
    const fetchClients = async () => {
      try {
        const res = await clientApi.getClientsByCompany(selectedCompanyId);
        if (isMounted) {
          setClients(res.data?.clients || []);
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
  }, [selectedCompanyId]);

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

      const outbound = field === 'outboundDistanceKm' ? parseFloat(value) || 0 : parseFloat(item.outboundDistanceKm) || 0;
      const ret = field === 'returnDistanceKm' ? parseFloat(value) || 0 : parseFloat(item.returnDistanceKm) || 0;
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

  // Validation & Submission
  const handleSubmit = async () => {
    if (submitting) return; // Prevent duplicate submission

    // Validate Items
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
        Alert.alert('Validation Error', `Item #${itemNum}: Please specify the custom expense name for Others.`);
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
          calculationMode: item.calculationMode,
          unit: item.unit || undefined,
          appliedRate: item.ratePerUnit || undefined,
          outboundDistanceKm: item.calculationMode === 'automatic' ? outbound : undefined,
          returnDistanceKm: item.calculationMode === 'automatic' ? ret : undefined,
          quantity: item.calculationMode === 'automatic' ? totalDist : undefined,
          amount: Math.round(parseFloat(item.amount)),
          description: item.description?.trim() || undefined,
          attachments: uploadedAttachments,
        });
      }

      // Step 2: Submit Expense payload
      const payload = {
        expenseDate,
        company: selectedCompanyId || undefined,
        client: selectedClientId || undefined,
        relatedDuty: relatedDutyId?.trim() || undefined,
        generalDescription: generalDescription?.trim() || undefined,
        items: preparedItems,
      };

      const res = await expenseApi.createExpense(payload);

      Alert.alert(
        'Expense Submitted',
        `Your expense submission #${res.data?.expense?.expenseId || ''} for ₹${grandTotal.toLocaleString('en-IN')} has been saved successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MyExpenses');
              }
            },
          },
        ]
      );
    } catch (submitErr) {
      setError(extractErrorMessage(submitErr, 'Failed to submit expense claim'));
      Alert.alert('Submission Error', extractErrorMessage(submitErr, 'Failed to submit expense claim'));
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

  const selectedCompanyObj = companies.find((c) => c._id === selectedCompanyId);
  const selectedClientObj = clients.find((c) => c._id === selectedClientId);

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

          {/* Company (Optional) */}
          <Text style={styles.inputLabel}>Company (Optional)</Text>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => setCompanyPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="business-outline" size={18} color={COLORS.primary} />
            <Text
              style={[
                styles.pickerTriggerText,
                !selectedCompanyObj && styles.pickerPlaceholder,
              ]}
            >
              {selectedCompanyObj ? selectedCompanyObj.companyName : 'Select Company (Optional)'}
            </Text>
            {selectedCompanyObj ? (
              <TouchableOpacity
                onPress={() => setSelectedCompanyId('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {/* Client (Optional, filtered by company) */}
          {selectedCompanyId ? (
            <>
              <Text style={styles.inputLabel}>Client / Contact (Optional)</Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setClientPickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                <Text
                  style={[
                    styles.pickerTriggerText,
                    !selectedClientObj && styles.pickerPlaceholder,
                  ]}
                >
                  {selectedClientObj
                    ? `${selectedClientObj.clientName || selectedClientObj.name} (${selectedClientObj.clientPhoneNumber || selectedClientObj.phoneNumber || ''})`
                    : 'Select Client (Optional)'}
                </Text>
                {selectedClientObj ? (
                  <TouchableOpacity
                    onPress={() => setSelectedClientId('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </>
          ) : null}

          {/* Related Duty / Work ID */}
          <TextInputField
            label="Related Work / Duty (Optional)"
            placeholder="e.g. WORK-0123 or Service Visit"
            value={relatedDutyId}
            onChangeText={setRelatedDutyId}
            leftIcon="briefcase-outline"
          />

          {/* General Description */}
          <TextInputField
            label="General Description (Optional)"
            placeholder="Brief overview of the visit or travel"
            value={generalDescription}
            onChangeText={setGeneralDescription}
            multiline
            numberOfLines={2}
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
          const isKmAutomatic =
            item.calculationMode === 'automatic' ||
            item.categoryName.toLowerCase().includes('kilometer') ||
            item.categoryName.toLowerCase().includes('km');
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
            title={submitting ? 'Submitting Expense...' : `Submit Expense (₹${grandTotal.toLocaleString('en-IN')})`}
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

      {/* Company Picker Modal */}
      <DropdownPickerModal
        visible={companyPickerVisible}
        onClose={() => setCompanyPickerVisible(false)}
        items={companies.map((c) => ({
          label: c.companyName + (c.location ? ` (${c.location})` : ''),
          value: c._id,
        }))}
        selectedValue={selectedCompanyId}
        onSelect={(val) => {
          setSelectedCompanyId(val);
          setCompanyPickerVisible(false);
        }}
        title="Select Company"
        searchable
      />

      {/* Client Picker Modal */}
      <DropdownPickerModal
        visible={clientPickerVisible}
        onClose={() => setClientPickerVisible(false)}
        items={clients.map((c) => ({
          label: `${c.clientName || c.name} (${c.clientPhoneNumber || c.phoneNumber || ''})`,
          value: c._id,
        }))}
        selectedValue={selectedClientId}
        onSelect={(val) => {
          setSelectedClientId(val);
          setClientPickerVisible(false);
        }}
        title="Select Client Contact"
        searchable
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
          activeCategoryPickerIndex !== null
            ? items[activeCategoryPickerIndex]?.categoryId
            : ''
        }
        onSelect={(val) => {
          const selectedCat = categories.find((c) => c._id === val);
          if (selectedCat && activeCategoryPickerIndex !== null) {
            handleSelectCategory(activeCategoryPickerIndex, selectedCat);
          }
        }}
        title="Select Expense Category"
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
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 6,
  },
  pickerTriggerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  pickerPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  modeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
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
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  addItemBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itemCard: {
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  itemBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  removeItemBtn: {
    padding: 4,
  },
  autoCalcBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginVertical: 6,
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
