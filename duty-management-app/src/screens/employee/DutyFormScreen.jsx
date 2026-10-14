import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import companyApi from '../../api/companyApi';
import dutyApi from '../../api/dutyApi';
import uploadApi from '../../api/uploadApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import SignaturePadModal from '../../components/SignaturePadModal';
import SignatureImage from '../../components/SignatureImage';
import ImageViewerModal from '../../components/ImageViewerModal';
import DatePickerModal from '../../components/DatePickerModal';
import TimePickerModal from '../../components/TimePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import ErrorMessage from '../../components/ErrorMessage';
import { getTodayDateString, formatISODateOnly } from '../../utils/dateUtils';
import { isValidPhone, isValidTimeFormat, isTimeOrderValid } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { reverseGeocodeCoords, openMapLocation } from '../../utils/locationUtils';
import { APP_CONFIG } from '../../constants/config';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const DutyFormScreen = ({ navigation, route }) => {
  const dutyToEdit = route?.params?.dutyToEdit;
  const isEditing = Boolean(dutyToEdit);

  // Form fields
  const [dutyDate, setDutyDate] = useState(() => {
    if (dutyToEdit?.dutyDate) {
      return formatISODateOnly(dutyToEdit.dutyDate) || String(dutyToEdit.dutyDate).slice(0, 10);
    }
    return getTodayDateString();
  });
  const [companies, setCompanies] = useState([]);
  const [companyCategory, setCompanyCategory] = useState(() => {
    if (dutyToEdit?.company?.companyType) {
      return dutyToEdit.company.companyType;
    }
    return 'office'; // default Office
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    return dutyToEdit?.company?._id || dutyToEdit?.company || '';
  });
  const [customerName, setCustomerName] = useState(() => dutyToEdit?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => dutyToEdit?.customerPhoneNumber || '');
  const [machineName, setMachineName] = useState(() => dutyToEdit?.machineName || '');
  const [workType, setWorkType] = useState(() => dutyToEdit?.workType || 'Maintenance');
  const [customWorkDetails, setCustomWorkDetails] = useState(() => {
    if (dutyToEdit?.customWorkType) return dutyToEdit.customWorkType;
    const match = dutyToEdit?.workDescription?.match(/^\[Work:\s*([^\]]+)\]/);
    return match ? match[1].trim() : '';
  });
  const [inTime, setInTime] = useState(() => dutyToEdit?.inTime || '09:30');
  const [outTime, setOutTime] = useState(() => dutyToEdit?.outTime || '17:30');
  const [workDescription, setWorkDescription] = useState(() => {
    if (!dutyToEdit?.workDescription) return '';
    return dutyToEdit.workDescription.replace(/^\[Work:\s*[^\]]+\]\n*/, '');
  });

  // Modals state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [inTimePickerVisible, setInTimePickerVisible] = useState(false);
  const [outTimePickerVisible, setOutTimePickerVisible] = useState(false);
  const [companyDropdownVisible, setCompanyDropdownVisible] = useState(false);

  // Full-size Image/Signature Preview Modal State
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewSubtitle, setPreviewSubtitle] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState('');
  const [previewIsSignature, setPreviewIsSignature] = useState(false);

  // Signature state
  const [signatureData, setSignatureData] = useState(() => {
    if (dutyToEdit?.customerSignature?.url) {
      return {
        url: dutyToEdit.customerSignature.url,
        dataUri: dutyToEdit.customerSignature.url,
        publicId: dutyToEdit.customerSignature.publicId || '',
        key: dutyToEdit.customerSignature.key || '',
        timestamp: dutyToEdit.customerSignature.signedAt
          ? new Date(dutyToEdit.customerSignature.signedAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }) +
            ', ' +
            new Date(dutyToEdit.customerSignature.signedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : '',
      };
    }
    return null;
  });
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);

  // Photos state (local uris or existing urls)
  const [photos, setPhotos] = useState(() => {
    if (dutyToEdit?.customerProofPhotos?.length > 0) {
      return dutyToEdit.customerProofPhotos.map((p) => p.url);
    }
    return [];
  });

  // GPS Location state
  const [locationCoords, setLocationCoords] = useState(() => {
    if (dutyToEdit?.location?.latitude) {
      return {
        latitude: dutyToEdit.location.latitude,
        longitude: dutyToEdit.location.longitude,
        accuracy: dutyToEdit.location.accuracy || 0,
        address: dutyToEdit.location.address || '',
      };
    }
    return null;
  });
  const [locating, setLocating] = useState(false);

  // If editing an older report with coordinates but no reverse-geocoded address, resolve on mount
  useEffect(() => {
    if (dutyToEdit?.location?.latitude && !dutyToEdit?.location?.address) {
      reverseGeocodeCoords(dutyToEdit.location.latitude, dutyToEdit.location.longitude)
        .then((addr) => {
          if (addr) {
            setLocationCoords((prev) => (prev ? { ...prev, address: addr } : prev));
          }
        })
        .catch(() => {});
    }
  }, [dutyToEdit]);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useFocusEffect(
    useCallback(() => {
      const loadInitialData = async () => {
        try {
          const compRes = await companyApi.getCompanies({ status: 'active', limit: 100 }).catch(() => ({ data: { companies: [] } }));
          if (compRes.data?.companies) {
            const activeComps = compRes.data.companies;
            setCompanies(activeComps);
            if (!selectedCompanyId && activeComps.length > 0) {
              const defaultOffice = activeComps.find((c) => c.companyType === 'office');
              if (defaultOffice) {
                setSelectedCompanyId(defaultOffice._id);
                setCompanyCategory('office');
                if (defaultOffice.companyPhoneNumber && !customerPhone) {
                  setCustomerPhone(defaultOffice.companyPhoneNumber);
                }
              } else {
                setSelectedCompanyId(activeComps[0]._id);
                setCompanyCategory(activeComps[0].companyType || 'client');
              }
            } else if (selectedCompanyId && activeComps.length > 0) {
              const currentComp = activeComps.find((c) => c._id === selectedCompanyId);
              if (currentComp?.companyType) {
                setCompanyCategory(currentComp.companyType);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to load companies in duty form:', err);
        }
      };

      loadInitialData();
    }, [selectedCompanyId])
  );

  // Location capture
  const handleCaptureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to tag service visit coordinates.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      const accuracy = Math.round(location.coords.accuracy || 0);

      // Reverse geocode to exact address name
      const address = await reverseGeocodeCoords(lat, lng);

      setLocationCoords({
        latitude: lat,
        longitude: lng,
        accuracy,
        address: address || '',
      });

      Alert.alert(
        'Location Captured',
        address
          ? `${address}\n\nCoordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          : `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch (locErr) {
      Alert.alert('GPS Error', 'Unable to retrieve GPS coordinates. Ensure device location is turned on.');
    } finally {
      setLocating(false);
    }
  };

  // Lightbox preview openers
  const handleOpenPhotoPreview = (uri, index) => {
    setPreviewImageUri(uri);
    setPreviewTitle(`Proof Photo #${index + 1}`);
    setPreviewSubtitle(customerName ? `Client: ${customerName}` : 'Service Verification');
    setPreviewTimestamp(dutyDate || '');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  const handleOpenSignaturePreview = () => {
    if (!signatureData?.dataUri && !signatureData?.url) return;
    setPreviewImageUri(signatureData?.dataUri || signatureData?.url || '');
    setPreviewTitle('Customer Signature');
    setPreviewSubtitle(customerName ? `Client: ${customerName}` : 'Service Verification');
    setPreviewTimestamp(signatureData?.timestamp || '');
    setPreviewIsSignature(true);
    setPreviewModalVisible(true);
  };

  // Image capture / selection (Allow max 3 proof photos)
  const handlePickPhoto = async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit Reached', 'You can attach up to 3 proof photos per visit.');
      return;
    }

    Alert.alert('Attach Proof Photo', 'Choose photo source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Permission', 'Camera permission is required to capture proof photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          if (!result.canceled && result.assets && result.assets[0]) {
            setPhotos((prev) => [...prev, result.assets[0].uri]);
          }
        },
      },
      {
        text: 'Photo Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Gallery Permission', 'Storage permission is required to select photos.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsMultipleSelection: true,
          });
          if (!result.canceled && result.assets) {
            const newUris = result.assets.map((a) => a.uri);
            setPhotos((prev) => [...prev, ...newUris].slice(0, 3));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errors = {};
    if (!dutyDate) errors.dutyDate = 'Duty date is required';
    if (!selectedCompanyId) errors.company = 'Please select a client company';
    if (!customerName.trim()) errors.customerName = 'Customer contact name is required';
    if (!customerPhone.trim()) {
      errors.customerPhone = 'Customer phone is required';
    } else if (!isValidPhone(customerPhone)) {
      errors.customerPhone = 'Customer phone must be exactly 10 digits';
    }
    if (!machineName.trim()) errors.machineName = 'Machine name is required';
    if (workType === 'Other' && !customWorkDetails.trim()) {
      errors.customWorkDetails = 'Please specify custom work details';
    }
    if (!isValidTimeFormat(inTime)) errors.inTime = 'In time must be in HH:mm format (e.g. 09:30)';
    if (!isValidTimeFormat(outTime)) errors.outTime = 'Out time must be in HH:mm format (e.g. 17:30)';
    if (isValidTimeFormat(inTime) && isValidTimeFormat(outTime) && !isTimeOrderValid(inTime, outTime)) {
      errors.outTime = 'Out time must be later than In time';
    }
    if (!workDescription.trim()) errors.workDescription = 'Work description cannot be empty';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Required fields completion check: all required fields must be filled to enable submission
  const isFormComplete = Boolean(
    dutyDate &&
    selectedCompanyId &&
    customerName.trim() &&
    customerPhone.trim().length === 10 &&
    isValidPhone(customerPhone) &&
    machineName.trim() &&
    (workType !== 'Other' || customWorkDetails.trim()) &&
    isValidTimeFormat(inTime) &&
    isValidTimeFormat(outTime) &&
    isTimeOrderValid(inTime, outTime) &&
    workDescription.trim()
  );

  const displayedCompanies = companies.filter((c) => {
    if (companyCategory === 'office') return c.companyType === 'office';
    return c.companyType !== 'office';
  });

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      let uploadedSignature = { url: '', publicId: '', key: '' };
      let uploadedPhotos = [];

      // 1. Process customer signature
      if (signatureData) {
        if (signatureData.url && signatureData.url.startsWith('http') && !signatureData.svgPaths) {
          // Reusing existing Cloudflare R2 uploaded signature
          uploadedSignature = {
            url: signatureData.url,
            publicId: signatureData.publicId || '',
            key: signatureData.key || '',
          };
        } else {
          try {
            const sigRes = await uploadApi.uploadSignature(signatureData);
            if (sigRes.data?.signature?.url) {
              uploadedSignature = sigRes.data.signature;
            } else if (sigRes.signature?.url) {
              uploadedSignature = sigRes.signature;
            }
          } catch (uploadSigErr) {
            console.warn('Signature upload error:', uploadSigErr);
            if (signatureData.dataUri) {
              uploadedSignature = {
                url: signatureData.dataUri,
                publicId: 'inline-signature',
                key: 'inline-signature',
              };
            }
          }
        }
      }

      // 2. Process proof photos (retain existing URLs, upload newly captured)
      const existingPhotos = photos
        .filter((uri) => uri.startsWith('http'))
        .map((url) => ({ url, publicId: '', key: '' }));
      const newPhotoUris = photos.filter((uri) => !uri.startsWith('http'));

      if (newPhotoUris.length > 0) {
        try {
          const photosRes = await uploadApi.uploadProofPhotos(newPhotoUris);
          const newlyUploaded = photosRes.data?.photos || [];
          uploadedPhotos = [...existingPhotos, ...newlyUploaded];
        } catch (uploadPhotosErr) {
          console.warn('Photos upload error:', uploadPhotosErr);
          uploadedPhotos = existingPhotos;
        }
      } else {
        uploadedPhotos = existingPhotos;
      }

      // 3. Assemble duty submission payload
      const effectiveDescription =
        workType === 'Other' && customWorkDetails.trim()
          ? `[Work: ${customWorkDetails.trim()}]\n${workDescription.trim()}`
          : workDescription.trim();

      const payload = {
        dutyDate,
        companyId: selectedCompanyId,
        customerName: customerName.trim(),
        customerPhoneNumber: customerPhone.trim(),
        machineName: machineName.trim(),
        workType,
        customWorkType: workType === 'Other' ? customWorkDetails.trim() : '',
        inTime,
        outTime,
        workDescription: effectiveDescription,
        customerSignature: uploadedSignature,
        customerProofPhotos: uploadedPhotos,
      };

      if (locationCoords) {
        payload.latitude = locationCoords.latitude;
        payload.longitude = locationCoords.longitude;
        payload.accuracy = locationCoords.accuracy;
        if (locationCoords.address) {
          payload.address = locationCoords.address;
        }
      }

      if (isEditing) {
        await dutyApi.updateDuty(dutyToEdit._id, payload);
        Alert.alert(
          'Work Report Updated',
          'Your service visit report has been updated successfully.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        await dutyApi.createDuty(payload);
        Alert.alert(
          'Work Report Submitted',
          'Your service visit report has been submitted successfully for manager review.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err) {
      setError(extractErrorMessage(err, isEditing ? 'Failed to update work report' : 'Failed to submit work report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={isEditing ? 'Edit Work Report' : 'Submit Work Report'}
        subtitle={isEditing ? `Report #${(dutyToEdit.dutyId || dutyToEdit._id.slice(-6)).toUpperCase()}` : 'Log service visit and customer verification'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorMessage message={error} />

          {/* Section: Visit Information */}
          <Card style={styles.formCard}>
            <Text style={styles.sectionHeader}>1. Service Visit Information</Text>

            <View style={styles.datePickerRow}>
              <View style={{ flex: 1 }}>
                <TextInputField
                  label="Work Date (YYYY-MM-DD)"
                  value={dutyDate}
                  onChangeText={setDutyDate}
                  placeholder="YYYY-MM-DD"
                  error={fieldErrors.dutyDate}
                  required
                />
              </View>
              <TouchableOpacity
                style={styles.calendarIconBtn}
                onPress={() => setDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Category Pill Selector: Office vs Client Company */}
            <Text style={styles.fieldLabel}>Work Location / Entity *</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.typePill,
                  companyCategory === 'office' && styles.typePillActive,
                ]}
                onPress={() => {
                  setCompanyCategory('office');
                  const officeComp = companies.find((c) => c.companyType === 'office');
                  if (officeComp) {
                    setSelectedCompanyId(officeComp._id);
                    if (fieldErrors.company) {
                      setFieldErrors((prev) => ({ ...prev, company: null }));
                    }
                  }
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
                  Office
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typePill,
                  companyCategory === 'client' && styles.typePillActive,
                ]}
                onPress={() => {
                  setCompanyCategory('client');
                  const currentComp = companies.find((c) => c._id === selectedCompanyId);
                  if (!currentComp || currentComp.companyType === 'office') {
                    const firstClient = companies.find((c) => c.companyType !== 'office');
                    if (firstClient) {
                      setSelectedCompanyId(firstClient._id);
                    } else {
                      setSelectedCompanyId('');
                    }
                  }
                  // Immediately open client companies list modal as requested
                  setCompanyDropdownVisible(true);
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

            {/* Company Selection via Searchable Dropdown */}
            <View style={styles.companyHeaderRow}>
              <Text style={styles.fieldLabel}>
                {companyCategory === 'office' ? 'Selected Office *' : 'Client Company *'}
              </Text>
              {Boolean(companyCategory === 'client') ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('CompanyForm')}
                  style={styles.addCompanyBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.addCompanyBtnText}>Add Company</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.companyDropdownBtn,
                fieldErrors.company && styles.companyDropdownBtnError,
              ]}
              onPress={() => setCompanyDropdownVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.companyDropdownLeft}>
                <Ionicons
                  name={companyCategory === 'office' ? 'business' : 'storefront'}
                  size={18}
                  color={selectedCompanyId ? COLORS.primary : COLORS.textMuted}
                />
                <View style={styles.companyDropdownTextWrap}>
                  <Text
                    style={[
                      styles.companyDropdownText,
                      !selectedCompanyId && styles.companyDropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {companies.find((c) => c._id === selectedCompanyId)?.companyName ||
                      (companyCategory === 'office'
                        ? 'Select Office / Branch...'
                        : 'Select Client Company...')}
                  </Text>
                  {companies.find((c) => c._id === selectedCompanyId)?.location ? (
                    <Text style={styles.companyDropdownSub} numberOfLines={1}>
                      Site: {companies.find((c) => c._id === selectedCompanyId).location}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {fieldErrors.company ? (
              <Text style={styles.errorText}>{fieldErrors.company}</Text>
            ) : null}

            <TextInputField
              label="Customer Contact Name"
              placeholder="e.g. Senthil Kumar (Factory Mgr)"
              value={customerName}
              onChangeText={setCustomerName}
              error={fieldErrors.customerName}
              required
            />

            <TextInputField
              label="Customer Phone Number (10 Digits)"
              placeholder="10-digit mobile number"
              value={customerPhone}
              onChangeText={(t) => {
                const cleaned = t.replace(/\D/g, '').slice(0, 10);
                setCustomerPhone(cleaned);
                if (fieldErrors.customerPhone) {
                  setFieldErrors((prev) => ({ ...prev, customerPhone: null }));
                }
              }}
              keyboardType="number-pad"
              maxLength={10}
              error={fieldErrors.customerPhone}
              required
            />

            <TextInputField
              label="Machine Name / Model"
              placeholder="e.g. CNC Spinning Frame M4"
              value={machineName}
              onChangeText={setMachineName}
              error={fieldErrors.machineName}
              required
            />

            {/* Work Type Selection */}
            <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Work Type *</Text>
            <View style={styles.workTypesWrap}>
              {APP_CONFIG.WORK_TYPES.map((type) => {
                const isSelected = workType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.workTypeChip, isSelected && styles.workTypeChipSelected]}
                    onPress={() => setWorkType(type)}
                  >
                    <Text
                      style={[
                        styles.workTypeChipText,
                        isSelected && styles.workTypeChipTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* If 'Other' selected, display custom work details input */}
            {workType === 'Other' && (
              <TextInputField
                label="Custom Work Details / Specification *"
                placeholder="e.g. Retrofit Calibration, PLC Programming, Sensor Replacement"
                value={customWorkDetails}
                onChangeText={(t) => {
                  setCustomWorkDetails(t);
                  if (fieldErrors.customWorkDetails) {
                    setFieldErrors((prev) => ({ ...prev, customWorkDetails: null }));
                  }
                }}
                error={fieldErrors.customWorkDetails}
                required
              />
            )}

            {/* Timings (Interactive Time Picker Modals) */}
            <View style={styles.timesRow}>
              <View style={styles.timeCol}>
                <Text style={styles.fieldLabel}>In Time (HH:mm) *</Text>
                <TouchableOpacity
                  style={[styles.timePickerCard, fieldErrors.inTime && styles.timePickerCardError]}
                  onPress={() => setInTimePickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.timePickerCardText}>{inTime || '09:30'}</Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
                {fieldErrors.inTime ? (
                  <Text style={styles.errorText}>{fieldErrors.inTime}</Text>
                ) : null}
              </View>

              <View style={styles.timeCol}>
                <Text style={styles.fieldLabel}>Out Time (HH:mm) *</Text>
                <TouchableOpacity
                  style={[styles.timePickerCard, fieldErrors.outTime && styles.timePickerCardError]}
                  onPress={() => setOutTimePickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.timePickerCardText}>{outTime || '17:30'}</Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
                {fieldErrors.outTime ? (
                  <Text style={styles.errorText}>{fieldErrors.outTime}</Text>
                ) : null}
              </View>
            </View>

            <TextInputField
              label="Work Description"
              placeholder="Describe repairs, parts replaced, diagnostic observations, or testing results..."
              value={workDescription}
              onChangeText={setWorkDescription}
              multiline
              numberOfLines={4}
              error={fieldErrors.workDescription}
              required
            />
          </Card>

          {/* Section: GPS Location */}
          <Card style={styles.formCard}>
            <Text style={styles.sectionHeader}>2. Service Location (GPS)</Text>
            <View style={styles.locationContainer}>
              {locationCoords ? (
                <View style={styles.locationCapturedBlock}>
                  {locationCoords.address ? (
                    <View style={styles.exactAddressCard}>
                      <Ionicons name="location" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exactAddressTitle}>Exact Location Name</Text>
                        <Text style={styles.exactAddressText}>{locationCoords.address}</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.locationCapturedRow}>
                    <Ionicons name="navigate-circle" size={24} color={COLORS.success} />
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationCoordText}>
                        Lat: {locationCoords.latitude.toFixed(5)}, Lon: {locationCoords.longitude.toFixed(5)}
                      </Text>
                      <Text style={styles.locationAccuracyText}>
                        Accuracy: ~{locationCoords.accuracy}m
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.viewMapChip}
                      onPress={() =>
                        openMapLocation(
                          locationCoords.latitude,
                          locationCoords.longitude,
                          customerName || 'Service Visit'
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.viewMapChipText}>View Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.locationEmptyText}>
                  Tag your visit location to verify attendance at the customer site.
                </Text>
              )}

              <SecondaryButton
                title={locationCoords ? 'Retake GPS Coordinates' : 'Capture Current Location'}
                icon={<Ionicons name="navigate-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />}
                onPress={handleCaptureLocation}
                loading={locating}
                style={{ marginTop: SPACING.sm }}
              />
            </View>
          </Card>

          {/* Section: Customer Signature & Photos */}
          <Card style={styles.formCard}>
            <Text style={styles.sectionHeader}>3. Verification & Proofs</Text>

            {/* Signature */}
            <Text style={styles.fieldLabel}>Customer Signature</Text>
            {signatureData ? (
              <View style={styles.signaturePreviewWrap}>
                <View style={styles.signaturePreviewContainer}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.signatureSuccessText}>Customer signature captured</Text>
                  <TouchableOpacity
                    onPress={() => setSignatureModalVisible(true)}
                    style={styles.resignLink}
                  >
                    <Text style={styles.resignLinkText}>Re-sign</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.signatureThumbBox}
                  onPress={handleOpenSignaturePreview}
                  activeOpacity={0.85}
                >
                  <SignatureImage
                    uri={signatureData.dataUri || signatureData.url}
                    height={100}
                    timestamp={signatureData.timestamp}
                    onPress={handleOpenSignaturePreview}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <SecondaryButton
                title="Open Signature Pad"
                icon={<Ionicons name="pencil-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />}
                onPress={() => setSignatureModalVisible(true)}
                style={{ marginBottom: SPACING.md }}
              />
            )}

            {/* Photos */}
            <View style={styles.photosHeader}>
              <Text style={styles.fieldLabel}>Proof Photos ({photos.length}/3)</Text>
              <TouchableOpacity onPress={handlePickPhoto}>
                <Text style={styles.addPhotoLink}>+ Attach Photo</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoThumbContainer}>
                  <TouchableOpacity
                    onPress={() => handleOpenPhotoPreview(uri, index)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <View style={styles.photoZoomHint}>
                      <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Ionicons name="close" size={14} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 3 && (
                <TouchableOpacity style={styles.addPhotoSlot} onPress={handlePickPhoto}>
                  <Ionicons name="camera-outline" size={28} color={COLORS.textMuted} />
                  <Text style={styles.addPhotoSlotText}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Card>

          <PrimaryButton
            title={isEditing ? 'Save Changes' : 'Submit Work Report'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!isFormComplete || loading}
            style={[
              styles.submitBtn,
              !isFormComplete && styles.submitBtnDisabled,
            ]}
          />
          {!isFormComplete ? (
            <Text style={styles.submitHintText}>
              * Fill all required fields above to enable submission
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <SignaturePadModal
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={(data) => setSignatureData(data)}
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

      <DatePickerModal
        visible={datePickerVisible}
        value={dutyDate}
        onSelect={setDutyDate}
        onClose={() => setDatePickerVisible(false)}
        title="Select Work Date"
      />

      <TimePickerModal
        visible={inTimePickerVisible}
        value={inTime}
        onSelect={setInTime}
        onClose={() => setInTimePickerVisible(false)}
        title="Select Check-In Time"
      />

      <TimePickerModal
        visible={outTimePickerVisible}
        value={outTime}
        onSelect={setOutTime}
        onClose={() => setOutTimePickerVisible(false)}
        title="Select Check-Out Time"
      />

      <DropdownPickerModal
        visible={companyDropdownVisible}
        onClose={() => setCompanyDropdownVisible(false)}
        title={companyCategory === 'office' ? 'Select Office / Branch' : 'Select Client Company'}
        searchPlaceholder="Search company by name or location..."
        selectedValue={selectedCompanyId}
        showAllOption={false}
        onSelect={(val, item) => {
          setSelectedCompanyId(val);
          if (fieldErrors.company) {
            setFieldErrors((prev) => ({ ...prev, company: null }));
          }
          if (item?.companyPhoneNumber && !customerPhone) {
            setCustomerPhone(item.companyPhoneNumber);
          }
        }}
        items={displayedCompanies.map((c) => ({
          label: c.companyName,
          value: c._id,
          id: c._id,
          companyPhoneNumber: c.companyPhoneNumber,
          subtitle: `${c.location || 'Location'}${c.companyPhoneNumber ? ' • ' + c.companyPhoneNumber : ''}`,
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  formCard: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  calendarIconBtn: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  companyDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.md,
  },
  companyDropdownBtnError: {
    borderColor: COLORS.danger,
    backgroundColor: '#FEF2F2',
  },
  companyDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: SPACING.sm,
  },
  companyDropdownTextWrap: {
    flex: 1,
  },
  companyDropdownText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  companyDropdownPlaceholder: {
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  companyDropdownSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chipScroll: {
    marginBottom: SPACING.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primarySubtle,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.primary,
  },
  workTypesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  workTypeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  workTypeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  workTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  workTypeChipTextSelected: {
    color: COLORS.textLight,
  },
  timesRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  timeCol: {
    flex: 1,
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  timePickerCardError: {
    borderColor: COLORS.danger,
  },
  timePickerCardText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationContainer: {
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  locationCapturedBlock: {
    gap: SPACING.xs,
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
    marginBottom: SPACING.xs,
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
  locationCapturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  locationInfo: {
    flex: 1,
  },
  locationCoordText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationAccuracyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  viewMapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  viewMapChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  locationEmptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  signaturePreviewWrap: {
    marginBottom: SPACING.md,
  },
  signaturePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  signatureThumbBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureSuccessText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
    flex: 1,
  },
  resignLink: {
    paddingHorizontal: SPACING.sm,
  },
  resignLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  addPhotoLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  photosScroll: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
  },
  photoThumbContainer: {
    position: 'relative',
    marginRight: SPACING.sm,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.md,
  },
  photoZoomHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 4,
    padding: 2,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.danger,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoSlot: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  addPhotoSlotText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    marginVertical: SPACING.xl,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  companyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  addCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  addCompanyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primarySubtle,
    backgroundColor: COLORS.surfaceAlt,
    gap: 6,
  },
  typePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typePillText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitHintText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.danger,
    marginTop: -SPACING.md,
    marginBottom: SPACING.xl,
    fontWeight: '500',
  },
});

export default DutyFormScreen;
