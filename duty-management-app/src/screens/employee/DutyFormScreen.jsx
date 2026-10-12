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
import taskApi from '../../api/taskApi';
import uploadApi from '../../api/uploadApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import SignaturePadModal from '../../components/SignaturePadModal';
import DatePickerModal from '../../components/DatePickerModal';
import TimePickerModal from '../../components/TimePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import ErrorMessage from '../../components/ErrorMessage';
import { getTodayDateString, formatISODateOnly } from '../../utils/dateUtils';
import { isValidPhone, isValidTimeFormat, isTimeOrderValid } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { APP_CONFIG } from '../../constants/config';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const DutyFormScreen = ({ navigation, route }) => {
  // Assigned task linkage state
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskDropdownVisible, setTaskDropdownVisible] = useState(false);

  // Form fields
  const [dutyDate, setDutyDate] = useState(getTodayDateString());
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [machineName, setMachineName] = useState('');
  const [workType, setWorkType] = useState('Maintenance');
  const [customWorkDetails, setCustomWorkDetails] = useState('');
  const [inTime, setInTime] = useState('09:30');
  const [outTime, setOutTime] = useState('17:30');
  const [workDescription, setWorkDescription] = useState('');

  // Modals state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [inTimePickerVisible, setInTimePickerVisible] = useState(false);
  const [outTimePickerVisible, setOutTimePickerVisible] = useState(false);

  // Signature state
  const [signatureData, setSignatureData] = useState(null);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);

  // Photos state (local uris)
  const [photos, setPhotos] = useState([]);

  // GPS Location state
  const [locationCoords, setLocationCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSelectTask = (taskId, itemObj) => {
    setSelectedTaskId(taskId || '');

    if (!taskId) {
      // "Not Mentioned" selected
      return;
    }

    const task = itemObj?.task || tasks.find((t) => t._id === taskId);
    if (task) {
      // 1. Auto-fill Company if matching name exists
      if (task.companyName && companies.length > 0) {
        const matched = companies.find(
          (c) => c.companyName?.trim().toLowerCase() === task.companyName.trim().toLowerCase()
        );
        if (matched) {
          setSelectedCompanyId(matched._id);
          if (fieldErrors.company) setFieldErrors((p) => ({ ...p, company: null }));
        }
      }

      // 2. Auto-fill Contact Phone
      if (task.phoneNumber) {
        const cleanPhone = task.phoneNumber.replace(/\D/g, '').slice(-10);
        setCustomerPhone(cleanPhone);
        if (fieldErrors.customerPhone) {
          setFieldErrors((p) => ({ ...p, customerPhone: null }));
        }
      }

      // 3. Auto-fill Customer / Client Name
      if (task.companyName) {
        setCustomerName(task.companyName);
        if (fieldErrors.customerName) {
          setFieldErrors((p) => ({ ...p, customerName: null }));
        }
      }

      // 4. Auto-fill Machine Name (from task title if not already set)
      if (task.taskName && !machineName) {
        setMachineName(task.taskName);
        if (fieldErrors.machineName) {
          setFieldErrors((p) => ({ ...p, machineName: null }));
        }
      }

      // 5. Auto-fill Work Description
      const descParts = [task.work, task.description].filter(Boolean);
      if (descParts.length > 0 && !workDescription) {
        setWorkDescription(descParts.join(' - '));
        if (fieldErrors.workDescription) {
          setFieldErrors((p) => ({ ...p, workDescription: null }));
        }
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadInitialData = async () => {
        try {
          const [compRes, taskRes] = await Promise.all([
            companyApi.getCompanies({ status: 'active', limit: 100 }).catch(() => ({ data: { companies: [] } })),
            taskApi.getMyTasks({ limit: 100 }).catch(() => ({ data: { tasks: [] } })),
          ]);

          let activeComps = [];
          if (compRes.data?.companies) {
            activeComps = compRes.data.companies;
            setCompanies(activeComps);
            if (!selectedCompanyId && activeComps.length > 0) {
              setSelectedCompanyId(activeComps[0]._id);
            }
          }

          if (taskRes.data?.tasks) {
            const taskList = taskRes.data.tasks;
            setTasks(taskList);

            // If arrived from a task action with route params
            const paramTaskId = route?.params?.taskId;
            if (paramTaskId && !selectedTaskId) {
              const found = taskList.find((t) => t._id === paramTaskId);
              if (found) {
                handleSelectTask(paramTaskId, { task: found });
              }
            }
          }
        } catch (err) {
          console.warn('Failed to load companies or tasks in duty form:', err);
        }
      };

      loadInitialData();
    }, [selectedCompanyId, route?.params?.taskId])
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

      setLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: Math.round(location.coords.accuracy || 0),
      });
      Alert.alert('Location Captured', `Coordinates: ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
    } catch (locErr) {
      Alert.alert('GPS Error', 'Unable to retrieve GPS coordinates. Ensure device location is turned on.');
    } finally {
      setLocating(false);
    }
  };

  // Image capture / selection
  const handlePickPhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit Reached', 'You can attach up to 5 proof photos per visit.');
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
            setPhotos((prev) => [...prev, ...newUris].slice(0, 5));
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

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      let uploadedSignature = { url: '', publicId: '' };
      let uploadedPhotos = [];

      // 1. Upload signature if captured
      if (signatureData?.dataUri) {
        try {
          const sigRes = await uploadApi.uploadSignature(signatureData.dataUri);
          if (sigRes.data?.signature) {
            uploadedSignature = sigRes.data.signature;
          }
        } catch (uploadSigErr) {
          console.warn('Signature upload error:', uploadSigErr);
        }
      }

      // 2. Upload proof photos if attached
      if (photos.length > 0) {
        try {
          const photosRes = await uploadApi.uploadProofPhotos(photos);
          if (photosRes.data?.photos) {
            uploadedPhotos = photosRes.data.photos;
          }
        } catch (uploadPhotosErr) {
          console.warn('Photos upload error:', uploadPhotosErr);
        }
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

      if (selectedTaskId) {
        payload.taskId = selectedTaskId;
      }

      if (locationCoords) {
        payload.latitude = locationCoords.latitude;
        payload.longitude = locationCoords.longitude;
        payload.accuracy = locationCoords.accuracy;
      }

      await dutyApi.createDuty(payload);

      Alert.alert(
        'Duty Report Submitted',
        'Your service visit report has been submitted successfully for manager review.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to submit duty report'));
    } finally {
      setLoading(false);
    }
  };

  const selectedTaskObj = tasks.find((t) => t._id === selectedTaskId);
  const taskDisplayName = selectedTaskObj
    ? `${selectedTaskObj.taskName} (${selectedTaskObj.companyName})`
    : 'Not Mentioned';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Submit Duty Report"
        subtitle="Log service visit and customer verification"
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

            {/* Assigned Task Picker */}
            <View style={styles.taskFieldWrap}>
              <View style={styles.taskFieldHeader}>
                <Text style={styles.fieldLabel}>Assigned Task</Text>
                {selectedTaskId ? (
                  <TouchableOpacity
                    onPress={() => handleSelectTask('', null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearTaskLink}>Clear Selection</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.taskDropdownBtn,
                  selectedTaskId ? styles.taskDropdownBtnActive : null,
                ]}
                onPress={() => setTaskDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={selectedTaskId ? 'clipboard' : 'clipboard-outline'}
                  size={18}
                  color={selectedTaskId ? COLORS.primary : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.taskDropdownBtnText,
                    selectedTaskId ? styles.taskDropdownBtnTextActive : null,
                  ]}
                  numberOfLines={1}
                >
                  {taskDisplayName}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
              <Text style={styles.taskHelperText}>
                {selectedTaskId
                  ? 'Task details auto-filled into form fields below.'
                  : 'Select an assigned task to auto-fill details, or leave as "Not Mentioned".'}
              </Text>
            </View>

            <View style={styles.datePickerRow}>
              <View style={{ flex: 1 }}>
                <TextInputField
                  label="Duty Date (YYYY-MM-DD)"
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

            {/* Company Selection */}
            <View style={styles.companyHeaderRow}>
              <Text style={styles.fieldLabel}>Client Company *</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CompanyForm')}
                style={styles.addCompanyBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.addCompanyBtnText}>Add Company</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {companies.map((c) => {
                const isSelected = selectedCompanyId === c._id;
                return (
                  <TouchableOpacity
                    key={c._id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelectedCompanyId(c._id)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {c.companyName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
                <View style={styles.locationCapturedRow}>
                  <Ionicons name="location" size={24} color={COLORS.success} />
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationCoordText}>
                      Lat: {locationCoords.latitude.toFixed(5)}, Lon: {locationCoords.longitude.toFixed(5)}
                    </Text>
                    <Text style={styles.locationAccuracyText}>
                      Accuracy: ~{locationCoords.accuracy}m
                    </Text>
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
              <View style={styles.signaturePreviewContainer}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                <Text style={styles.signatureSuccessText}>Customer signature captured</Text>
                <TouchableOpacity
                  onPress={() => setSignatureModalVisible(true)}
                  style={styles.resignLink}
                >
                  <Text style={styles.resignLinkText}>Re-sign</Text>
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
              <Text style={styles.fieldLabel}>Proof Photos ({photos.length}/5)</Text>
              <TouchableOpacity onPress={handlePickPhoto}>
                <Text style={styles.addPhotoLink}>+ Attach Photo</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoThumbContainer}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Ionicons name="close" size={14} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 5 && (
                <TouchableOpacity style={styles.addPhotoSlot} onPress={handlePickPhoto}>
                  <Ionicons name="camera-outline" size={28} color={COLORS.textMuted} />
                  <Text style={styles.addPhotoSlotText}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Card>

          <PrimaryButton
            title="Submit Duty Report"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <SignaturePadModal
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={(data) => setSignatureData(data)}
      />

      <DatePickerModal
        visible={datePickerVisible}
        value={dutyDate}
        onSelect={setDutyDate}
        onClose={() => setDatePickerVisible(false)}
        title="Select Duty Date"
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
        visible={taskDropdownVisible}
        title="Select Assigned Task"
        options={[
          {
            value: '',
            label: 'Not Mentioned',
            subtitle: 'Direct visit - enter details manually',
          },
          ...tasks.map((t) => ({
            value: t._id,
            label: `${t.taskName || 'Task'} (${t.companyName || 'Company'})`,
            subtitle: `${t.work || 'Work'} • ${t.phoneNumber || 'No phone'}`,
            task: t,
          })),
        ]}
        selectedValue={selectedTaskId}
        onSelect={(val, fullItem) => {
          handleSelectTask(val, fullItem);
          setTaskDropdownVisible(false);
        }}
        onClose={() => setTaskDropdownVisible(false)}
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
  locationEmptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  signaturePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
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
  taskFieldWrap: {
    marginBottom: SPACING.md,
  },
  taskFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  clearTaskLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  taskDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: 8,
  },
  taskDropdownBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySubtle,
  },
  taskDropdownBtnText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  taskDropdownBtnTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  taskHelperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});

export default DutyFormScreen;
