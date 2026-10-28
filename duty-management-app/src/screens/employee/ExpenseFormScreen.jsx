import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
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
import { formatDate, formatISODateOnly, formatTime } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { saveExpenseDraft, getExpenseDraft, clearExpenseDraft } from '../../utils/draftStorage';

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

export const ExpenseFormScreen = ({ navigation, route }) => {
  const routeDuty = route?.params?.duty || route?.params?.dutyToEdit;
  const expenseToEdit = route?.params?.expenseToEdit || route?.params?.expense;
  const isEditing = Boolean(expenseToEdit);
  const isAdmin = Boolean(route?.params?.isAdmin);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown options
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [duties, setDuties] = useState([]);

  // Work & Entity Association
  const [selectedDutyId, setSelectedDutyId] = useState(() => {
    if (expenseToEdit) {
      return expenseToEdit.duty?._id ? String(expenseToEdit.duty._id) : (expenseToEdit.duty ? String(expenseToEdit.duty) : '');
    }
    return routeDuty?._id ? String(routeDuty._id) : '';
  });
  const [relatedDutyId, setRelatedDutyId] = useState(() => {
    if (expenseToEdit) {
      return expenseToEdit.relatedDuty || expenseToEdit.duty?.dutyId || '';
    }
    return routeDuty?.dutyId || (routeDuty?._id ? String(routeDuty._id) : '');
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    if (expenseToEdit) {
      return expenseToEdit.company?._id ? String(expenseToEdit.company._id) : (expenseToEdit.company ? String(expenseToEdit.company) : '');
    }
    return routeDuty?.company?._id ? String(routeDuty.company._id) : (routeDuty?.company ? String(routeDuty.company) : '');
  });
  const [selectedClientId, setSelectedClientId] = useState(() => {
    if (expenseToEdit) {
      return expenseToEdit.client?._id ? String(expenseToEdit.client._id) : (expenseToEdit.client ? String(expenseToEdit.client) : '');
    }
    return routeDuty?.client?._id ? String(routeDuty.client._id) : (routeDuty?.client ? String(routeDuty.client) : '');
  });
  const [companyCategory, setCompanyCategory] = useState(() => {
    if (expenseToEdit) {
      return expenseToEdit.duty?.dutyType === 'office' || isOfficeCompany(expenseToEdit.company) ? 'office' : 'client';
    }
    if (routeDuty) {
      return routeDuty.dutyType === 'office' ? 'office' : 'client';
    }
    return 'client';
  });
  const [expenseDate, setExpenseDate] = useState(() => {
    if (expenseToEdit?.expenseDate) {
      return formatISODateOnly(expenseToEdit.expenseDate);
    }
    if (routeDuty?.dutyDate) {
      return formatISODateOnly(routeDuty.dutyDate);
    }
    return formatISODateOnly();
  });
  const [generalDescription, setGeneralDescription] = useState(() => {
    return expenseToEdit?.generalDescription || '';
  });

  // Previous expenses for this work
  const [previousExpenses, setPreviousExpenses] = useState([]);
  const [loadingPreviousExpenses, setLoadingPreviousExpenses] = useState(false);

  // Items list
  const [items, setItems] = useState(() => {
    if (expenseToEdit && Array.isArray(expenseToEdit.items) && expenseToEdit.items.length > 0) {
      return expenseToEdit.items.map((it, idx) => ({
        id: it._id ? String(it._id) : `edit_item_${idx}_${Date.now()}`,
        categoryId: it.category?._id ? String(it.category._id) : (it.category ? String(it.category) : ''),
        categoryName: it.categoryName || it.category?.name || '',
        calculationMode: it.calculationMode || 'manual',
        ratePerUnit: it.ratePerUnit || it.appliedRate || 0,
        unit: it.unit || 'km',
        customCategoryName: it.customTitle || it.customCategoryName || '',
        customTitle: it.customTitle || it.customCategoryName || '',
        outboundDistanceKm: it.outboundDistance !== undefined && it.outboundDistance !== null
          ? String(it.outboundDistance)
          : (it.outboundDistanceKm !== undefined && it.outboundDistanceKm !== null ? String(it.outboundDistanceKm) : ''),
        returnDistanceKm: it.returnDistance !== undefined && it.returnDistance !== null
          ? String(it.returnDistance)
          : (it.returnDistanceKm !== undefined && it.returnDistanceKm !== null ? String(it.returnDistanceKm) : ''),
        totalQuantity: it.totalDistance !== undefined && it.totalDistance !== null
          ? String(it.totalDistance)
          : (it.quantity !== undefined && it.quantity !== null ? String(it.quantity) : ''),
        amount: String(it.amount || 0),
        description: it.description || '',
        localAttachments: [],
        uploadedAttachments: Array.isArray(it.attachments)
          ? it.attachments.map((att) => ({
              url: typeof att === 'string' ? att : att.url,
              key: att.key || att.publicId || '',
              originalName: att.originalName || 'receipt.jpg',
              size: att.size || 0,
            }))
          : [],
      }));
    }
    return [];
  });

  // Draft persistence state
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftLoadedOnce, setDraftLoadedOnce] = useState(false);

  // Load draft on mount (only when creating a new expense, not when editing)
  useEffect(() => {
    if (isEditing) {
      setDraftLoadedOnce(true);
      return;
    }

    let isMounted = true;
    const loadDraft = async () => {
      try {
        const draft = await getExpenseDraft();
        if (draft && isMounted) {
          if (routeDuty) {
            // When opening for a specific work, enforce routeDuty association
            setSelectedDutyId(String(routeDuty._id));
            setRelatedDutyId(routeDuty.dutyId || String(routeDuty._id));
            // Only restore draft items if saved for this exact same duty
            if (draft.selectedDutyId && String(draft.selectedDutyId) === String(routeDuty._id)) {
              if (draft.generalDescription) setGeneralDescription(draft.generalDescription);
              if (Array.isArray(draft.items) && draft.items.length > 0) {
                setItems(draft.items);
                setDraftRestored(true);
              }
            }
          } else {
            // Standalone mode: restore draft as is
            if (draft.expenseDate) setExpenseDate(draft.expenseDate);
            if (draft.companyCategory) setCompanyCategory(draft.companyCategory);
            if (draft.selectedCompanyId) setSelectedCompanyId(draft.selectedCompanyId);
            if (draft.selectedClientId) setSelectedClientId(draft.selectedClientId);
            if (draft.selectedDutyId) setSelectedDutyId(draft.selectedDutyId);
            if (draft.relatedDutyId) setRelatedDutyId(draft.relatedDutyId);
            if (draft.generalDescription) setGeneralDescription(draft.generalDescription);
            if (Array.isArray(draft.items) && draft.items.length > 0) {
              setItems(draft.items);
            }
            if (
              (Array.isArray(draft.items) && draft.items.length > 0) ||
              (draft.generalDescription && draft.generalDescription.trim())
            ) {
              setDraftRestored(true);
            }
          }
        }
      } catch (err) {
        console.warn('[ExpenseForm] Draft load error:', err);
      } finally {
        if (isMounted) setDraftLoadedOnce(true);
      }
    };

    loadDraft();
    return () => {
      isMounted = false;
    };
  }, [isEditing, routeDuty]);

  // Auto-save draft on changes (debounced 800ms, only when creating new expense)
  useEffect(() => {
    if (isEditing || !draftLoadedOnce) return;

    const hasContent = Boolean(
      (items && items.length > 0) ||
      (generalDescription && generalDescription.trim()) ||
      selectedDutyId ||
      relatedDutyId
    );

    if (!hasContent) return;

    const timer = setTimeout(() => {
      saveExpenseDraft({
        expenseDate,
        companyCategory,
        selectedCompanyId,
        selectedClientId,
        selectedDutyId,
        relatedDutyId,
        generalDescription,
        items,
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [
    isEditing,
    draftLoadedOnce,
    expenseDate,
    companyCategory,
    selectedCompanyId,
    selectedClientId,
    selectedDutyId,
    relatedDutyId,
    generalDescription,
    items,
  ]);

  const handleDiscardDraft = () => {
    Alert.alert(
      'Discard Draft',
      'Are you sure you want to discard your saved expense draft and start fresh?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearExpenseDraft();
            setItems([]);
            setGeneralDescription('');
            setDraftRestored(false);
          },
        },
      ]
    );
  };

  // Modals
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dutyPickerVisible, setDutyPickerVisible] = useState(false);

  // Add / Edit Item Modal State
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [modalCategoryId, setModalCategoryId] = useState('');
  const [modalCategoryName, setModalCategoryName] = useState('');
  const [modalCalculationMode, setModalCalculationMode] = useState('manual');
  const [modalRatePerUnit, setModalRatePerUnit] = useState(0);
  const [modalUnit, setModalUnit] = useState('km');
  const [modalCustomTitle, setModalCustomTitle] = useState('');
  const [modalOutboundDist, setModalOutboundDist] = useState('');
  const [modalReturnDist, setModalReturnDist] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalLocalAttachments, setModalLocalAttachments] = useState([]);
  const [modalUploadedAttachments, setModalUploadedAttachments] = useState([]);

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Fetch previous expenses submitted for a duty
  const loadPreviousExpenses = useCallback(async (dutyIdOrCode) => {
    if (!dutyIdOrCode) {
      setPreviousExpenses([]);
      return;
    }
    try {
      setLoadingPreviousExpenses(true);
      const res = await expenseApi.getMyExpenses({ dutyId: dutyIdOrCode, limit: 100 });
      const expList = extractArray(res, 'expenses');
      setPreviousExpenses(expList);
    } catch (err) {
      setPreviousExpenses([]);
    } finally {
      setLoadingPreviousExpenses(false);
    }
  }, []);

  // Core helper to assign company, client, date, and category from a duty
  const applyDutyToState = (duty, existingComps = companies) => {
    if (!duty) return;

    setSelectedDutyId(String(duty._id));
    setRelatedDutyId(duty.dutyId || String(duty._id));

    // 1. Sync expense date
    if (duty.dutyDate) {
      setExpenseDate(formatISODateOnly(duty.dutyDate));
    }

    // 2. Determine Office vs Client mode
    const isOffice =
      duty.dutyType === 'office' ||
      (duty.company && isOfficeCompany(duty.company)) ||
      (duty.customerName && duty.customerName.toLowerCase() === 'office');
    setCompanyCategory(isOffice ? 'office' : 'client');

    // 3. Auto-assign Company
    if (duty.company) {
      if (typeof duty.company === 'object') {
        const comp = duty.company;
        const compId = String(comp._id);
        setSelectedCompanyId(compId);
        setCompanies((prev) => {
          if (!prev.some((c) => String(c._id) === compId)) {
            return [comp, ...prev];
          }
          return prev;
        });
      } else {
        setSelectedCompanyId(String(duty.company));
      }
    }

    // 4. Auto-assign Client
    if (!isOffice) {
      if (duty.client) {
        if (typeof duty.client === 'object') {
          const cli = duty.client;
          const cliId = String(cli._id);
          setSelectedClientId(cliId);
          setClients((prev) => {
            if (!prev.some((c) => String(c._id) === cliId)) {
              return [cli, ...prev];
            }
            return prev;
          });
        } else {
          setSelectedClientId(String(duty.client));
        }
      } else if (duty.customerName && duty.customerName !== 'Office') {
        const customClientObj = {
          _id: `custom_${duty._id}`,
          clientName: duty.customerName,
          name: duty.customerName,
          clientPhoneNumber: duty.customerPhoneNumber || '',
          phoneNumber: duty.customerPhoneNumber || '',
        };
        setSelectedClientId(customClientObj._id);
        setClients((prev) => [customClientObj, ...prev.filter((c) => c._id !== customClientObj._id)]);
      } else {
        setSelectedClientId('');
      }
    } else {
      setSelectedClientId('');
    }

    // 5. Load previous expenses for this duty
    loadPreviousExpenses(duty._id || duty.dutyId);
  };

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
          dutyApi.getMyDuties({ limit: 150 }).catch(() => null),
        ]);

        if (!isMounted) return;

        const activeCats = extractArray(catsRes, 'categories').filter(
          (c) => c.status === 'active'
        );
        const allComps = extractArray(compsRes, 'companies');
        const allDuties = extractArray(dutiesRes, 'duties');

        setCategories(activeCats);
        setCompanies(allComps);

        // Ensure routeDuty is always present in the duties list
        let mergedDuties = allDuties;
        if (routeDuty && !allDuties.some((d) => String(d._id) === String(routeDuty._id))) {
          mergedDuties = [routeDuty, ...allDuties];
        }
        setDuties(mergedDuties);

        // If route duty was passed, perform full auto-assignment
        if (routeDuty) {
          const dutyMatch = mergedDuties.find((d) => String(d._id) === String(routeDuty._id)) || routeDuty;
          applyDutyToState(dutyMatch, allComps);
        } else if (mergedDuties.length > 0 && !selectedDutyId) {
          // Pre-select most recent duty
          applyDutyToState(mergedDuties[0], allComps);
        }
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

  // Handle duty selection from dropdown
  const handleSelectDuty = (dutyId) => {
    const duty = duties.find((d) => String(d._id) === String(dutyId));
    if (!duty) return;
    applyDutyToState(duty);
    setDutyPickerVisible(false);
  };

  // Selected duty object
  const selectedDutyObj = useMemo(() => {
    const targetId = selectedDutyId || (routeDuty?._id ? String(routeDuty._id) : '');
    if (!targetId) return routeDuty || null;
    const found = duties.find((d) => String(d._id) === String(targetId));
    if (found) return found;
    if (routeDuty && String(routeDuty._id) === String(targetId)) return routeDuty;
    return routeDuty || null;
  }, [duties, selectedDutyId, routeDuty]);

  // Selected company object
  const selectedCompanyObj = useMemo(() => {
    if (!selectedCompanyId) return null;
    const found = companies.find((c) => String(c._id) === String(selectedCompanyId));
    if (found) return found;
    if (selectedDutyObj?.company && typeof selectedDutyObj.company === 'object') {
      return selectedDutyObj.company;
    }
    return null;
  }, [companies, selectedCompanyId, selectedDutyObj]);

  // Selected client object
  const selectedClientObj = useMemo(() => {
    if (!selectedClientId) {
      if (selectedDutyObj?.customerName && selectedDutyObj.customerName !== 'Office') {
        return {
          _id: `custom_${selectedDutyObj._id}`,
          clientName: selectedDutyObj.customerName,
          name: selectedDutyObj.customerName,
          clientPhoneNumber: selectedDutyObj.customerPhoneNumber || '',
          phoneNumber: selectedDutyObj.customerPhoneNumber || '',
        };
      }
      return null;
    }
    const found = clients.find((c) => String(c._id) === String(selectedClientId));
    if (found) return found;
    if (selectedDutyObj?.client && typeof selectedDutyObj.client === 'object') {
      return selectedDutyObj.client;
    }
    return null;
  }, [clients, selectedClientId, selectedDutyObj]);

  // Open modal to add a new item
  const handleOpenAddItemModal = () => {
    const defaultCat = categories.find((c) => c.name === 'Travel – Kilometer') || categories[0];
    setEditingItemIndex(null);
    setModalCategoryId(defaultCat?._id || '');
    setModalCategoryName(defaultCat?.name || '');
    setModalCalculationMode(defaultCat?.calculationMode || 'manual');
    setModalRatePerUnit(defaultCat?.ratePerUnit || 0);
    setModalUnit(defaultCat?.unit || 'km');
    setModalCustomTitle('');
    setModalOutboundDist('');
    setModalReturnDist('');
    setModalAmount('');
    setModalDescription('');
    setModalLocalAttachments([]);
    setModalUploadedAttachments([]);
    setItemModalVisible(true);
  };

  // Open modal to edit an existing item
  const handleOpenEditItemModal = (index) => {
    const item = items[index];
    if (!item) return;
    setEditingItemIndex(index);
    setModalCategoryId(item.categoryId || '');
    setModalCategoryName(item.categoryName || '');
    setModalCalculationMode(item.calculationMode || 'manual');
    setModalRatePerUnit(item.ratePerUnit || 0);
    setModalUnit(item.unit || 'km');
    setModalCustomTitle(item.customCategoryName || item.customTitle || '');
    setModalOutboundDist(item.outboundDistanceKm ? String(item.outboundDistanceKm) : '');
    setModalReturnDist(item.returnDistanceKm ? String(item.returnDistanceKm) : '');
    setModalAmount(item.amount ? String(item.amount) : '');
    setModalDescription(item.description || '');
    setModalLocalAttachments(item.localAttachments || []);
    setModalUploadedAttachments(item.uploadedAttachments || []);
    setItemModalVisible(true);
  };

  // Remove an item
  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Switch category inside modal
  const handleSelectModalCategory = (cat) => {
    setModalCategoryId(cat._id);
    setModalCategoryName(cat.name);
    setModalCalculationMode(cat.calculationMode);
    setModalRatePerUnit(cat.ratePerUnit || 0);
    setModalUnit(cat.unit || 'km');
    if (cat.name !== 'Others') {
      setModalCustomTitle('');
    }

    if (cat.calculationMode === 'automatic') {
      const out = parseFloat(modalOutboundDist) || 0;
      const ret = parseFloat(modalReturnDist) || 0;
      const tot = out + ret;
      setModalAmount(tot > 0 ? String(Math.round(tot * (cat.ratePerUnit || 0))) : '');
    } else {
      setModalOutboundDist('');
      setModalReturnDist('');
    }
  };

  // Handle distance changes inside modal
  const handleModalDistanceChange = (field, val) => {
    let out = field === 'out' ? val : modalOutboundDist;
    let ret = field === 'ret' ? val : modalReturnDist;
    if (field === 'out') setModalOutboundDist(val);
    if (field === 'ret') setModalReturnDist(val);

    const outNum = parseFloat(out) || 0;
    const retNum = parseFloat(ret) || 0;
    const tot = outNum + retNum;
    if (tot > 0 && modalCalculationMode === 'automatic') {
      setModalAmount(String(Math.round(tot * (modalRatePerUnit || 0))));
    }
  };

  // Add attachment inside modal
  const handleAddModalAttachment = () => {
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
            setModalLocalAttachments((prev) => [...prev, result.assets[0].uri]);
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
            setModalLocalAttachments((prev) => [...prev, ...newUris]);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemoveModalAttachment = (idx) => {
    setModalLocalAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveModalUploadedAttachment = (idx) => {
    setModalUploadedAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save item from modal
  const handleSaveModalItem = () => {
    if (!modalCategoryId) {
      Alert.alert('Category Required', 'Please select an expense category.');
      return;
    }
    if (modalCategoryName === 'Others' && !modalCustomTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title/name for this custom expense.');
      return;
    }
    if (modalCalculationMode === 'automatic') {
      const outNum = parseFloat(modalOutboundDist);
      const retNum = parseFloat(modalReturnDist);
      if (isNaN(outNum) || isNaN(retNum) || outNum + retNum <= 0) {
        Alert.alert('Distance Required', 'Please enter valid outbound and return distance (> 0 km).');
        return;
      }
    }
    const amtNum = parseFloat(modalAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Amount Required', 'Please enter a valid amount greater than ₹0.');
      return;
    }

    const itemObj = {
      id:
        editingItemIndex !== null
          ? items[editingItemIndex].id
          : Date.now().toString() + Math.random().toString(36).substring(2, 5),
      categoryId: modalCategoryId,
      categoryName: modalCategoryName,
      calculationMode: modalCalculationMode,
      ratePerUnit: modalRatePerUnit,
      unit: modalUnit,
      customCategoryName: modalCustomTitle.trim(),
      customTitle: modalCustomTitle.trim(),
      outboundDistanceKm: modalOutboundDist,
      returnDistanceKm: modalReturnDist,
      totalQuantity:
        modalCalculationMode === 'automatic'
          ? String((parseFloat(modalOutboundDist) || 0) + (parseFloat(modalReturnDist) || 0))
          : '',
      amount: String(Math.round(amtNum)),
      description: modalDescription.trim(),
      localAttachments: modalLocalAttachments,
      uploadedAttachments: modalUploadedAttachments,
    };

    if (editingItemIndex !== null) {
      setItems((prev) => {
        const updated = [...prev];
        updated[editingItemIndex] = itemObj;
        return updated;
      });
    } else {
      setItems((prev) => [...prev, itemObj]);
    }

    setItemModalVisible(false);
  };

  // Grand Total calculation for new items
  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }, [items]);

  // Total previously submitted amount
  const previousTotalAmount = useMemo(() => {
    return previousExpenses.reduce((sum, e) => sum + (e.grandTotal || 0), 0);
  }, [previousExpenses]);

  // Validation & Submission
  const handleSubmit = async () => {
    if (submitting) return;

    if (!selectedDutyId && !relatedDutyId) {
      Alert.alert('Work Duty Required', 'Please select a Work / Duty from the list.');
      return;
    }

    if (!items.length) {
      Alert.alert('Add Expense Items', 'Please add at least one expense item using "+ Add Expense Item".');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Step 1: Upload attachments per item
      const preparedItems = [];
      for (const item of items) {
        let uploadedAttachments = [...(item.uploadedAttachments || [])];

        if (item.localAttachments && item.localAttachments.length > 0) {
          const uploadRes = await uploadApi.uploadProofPhotos(item.localAttachments);
          const photoList =
            uploadRes?.data?.photos ||
            uploadRes?.photos ||
            (Array.isArray(uploadRes?.data) ? uploadRes.data : []) ||
            (Array.isArray(uploadRes) ? uploadRes : []);

          if (photoList && photoList.length > 0) {
            uploadedAttachments = [
              ...uploadedAttachments,
              ...photoList.map((p) => ({
                url: typeof p === 'string' ? p : p.url,
                key: p.key || p.publicId || '',
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

      // Step 2: Prepare Company & Client ID
      const targetCompId =
        selectedCompanyId ||
        (selectedCompanyObj?._id ? String(selectedCompanyObj._id) : undefined);

      let targetClientId = undefined;
      if (companyCategory === 'client') {
        if (selectedClientId && !String(selectedClientId).startsWith('custom_')) {
          targetClientId = String(selectedClientId);
        } else if (
          selectedClientObj?._id &&
          !String(selectedClientObj._id).startsWith('custom_')
        ) {
          targetClientId = String(selectedClientObj._id);
        }
      }

      // Step 3: Submit or Update Expense payload
      const payload = {
        expenseDate,
        company: targetCompId,
        companyId: targetCompId,
        client: targetClientId,
        clientId: targetClientId,
        relatedDuty: selectedDutyObj?.dutyId || routeDuty?.dutyId || (relatedDutyId ? relatedDutyId.trim() : undefined),
        duty: (selectedDutyObj?._id || routeDuty?._id || selectedDutyId) ? String(selectedDutyObj?._id || routeDuty?._id || selectedDutyId) : undefined,
        dutyId: (selectedDutyObj?._id || routeDuty?._id || selectedDutyId) ? String(selectedDutyObj?._id || routeDuty?._id || selectedDutyId) : undefined,
        generalDescription: generalDescription?.trim() || undefined,
        items: preparedItems,
      };

      if (isEditing) {
        const res = await expenseApi.updateExpense(expenseToEdit._id, payload);
        const expenseObj = res.data?.expense || res.data?.data?.expense || res.expense;
        const expenseCode = expenseObj?.expenseId || expenseToEdit.expenseId || '';

        Alert.alert(
          'Expense Updated',
          `Expense claim ${expenseCode ? `#${expenseCode} ` : ''}for ₹${grandTotal.toLocaleString(
            'en-IN'
          )} has been updated successfully.`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('AdminExpenses');
                }
              },
            },
          ]
        );
      } else {
        const res = await expenseApi.createExpense(payload);
        await clearExpenseDraft();
        setDraftRestored(false);
        const expenseObj = res.data?.expense || res.data?.data?.expense || res.expense;
        const expenseCode = expenseObj?.expenseId || '';

        Alert.alert(
          'Expense Submitted',
          `Your expense claim ${expenseCode ? `#${expenseCode} ` : ''}for ₹${grandTotal.toLocaleString(
            'en-IN'
          )} has been submitted successfully for ${selectedDutyObj?.dutyId || relatedDutyId || 'this work'}.`,
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
      }
    } catch (submitErr) {
      const msg = extractErrorMessage(submitErr, isEditing ? 'Failed to update expense claim' : 'Failed to submit expense claim');
      setError(msg);
      Alert.alert(isEditing ? 'Update Error' : 'Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title={isEditing ? `Edit Expense #${expenseToEdit?.expenseId || ''}` : 'Add Work Expense'}
          onBack={() => navigation.goBack()}
        />
        <LoadingIndicator message="Loading expense configuration..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={isEditing ? `Edit Expense #${expenseToEdit?.expenseId || ''}` : 'Add Work Expense'}
        subtitle={
          isEditing
            ? 'Modify expense items, amounts, distances, and details'
            : 'Claim travel, food, and visit expenses'
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ErrorMessage message={error} />

        {isEditing && (
          <View style={styles.adminEditBanner}>
            <View style={styles.adminEditIconPill}>
              <Ionicons name="create" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminEditBannerTitle}>Admin Edit Mode</Text>
              <Text style={styles.adminEditBannerText}>
                You have administrative access to update this expense record ({expenseToEdit.expenseId || 'EXP'}). Changes will recalculate item totals and update the permanent record.
              </Text>
            </View>
          </View>
        )}

        {draftRestored && (
          <View style={styles.draftBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="document-text" size={16} color="#047857" />
              <Text style={styles.draftBannerText}>Draft restored from your last session</Text>
            </View>
            <TouchableOpacity onPress={handleDiscardDraft} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.discardDraftText}>Discard</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1. Work Duty Association Card */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="briefcase" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Work / Duty Order</Text>
            </View>
            {Boolean(selectedDutyObj?.dutyId || relatedDutyId) && (
              <View style={styles.workIdPill}>
                <Ionicons name="link" size={13} color="#FFFFFF" />
                <Text style={styles.workIdPillText}>
                  {selectedDutyObj?.dutyId || relatedDutyId}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSubNotice}>
            All expenses are logged directly against your service visit.
          </Text>

          {/* Select Work / Duty Trigger */}
          <View style={styles.workFieldHeaderRow}>
            <Text style={styles.inputLabel}>
              {routeDuty ? 'Assigned Work / Duty (Locked)' : 'Select Work / Duty *'}
            </Text>
            {routeDuty ? (
              <View style={styles.lockedWorkTag}>
                <Ionicons name="lock-closed" size={11} color="#047857" />
                <Text style={styles.lockedWorkTagText}>Locked to Work</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={[
              styles.pickerTrigger,
              selectedDutyObj && styles.pickerTriggerSelected,
              routeDuty && styles.pickerTriggerLocked,
            ]}
            onPress={() => {
              if (routeDuty) {
                Alert.alert(
                  'Work Order Locked',
                  `This expense claim is specifically linked to Work #${selectedDutyObj?.dutyId || routeDuty.dutyId}. To claim expenses for another work, go back and select that work from My Expenses or My Duties.`
                );
              } else {
                setDutyPickerVisible(true);
              }
            }}
            activeOpacity={routeDuty ? 0.9 : 0.8}
          >
            <Ionicons
              name={routeDuty ? 'lock-closed' : 'calendar-outline'}
              size={18}
              color={routeDuty ? '#059669' : COLORS.primary}
            />
            <View style={{ flex: 1 }}>
              {selectedDutyObj ? (
                <Text style={styles.pickerTriggerText} numberOfLines={1}>
                  {formatDutyShortDate(selectedDutyObj.dutyDate)} • {selectedDutyObj.dutyId || 'Work'} -{' '}
                  {selectedDutyObj.machineName || selectedDutyObj.workType || 'Duty'}
                </Text>
              ) : (
                <Text style={[styles.pickerTriggerText, styles.pickerPlaceholder]}>
                  Tap to Select Work Duty (e.g. Oct 3)...
                </Text>
              )}
            </View>
            <Ionicons
              name={routeDuty ? 'checkmark-circle' : 'chevron-down'}
              size={16}
              color={routeDuty ? '#059669' : COLORS.textSecondary}
            />
          </TouchableOpacity>

          {/* Highlighted Auto-Assigned Details Box */}
          {selectedDutyObj ? (
            <View style={styles.assignedDetailsBox}>
              <View style={styles.assignedBoxHeader}>
                <View style={styles.assignedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.assignedBadgeText}>
                    {selectedDutyObj.dutyId || 'Work Selected'}
                  </Text>
                </View>
                <Text style={styles.assignedBoxDate}>
                  {formatDate(selectedDutyObj.dutyDate || expenseDate)}
                </Text>
              </View>

              {/* Company Row */}
              <View style={styles.assignedRow}>
                <Ionicons
                  name={companyCategory === 'office' ? 'business' : 'storefront'}
                  size={16}
                  color={COLORS.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignedLabel}>Assigned Company / Site</Text>
                  <Text style={styles.assignedValue} numberOfLines={1}>
                    {selectedCompanyObj?.companyName ||
                      (companyCategory === 'office' ? 'Internal Office' : 'Company')}
                    {selectedCompanyObj?.location ? ` (${selectedCompanyObj.location})` : ''}
                  </Text>
                </View>
              </View>

              {/* Client Row */}
              {companyCategory === 'client' ? (
                <View style={styles.assignedRow}>
                  <Ionicons name="person" size={16} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignedLabel}>Client Contact</Text>
                    <Text style={styles.assignedValue} numberOfLines={1}>
                      {selectedClientObj?.clientName ||
                        selectedDutyObj.customerName ||
                        'Client Contact'}
                      {selectedClientObj?.clientPhoneNumber || selectedDutyObj.customerPhoneNumber
                        ? ` • ${selectedClientObj?.clientPhoneNumber || selectedDutyObj.customerPhoneNumber}`
                        : ''}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.assignedRow}>
                  <Ionicons name="shield-checkmark" size={16} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignedLabel}>Location Type</Text>
                    <Text style={[styles.assignedValue, { color: '#059669' }]}>
                      Internal Office Duty
                    </Text>
                  </View>
                </View>
              )}

              {/* Machine Row */}
              {Boolean(selectedDutyObj.machineName) && (
                <View style={styles.assignedRow}>
                  <Ionicons name="hardware-chip-outline" size={16} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignedLabel}>Equipment / Machine</Text>
                    <Text style={styles.assignedValue} numberOfLines={1}>
                      {selectedDutyObj.machineName} ({selectedDutyObj.workType || 'Service'})
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {/* Expense Date Trigger */}
          <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>Expense Date *</Text>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => setDatePickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.pickerTriggerText}>{formatDate(expenseDate)}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </Card>

        {/* 2. Previous Expenses for this Work (if any) */}
        {loadingPreviousExpenses ? (
          <View style={styles.previousLoadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.previousLoadingText}>Checking previous expenses for this work...</Text>
          </View>
        ) : previousExpenses.length > 0 ? (
          <Card style={styles.previousExpensesCard}>
            <View style={styles.previousHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Ionicons name="time" size={18} color="#4F46E5" />
                <Text style={styles.previousHeaderTitle}>
                  Previous Expenses ({previousExpenses.length})
                </Text>
              </View>
              <View style={styles.previousTotalBadge}>
                <Text style={styles.previousTotalLabel}>Already Claimed:</Text>
                <Text style={styles.previousTotalVal}>
                  ₹{previousTotalAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
            <Text style={styles.previousSubNotice}>
              Existing claims logged for {selectedDutyObj?.dutyId || relatedDutyId || 'this work'}:
            </Text>

            {previousExpenses.map((prevExp, pIdx) => {
              const prevExpCode = prevExp.expenseId || `EXP-${pIdx + 1}`;
              const prevItems = prevExp.items || [];
              const proofCount = prevItems.reduce(
                (sum, it) => sum + (it.attachments?.length || 0),
                0
              );

              return (
                <View key={prevExp._id || pIdx} style={styles.previousClaimItem}>
                  <View style={styles.previousClaimTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.previousClaimCode}>#{prevExpCode}</Text>
                      <Text style={styles.previousClaimDate}>
                        • {formatDate(prevExp.expenseDate)}
                      </Text>
                    </View>
                    <Text style={styles.previousClaimAmount}>
                      ₹{(prevExp.grandTotal || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  {/* Items summary */}
                  <View style={styles.previousItemsRow}>
                    {prevItems.map((it, iIdx) => (
                      <View key={iIdx} style={styles.previousItemChip}>
                        <Text style={styles.previousItemChipText}>
                          {it.categoryName}
                          {it.customTitle ? ` (${it.customTitle})` : ''}: ₹{it.amount}
                        </Text>
                      </View>
                    ))}
                    {proofCount > 0 && (
                      <View style={styles.previousProofBadge}>
                        <Ionicons name="image-outline" size={11} color="#4F46E5" />
                        <Text style={styles.previousProofBadgeText}>{proofCount} proof(s)</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* 3. New Expense Items Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {previousExpenses.length > 0 ? 'New Expense Items' : 'Expense Items'} ({items.length})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addItemBtn}
            onPress={handleOpenAddItemModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.addItemBtnText}>+ Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyItemsCard}
            onPress={handleOpenAddItemModal}
            activeOpacity={0.8}
          >
            <View style={styles.emptyItemsIconWrap}>
              <Ionicons name="receipt-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyItemsTitle}>No Expense Items Added Yet</Text>
            <Text style={styles.emptyItemsSub}>
              Tap below to add travel kilometers, food, stay, or other work expenses.
            </Text>
            <View style={styles.emptyItemsActionBtn}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.emptyItemsActionText}>Add Expense Item</Text>
            </View>
          </TouchableOpacity>
        ) : (
          items.map((item, index) => {
            const isAuto = item.calculationMode === 'automatic';
            const isOthers = item.categoryName === 'Others';
            const displayTitle =
              isOthers && item.customCategoryName
                ? item.customCategoryName
                : item.customCategoryName
                ? `${item.categoryName} (${item.customCategoryName})`
                : item.categoryName;
            const photoCount = item.localAttachments?.length || item.uploadedAttachments?.length || 0;

            return (
              <Card key={item.id || index} style={styles.itemSummaryCard}>
                <View style={styles.itemSummaryTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemCategoryBadgeRow}>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{item.categoryName}</Text>
                      </View>
                      <View
                        style={[
                          styles.modePill,
                          isAuto ? styles.modePillAuto : styles.modePillManual,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modePillText,
                            isAuto ? styles.modePillTextAuto : styles.modePillTextManual,
                          ]}
                        >
                          {isAuto ? 'Auto km' : 'Manual'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemSummaryTitle} numberOfLines={1}>
                      {displayTitle}
                    </Text>
                  </View>
                  <Text style={styles.itemSummaryAmount}>
                    ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                {/* Calculation breakdown if automatic km */}
                {isAuto && (
                  <View style={styles.itemCalcInfoRow}>
                    <Ionicons name="navigate-outline" size={13} color="#0284C7" />
                    <Text style={styles.itemCalcInfoText}>
                      Outbound: {item.outboundDistanceKm || 0} km • Return: {item.returnDistanceKm || 0} km (Total:{' '}
                      {item.totalQuantity || 0} km @ ₹{item.ratePerUnit || 0}/km)
                    </Text>
                  </View>
                )}

                {/* Notes if any */}
                {Boolean(item.description) && (
                  <Text style={styles.itemNotesText} numberOfLines={2}>
                    “{item.description}”
                  </Text>
                )}

                {/* Attachments preview & actions bar */}
                <View style={styles.itemCardFooterRow}>
                  {photoCount > 0 ? (
                    <View style={styles.itemAttachCountBadge}>
                      <Ionicons name="camera" size={13} color="#4F46E5" />
                      <Text style={styles.itemAttachCountText}>
                        {photoCount} proof photo{photoCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noAttachNote}>No receipt attached</Text>
                  )}

                  <View style={styles.itemActionsWrap}>
                    <TouchableOpacity
                      style={styles.itemEditBtn}
                      onPress={() => handleOpenEditItemModal(index)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={15} color={COLORS.primary} />
                      <Text style={styles.itemEditBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.itemDeleteBtn}
                      onPress={() => handleRemoveItem(index)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {/* 4. General Notes */}
        <Card style={styles.card}>
          <Text style={styles.inputLabel}>General Claim Notes (Optional)</Text>
          <TextInputField
            placeholder="Brief overview of claim, purpose, destination, or approval details..."
            value={generalDescription}
            onChangeText={setGeneralDescription}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* 5. Grand Total Card */}
        {items.length > 0 && (
          <Card style={styles.summaryCard}>
            <View style={styles.grandTotalRow}>
              <View>
                <Text style={styles.grandTotalLabel}>Total New Claim</Text>
                <Text style={styles.grandTotalSub}>
                  {items.length} item{items.length !== 1 ? 's' : ''} to be submitted
                </Text>
              </View>
              <Text style={styles.grandTotalValue}>
                ₹{grandTotal.toLocaleString('en-IN')}
              </Text>
            </View>
          </Card>
        )}

        {/* 6. Submit Button */}
        <View style={styles.submitContainer}>
          <PrimaryButton
            title={
              submitting
                ? (isEditing ? 'Updating Expense Details...' : 'Submitting Expense...')
                : (isEditing
                    ? `Update Expense Details • ₹${grandTotal.toLocaleString('en-IN')}`
                    : `Submit Expense Claim • ₹${grandTotal.toLocaleString('en-IN')}`)
            }
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || items.length === 0}
            leftIcon={isEditing ? 'save-outline' : 'checkmark-circle-outline'}
          />

          <SecondaryButton
            title="Cancel"
            onPress={() => navigation.goBack()}
            style={{ marginTop: SPACING.sm }}
            disabled={submitting}
          />
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        onSelect={(date) => {
          setExpenseDate(date);
          setDatePickerVisible(false);
        }}
        initialDate={expenseDate}
      />

      {/* Work / Duty Dropdown Picker Modal with short dates ("Oct 3 • WORK-1001...") */}
      <DropdownPickerModal
        visible={dutyPickerVisible}
        onClose={() => setDutyPickerVisible(false)}
        title="Select Work / Duty Order"
        searchPlaceholder="Search work ID, date, machine, company..."
        items={duties.map((d) => ({
          _id: d._id,
          value: d._id,
          label: `${formatDutyShortDate(d.dutyDate)} • ${d.dutyId || 'Work'} - ${d.machineName || d.workType || 'Duty'} (${d.company?.companyName || (d.dutyType === 'office' ? 'Office' : 'Client')})`,
          subLabel: `${formatDate(d.dutyDate)} • ${d.company?.companyName || 'Office'} • ${d.customerName || ''}`,
        }))}
        selectedValue={selectedDutyId}
        onSelect={(val) => {
          const dutyId = typeof val === 'object' && val !== null ? val.value || val._id : val;
          if (dutyId) handleSelectDuty(dutyId);
        }}
        showAllOption={false}
      />

      {/* =========================================================================
          ADD / EDIT EXPENSE ITEM MODAL (Touch-friendly, ZERO vertical page scrolling)
         ========================================================================= */}
      <Modal
        visible={itemModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setItemModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalHeaderIconWrap}>
                  <Ionicons name="receipt" size={18} color="#4F46E5" />
                </View>
                <Text style={styles.modalTitle}>
                  {editingItemIndex !== null ? 'Edit Expense Item' : 'Add Expense Item'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setItemModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Category Chips */}
              <Text style={styles.modalSectionLabel}>Select Category *</Text>
              <View style={styles.categoryChipsRow}>
                {categories.map((cat) => {
                  const isSelected = modalCategoryId === cat._id;
                  let iconName = 'pricetag';
                  if (cat.name.includes('Travel') || cat.name.includes('Kilometer')) iconName = 'car';
                  else if (cat.name.includes('Food')) iconName = 'fast-food';
                  else if (cat.name.includes('Hotel') || cat.name.includes('Stay')) iconName = 'bed';
                  else if (cat.name.includes('Others')) iconName = 'apps';

                  return (
                    <TouchableOpacity
                      key={cat._id}
                      style={[
                        styles.catChip,
                        isSelected && styles.catChipActive,
                      ]}
                      onPress={() => handleSelectModalCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={iconName}
                        size={14}
                        color={isSelected ? '#FFFFFF' : COLORS.primary}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          isSelected && styles.catChipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {cat.calculationMode === 'automatic' && (
                        <View style={[styles.miniAutoBadge, isSelected && styles.miniAutoBadgeActive]}>
                          <Text style={[styles.miniAutoBadgeText, isSelected && styles.miniAutoBadgeTextActive]}>
                            Auto km
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Title if Others */}
              {modalCategoryName === 'Others' && (
                <TextInputField
                  label="Custom Expense Name / Title *"
                  placeholder="e.g. Parking Fee, Toll, Courier, Tools"
                  value={modalCustomTitle}
                  onChangeText={setModalCustomTitle}
                  leftIcon="pencil-outline"
                />
              )}

              {/* Automatic Mode: Distances & Rate */}
              {modalCalculationMode === 'automatic' ? (
                <View style={styles.modalAutoBox}>
                  <View style={styles.modalRateRow}>
                    <Ionicons name="speedometer-outline" size={16} color="#0284C7" />
                    <Text style={styles.modalRateText}>
                      Rate: <Text style={styles.modalRateHighlight}>₹{modalRatePerUnit} / {modalUnit || 'km'}</Text>
                    </Text>
                  </View>

                  <View style={styles.modalDistInputsRow}>
                    <View style={{ flex: 1 }}>
                      <TextInputField
                        label="Outbound (km) *"
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={modalOutboundDist}
                        onChangeText={(val) => handleModalDistanceChange('out', val)}
                        leftIcon="arrow-forward-outline"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInputField
                        label="Return (km) *"
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={modalReturnDist}
                        onChangeText={(val) => handleModalDistanceChange('ret', val)}
                        leftIcon="arrow-back-outline"
                      />
                    </View>
                  </View>

                  <View style={styles.modalCalcTotalRow}>
                    <Text style={styles.modalCalcTotalLabel}>
                      Total: {(parseFloat(modalOutboundDist) || 0) + (parseFloat(modalReturnDist) || 0)} km
                    </Text>
                    <Text style={styles.modalCalcTotalAmount}>
                      = ₹{Number(modalAmount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              ) : (
                <TextInputField
                  label="Expense Amount (₹) *"
                  placeholder="e.g. 250"
                  keyboardType="numeric"
                  value={modalAmount}
                  onChangeText={setModalAmount}
                  leftIcon="cash-outline"
                />
              )}

              {/* Description / Notes */}
              <TextInputField
                label="Item Notes / Description (Optional)"
                placeholder="e.g. Toll booth bill, lunch at site, courier receipt"
                value={modalDescription}
                onChangeText={setModalDescription}
                multiline
                numberOfLines={2}
                leftIcon="document-text-outline"
              />

              {/* Proof Documents / Photos */}
              <View style={styles.modalAttachHeader}>
                <Text style={styles.modalSectionLabel}>Receipt / Proof Photos</Text>
                <TouchableOpacity
                  style={styles.modalAddPhotoBtn}
                  onPress={handleAddModalAttachment}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                  <Text style={styles.modalAddPhotoBtnText}>+ Attach Photo</Text>
                </TouchableOpacity>
              </View>

              {/* Already uploaded attachments (when editing an existing item) */}
              {modalUploadedAttachments.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.modalSubSectionLabel}>Current Uploaded Receipts ({modalUploadedAttachments.length}):</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPhotoScroll}>
                    {modalUploadedAttachments.map((att, aIdx) => {
                      const u = typeof att === 'string' ? att : att?.url;
                      if (!u) return null;
                      return (
                        <View key={`uploaded-${aIdx}`} style={styles.modalThumbWrap}>
                          <TouchableOpacity
                            onPress={() => {
                              setPreviewImageUri(u);
                              setPreviewTitle(`Existing Receipt #${aIdx + 1}`);
                              setPreviewModalVisible(true);
                            }}
                            activeOpacity={0.85}
                          >
                            <Image source={{ uri: u }} style={styles.modalThumbImg} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.modalRemovePhotoBtn}
                            onPress={() => handleRemoveModalUploadedAttachment(aIdx)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close" size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Newly added local attachments */}
              {modalLocalAttachments.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  {modalUploadedAttachments.length > 0 && (
                    <Text style={styles.modalSubSectionLabel}>New Photos to Upload ({modalLocalAttachments.length}):</Text>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPhotoScroll}>
                    {modalLocalAttachments.map((uri, aIdx) => (
                      <View key={`local-${aIdx}`} style={styles.modalThumbWrap}>
                        <TouchableOpacity
                          onPress={() => {
                            setPreviewImageUri(uri);
                            setPreviewTitle(`New Receipt #${aIdx + 1}`);
                            setPreviewModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri }} style={styles.modalThumbImg} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.modalRemovePhotoBtn}
                          onPress={() => handleRemoveModalAttachment(aIdx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {modalUploadedAttachments.length === 0 && modalLocalAttachments.length === 0 && (
                <Text style={styles.modalNoPhotosNote}>No photos attached yet (camera or gallery).</Text>
              )}

              {/* Done / Save Button */}
              <View style={styles.modalActionsRow}>
                <SecondaryButton
                  title="Cancel"
                  onPress={() => setItemModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title={editingItemIndex !== null ? 'Save Changes' : 'Add Item'}
                  onPress={handleSaveModalItem}
                  style={{ flex: 1 }}
                  leftIcon="checkmark"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Lightbox Preview Modal */}
      <ImageViewerModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        imageUri={previewImageUri}
        title={previewTitle}
        subtitle="Receipt Verification"
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
    paddingBottom: 40,
  },
  card: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardSubNotice: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  workIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  workIdPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  workFieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 4,
  },
  lockedWorkTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  lockedWorkTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#065F46',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 4,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 6,
  },
  pickerTriggerSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#F8FAFC',
  },
  pickerTriggerLocked: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  pickerTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  pickerPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  assignedDetailsBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  assignedBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0F2FE',
    paddingBottom: 6,
    marginBottom: 2,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  assignedBoxDate: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignedLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  assignedValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Previous Expenses
  previousLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  previousLoadingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  previousExpensesCard: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  previousHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  previousHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3730A3',
  },
  previousTotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  previousTotalLabel: {
    fontSize: 10,
    color: '#E0E7FF',
    fontWeight: '600',
  },
  previousTotalVal: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  previousSubNotice: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 8,
  },
  previousClaimItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    marginBottom: 6,
  },
  previousClaimTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previousClaimCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  previousClaimDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  previousClaimAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  previousItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  previousItemChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previousItemChipText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600',
  },
  previousProofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previousProofBadgeText: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: '700',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: 4,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty items
  emptyItemsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyItemsIconWrap: {
    backgroundColor: '#EEF2FF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyItemsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyItemsSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  emptyItemsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  emptyItemsActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Item Summary Cards
  itemSummaryCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemCategoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  categoryPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  modePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  modePillAuto: {
    backgroundColor: '#E0F2FE',
  },
  modePillManual: {
    backgroundColor: '#F1F5F9',
  },
  modePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modePillTextAuto: {
    color: '#0284C7',
  },
  modePillTextManual: {
    color: '#64748B',
  },
  itemSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemSummaryAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },
  itemCalcInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    padding: 6,
    borderRadius: RADIUS.sm,
    marginTop: 6,
  },
  itemCalcInfoText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
    flex: 1,
  },
  itemNotesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  itemCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
    paddingTop: 8,
  },
  itemAttachCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemAttachCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  noAttachNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  itemActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  itemEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemDeleteBtn: {
    backgroundColor: '#FEF2F2',
    padding: 5,
    borderRadius: RADIUS.sm,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },
  submitContainer: {
    marginTop: SPACING.xs,
  },

  // =========================================================================
  // MODAL STYLING
  // =========================================================================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderIconWrap: {
    backgroundColor: '#EEF2FF',
    padding: 6,
    borderRadius: RADIUS.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollContent: {
    padding: SPACING.md,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.md,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  miniAutoBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  miniAutoBadgeActive: {
    backgroundColor: '#1E3A8A',
  },
  miniAutoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
  },
  miniAutoBadgeTextActive: {
    color: '#FFFFFF',
  },
  modalAutoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  modalRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  modalRateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalRateHighlight: {
    fontWeight: '800',
    color: '#0284C7',
  },
  modalDistInputsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCalcTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  modalCalcTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  modalCalcTotalAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
  },
  modalAttachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  modalAddPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  modalAddPhotoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalPhotoScroll: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    marginTop: 4,
  },
  modalThumbWrap: {
    position: 'relative',
    marginRight: 10,
  },
  modalThumbImg: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalRemovePhotoBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNoPhotosNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  draftBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  discardDraftText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    textDecorationLine: 'underline',
  },
  adminEditBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  adminEditIconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminEditBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  adminEditBannerText: {
    fontSize: 12,
    color: '#1D4ED8',
    marginTop: 2,
    lineHeight: 17,
  },
  modalSubSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
});

export default ExpenseFormScreen;
