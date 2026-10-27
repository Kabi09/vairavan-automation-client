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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import companyApi from '../../api/companyApi';
import clientApi from '../../api/clientApi';
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
import DropdownPickerModal from '../../components/DropdownPickerModal';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';
import { getTodayDateString, formatISODateOnly, formatDate } from '../../utils/dateUtils';
import { isValidPhone } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { reverseGeocodeCoords, openMapLocation } from '../../utils/locationUtils';
import { APP_CONFIG } from '../../constants/config';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

const PRESET_FEATURES = ['PLC', 'HMI', 'VFD', 'Sensor', 'Servo', 'HDM', 'Wiring', 'Pneumatics'];

export const DutyFormScreen = ({ navigation, route }) => {
  const dutyToEdit = route?.params?.dutyToEdit;
  const isEditing = Boolean(dutyToEdit);

  // Check-In status state (if editing historical submitted report, consider checked-in)
  const [checkingSession, setCheckingSession] = useState(!isEditing);
  const [isCheckedIn, setIsCheckedIn] = useState(Boolean(dutyToEdit));
  const [activeDutyId, setActiveDutyId] = useState(() => dutyToEdit?._id || null);
  const [activeCheckInTime, setActiveCheckInTime] = useState(() => dutyToEdit?.checkInTime || dutyToEdit?.inTime || '');

  // Form fields
  const [dutyDate, setDutyDate] = useState(() => {
    if (dutyToEdit?.dutyDate) {
      return formatISODateOnly(dutyToEdit.dutyDate) || String(dutyToEdit.dutyDate).slice(0, 10);
    }
    return getTodayDateString();
  });
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [companyCategory, setCompanyCategory] = useState(() => {
    if (dutyToEdit?.dutyType) return dutyToEdit.dutyType;
    if (dutyToEdit?.company?.companyType) return dutyToEdit.company.companyType;
    return 'office'; // default Office
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    return dutyToEdit?.company?._id || dutyToEdit?.company || '';
  });
  const [selectedClientId, setSelectedClientId] = useState(() => {
    return dutyToEdit?.client?._id || dutyToEdit?.client || '';
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
  const [workDescription, setWorkDescription] = useState(() => {
    if (!dutyToEdit?.workDescription) return '';
    return dutyToEdit.workDescription.replace(/^\[Work:\s*[^\]]+\]\n*/, '');
  });

  // Features state (e.g. ['PLC', 'HDM'])
  const [features, setFeatures] = useState(() => {
    if (Array.isArray(dutyToEdit?.features) && dutyToEdit.features.length > 0) {
      return dutyToEdit.features;
    }
    return [];
  });
  const [customFeatureInput, setCustomFeatureInput] = useState('');

  // Manpower members state
  const [manpowerMembers, setManpowerMembers] = useState(() => {
    if (Array.isArray(dutyToEdit?.manpowerMembers) && dutyToEdit.manpowerMembers.length > 0) {
      return dutyToEdit.manpowerMembers;
    }
    return [];
  });

  // Modals state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [companyDropdownVisible, setCompanyDropdownVisible] = useState(false);
  const [clientDropdownVisible, setClientDropdownVisible] = useState(false);

  // Inline Add Company Modal State
  const [addCompanyModalVisible, setAddCompanyModalVisible] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyLocation, setNewCompanyLocation] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [savingNewCompany, setSavingNewCompany] = useState(false);

  // Inline Add Client Modal State
  const [addClientModalVisible, setAddClientModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [savingNewClient, setSavingNewClient] = useState(false);

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

  // Photos state (local uris or existing urls, max 3)
  const [photos, setPhotos] = useState(() => {
    if (dutyToEdit?.customerProofPhotos?.length > 0) {
      return dutyToEdit.customerProofPhotos.map((p) => p.url);
    }
    return [];
  });

  // GPS Location states - Separated for Check-In and Check-Out!
  const [checkInLocationCoords, setCheckInLocationCoords] = useState(() => {
    if (dutyToEdit?.checkInLocation?.latitude) {
      return {
        latitude: dutyToEdit.checkInLocation.latitude,
        longitude: dutyToEdit.checkInLocation.longitude,
        accuracy: dutyToEdit.checkInLocation.accuracy || 0,
        address: dutyToEdit.checkInLocation.address || '',
      };
    }
    if (dutyToEdit?.location?.latitude && !dutyToEdit?.checkOutLocation?.latitude) {
      return {
        latitude: dutyToEdit.location.latitude,
        longitude: dutyToEdit.location.longitude,
        accuracy: dutyToEdit.location.accuracy || 0,
        address: dutyToEdit.location.address || '',
      };
    }
    return null;
  });

  const [checkOutLocationCoords, setCheckOutLocationCoords] = useState(() => {
    if (dutyToEdit?.checkOutLocation?.latitude) {
      return {
        latitude: dutyToEdit.checkOutLocation.latitude,
        longitude: dutyToEdit.checkOutLocation.longitude,
        accuracy: dutyToEdit.checkOutLocation.accuracy || 0,
        address: dutyToEdit.checkOutLocation.address || '',
      };
    }
    return null; // Fresh for checkout!
  });

  const [locatingCheckIn, setLocatingCheckIn] = useState(false);
  const [locatingCheckOut, setLocatingCheckOut] = useState(false);

  // Dedicated Add / Edit Manpower Member Modal State
  const [manpowerModalVisible, setManpowerModalVisible] = useState(false);
  const [editingManpowerIndex, setEditingManpowerIndex] = useState(null);
  const [memberModalName, setMemberModalName] = useState('');
  const [memberModalPhone, setMemberModalPhone] = useState('');
  const [memberModalRole, setMemberModalRole] = useState('');
  const [memberModalDescription, setMemberModalDescription] = useState('');
  const [memberModalError, setMemberModalError] = useState('');

  // Submission / Loading state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Helper to determine if company is office
  const isOfficeCompany = (c) => {
    if (!c) return false;
    const type = String(c.companyType || '').trim().toLowerCase();
    const name = String(c.companyName || '').trim().toLowerCase();
    return type === 'office' || name.includes('office');
  };

  // 1. Check for active duty check-in on focus (if not editing an existing report)
  useFocusEffect(
    useCallback(() => {
      if (isEditing) return;

      const checkActiveSession = async () => {
        setCheckingSession(true);
        try {
          const res = await dutyApi.getActiveCheckIn().catch(() => null);
          if (res?.data?.activeDuty) {
            const active = res.data.activeDuty;
            setIsCheckedIn(true);
            setActiveDutyId(active._id);
            setActiveCheckInTime(active.checkInTime || active.inTime || '');
            setSelectedCompanyId(active.company?._id || active.company || '');
            if (active.client?._id || active.client) {
              setSelectedClientId(active.client?._id || active.client);
            }
            if (active.dutyType) {
              setCompanyCategory(active.dutyType);
            } else if (active.company?.companyType) {
              setCompanyCategory(active.company.companyType);
            }
            if (active.customerName) setCustomerName(active.customerName);
            if (active.customerPhoneNumber) setCustomerPhone(active.customerPhoneNumber);
            if (active.machineName) setMachineName(active.machineName);
            if (active.workType) setWorkType(active.workType);
            if (active.customWorkType) setCustomWorkDetails(active.customWorkType);
            if (active.workDescription) setWorkDescription(active.workDescription);
            if (Array.isArray(active.features) && active.features.length > 0) {
              setFeatures(active.features);
            }
            if (Array.isArray(active.manpowerMembers) && active.manpowerMembers.length > 0) {
              setManpowerMembers(active.manpowerMembers);
            }
            if (active.checkInLocation?.latitude) {
              setCheckInLocationCoords({
                latitude: active.checkInLocation.latitude,
                longitude: active.checkInLocation.longitude,
                accuracy: active.checkInLocation.accuracy || 0,
                address: active.checkInLocation.address || '',
              });
            } else if (active.location?.latitude) {
              setCheckInLocationCoords({
                latitude: active.location.latitude,
                longitude: active.location.longitude,
                accuracy: active.location.accuracy || 0,
                address: active.location.address || '',
              });
            }
            // Fresh checkout location: do not copy check-in location!
            setCheckOutLocationCoords(null);
          } else {
            setIsCheckedIn(false);
            setActiveDutyId(null);
            setActiveCheckInTime('');
            setCheckInLocationCoords(null);
            setCheckOutLocationCoords(null);
          }
        } catch (err) {
          console.warn('Error checking active duty check-in:', err);
          setIsCheckedIn(false);
          setActiveDutyId(null);
          setActiveCheckInTime('');
          setCheckInLocationCoords(null);
          setCheckOutLocationCoords(null);
        } finally {
          setCheckingSession(false);
        }
      };

      checkActiveSession();
    }, [isEditing])
  );

  // 2. Fetch companies on mount / focus
  useFocusEffect(
    useCallback(() => {
      const loadCompanies = async () => {
        try {
          const compRes = await companyApi.getCompanies({ status: 'active', limit: 200 }).catch(() => ({ data: { companies: [] } }));
          const companyList = compRes.data?.data?.companies || compRes.data?.companies || [];
          if (companyList.length > 0) {
            setCompanies(companyList);

            // If no company selected and in office mode, pre-select default office
            if (!selectedCompanyId && !dutyToEdit && companyCategory === 'office') {
              const defaultOffice = companyList.find((c) => isOfficeCompany(c));
              if (defaultOffice) {
                setSelectedCompanyId(defaultOffice._id);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to load companies in duty form:', err);
        }
      };

      loadCompanies();
    }, [selectedCompanyId, companyCategory, dutyToEdit])
  );

  // 3. Automatically fetch and filter clients when selectedCompanyId changes
  useEffect(() => {
    if (!selectedCompanyId || companyCategory === 'office') {
      setClients([]);
      return;
    }

    const loadClients = async () => {
      try {
        const res = await clientApi.getClients({ companyId: selectedCompanyId, status: 'active' }).catch(() => ({ data: { data: { clients: [] } } }));
        const clientList = res.data?.data?.clients || res.data?.clients || [];
        setClients(clientList);
      } catch (err) {
        console.warn('Failed to load clients for company:', err);
      }
    };

    loadClients();
  }, [selectedCompanyId, companyCategory]);

  // Auto-request location permissions and capture on focus if not yet set in check-in mode
  useEffect(() => {
    if (!isCheckedIn && !checkInLocationCoords && !locatingCheckIn) {
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const accuracy = Math.round(loc.coords.accuracy || 0);
            const address = await reverseGeocodeCoords(lat, lng);
            setCheckInLocationCoords({
              latitude: lat,
              longitude: lng,
              accuracy,
              address: address || '',
            });
          }
        } catch (e) {
          // Background location attempt
        }
      })();
    }
  }, [isCheckedIn]);

  // Check-In GPS Location capture
  const handleCaptureCheckInLocation = async () => {
    setLocatingCheckIn(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to tag check-in / service visit coordinates.'
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

      setCheckInLocationCoords({
        latitude: lat,
        longitude: lng,
        accuracy,
        address: address || '',
      });

      if (fieldErrors.checkInLocation || fieldErrors.location) {
        setFieldErrors((prev) => ({ ...prev, checkInLocation: null, location: null }));
      }

      Alert.alert(
        'Check-In Location Captured',
        address
          ? `${address}\n\nCoordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          : `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch (locErr) {
      Alert.alert('GPS Error', 'Unable to retrieve GPS coordinates. Ensure device location is turned on.');
    } finally {
      setLocatingCheckIn(false);
    }
  };

  // Check-Out GPS Location capture (Freshly captured at checkout time!)
  const handleCaptureCheckOutLocation = async () => {
    setLocatingCheckOut(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to tag check-out coordinates.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      const accuracy = Math.round(location.coords.accuracy || 0);

      const address = await reverseGeocodeCoords(lat, lng);

      const freshCheckoutLoc = {
        latitude: lat,
        longitude: lng,
        accuracy,
        address: address || '',
      };
      setCheckOutLocationCoords(freshCheckoutLoc);

      Alert.alert(
        'Checkout Location Captured',
        address
          ? `${address}\n\nCoordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          : `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch (locErr) {
      Alert.alert('GPS Error', 'Unable to retrieve checkout GPS coordinates. Ensure device location is turned on.');
    } finally {
      setLocatingCheckOut(false);
    }
  };

  // Inline Add Company Submit
  const handleSaveNewCompany = async () => {
    if (!newCompanyName.trim()) {
      Alert.alert('Required', 'Please enter company name');
      return;
    }
    if (!newCompanyLocation.trim()) {
      Alert.alert('Required', 'Please enter company site location');
      return;
    }

    setSavingNewCompany(true);
    try {
      const res = await companyApi.createCompany({
        companyName: newCompanyName.trim(),
        location: newCompanyLocation.trim(),
        companyPhoneNumber: newCompanyPhone.trim(),
        companyType: 'client',
      });
      const createdComp = res.data?.data?.company || res.data?.company;
      if (createdComp) {
        setCompanies((prev) => [createdComp, ...prev]);
        setSelectedCompanyId(createdComp._id);
        setSelectedClientId('');
        setCustomerName('');
        setCustomerPhone('');
        setNewCompanyName('');
        setNewCompanyLocation('');
        setNewCompanyPhone('');
        setAddCompanyModalVisible(false);
        if (fieldErrors.company) {
          setFieldErrors((prev) => ({ ...prev, company: null }));
        }
        Alert.alert('Company Added', `${createdComp.companyName} created and selected!`);
      }
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to add company'));
    } finally {
      setSavingNewCompany(false);
    }
  };

  // Inline Add Client Submit
  const handleSaveNewClient = async () => {
    if (!selectedCompanyId) {
      Alert.alert('Select Company First', 'Please select a client company before adding a client');
      return;
    }
    if (!newClientName.trim()) {
      Alert.alert('Required', 'Please enter client contact name');
      return;
    }

    setSavingNewClient(true);
    try {
      const res = await clientApi.createClient({
        companyId: selectedCompanyId,
        clientName: newClientName.trim(),
        clientPhoneNumber: newClientPhone.trim(),
      });
      const createdClient = res.data?.data?.client || res.data?.client;
      if (createdClient) {
        setClients((prev) => [createdClient, ...prev]);
        setSelectedClientId(createdClient._id);
        setCustomerName(createdClient.clientName);
        if (createdClient.clientPhoneNumber) {
          setCustomerPhone(createdClient.clientPhoneNumber);
        }
        setNewClientName('');
        setNewClientPhone('');
        setAddClientModalVisible(false);
        if (fieldErrors.client) {
          setFieldErrors((prev) => ({ ...prev, client: null }));
        }
        Alert.alert('Client Added', `${createdClient.clientName} linked to company!`);
      }
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to add client'));
    } finally {
      setSavingNewClient(false);
    }
  };

  // Handle Check-In (Workflow 1 & 2)
  const handleCheckIn = async () => {
    setError('');
    const errors = {};

    if (!selectedCompanyId) {
      errors.company =
        companyCategory === 'office' ? 'Please select an office' : 'Please select a client company';
    } else {
      const comp = companies.find((c) => c._id === selectedCompanyId);
      if (companyCategory === 'client' && isOfficeCompany(comp)) {
        errors.company = 'Please select a valid client company (not an office)';
      }
    }

    if (companyCategory === 'client' && !selectedClientId && !customerName.trim()) {
      errors.client = 'Please select a client contact or add a new client';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      Alert.alert('Incomplete Check-In', 'Please select both company and client contact to proceed.');
      return;
    }

    setLoading(true);
    try {
      // Auto-capture GPS coordinates if missing
      let currentCoords = checkInLocationCoords;
      if (!currentCoords?.latitude) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const accuracy = Math.round(loc.coords.accuracy || 0);
            const address = await reverseGeocodeCoords(lat, lng);
            currentCoords = {
              latitude: lat,
              longitude: lng,
              accuracy,
              address: address || '',
            };
            setCheckInLocationCoords(currentCoords);
          }
        } catch (gpsErr) {
          console.warn('GPS auto-fetch on checkin error:', gpsErr);
        }
      }

      // Strictly enforce compulsory GPS coordinates for check-in
      if (!currentCoords?.latitude || !currentCoords?.longitude) {
        setLoading(false);
        setFieldErrors((prev) => ({
          ...prev,
          checkInLocation: 'GPS location is compulsory to check in. Please capture your location.',
        }));
        Alert.alert(
          'GPS Location Required *',
          'GPS location is strictly compulsory for Duty Check-In. Please turn on device GPS / Location and tap "Capture Check-In Location" to proceed.'
        );
        return;
      }

      const checkInPayload = {
        dutyDate,
        dutyType: companyCategory,
        companyId: selectedCompanyId,
        clientId: selectedClientId || undefined,
        customerName: companyCategory === 'office' ? 'Office' : (customerName.trim() || undefined),
        customerPhoneNumber: companyCategory === 'office' ? '' : (customerPhone.trim() || undefined),
        latitude: currentCoords?.latitude,
        longitude: currentCoords?.longitude,
        accuracy: currentCoords?.accuracy,
        address: currentCoords?.address,
      };

      const res = await dutyApi.checkIn(checkInPayload);
      const createdDuty = res.data?.data?.duty || res.data?.duty;
      if (createdDuty) {
        setIsCheckedIn(true);
        setActiveDutyId(createdDuty._id);
        setActiveCheckInTime(createdDuty.checkInTime || createdDuty.inTime || '');
        // Explicitly start checkout location as fresh/empty
        setCheckOutLocationCoords(null);
        Alert.alert(
          'Check-In Successful',
          `Checked in at ${companyCategory === 'office' ? 'Office' : customerName || 'Client Site'}!`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('EmployeeMainTabs', { screen: 'DashboardTab' });
              },
            },
          ]
        );
      }
    } catch (err) {
      const msg = extractErrorMessage(err, 'Check-in failed');
      setError(msg);
      Alert.alert('Check-In Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Features helpers
  const handleTogglePresetFeature = (name) => {
    if (features.includes(name)) {
      setFeatures((prev) => prev.filter((f) => f !== name));
    } else {
      setFeatures((prev) => [...prev, name]);
    }
  };

  const handleAddCustomFeature = () => {
    const trimmed = customFeatureInput.trim();
    if (!trimmed) return;
    if (!features.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      setFeatures((prev) => [...prev, trimmed]);
    }
    setCustomFeatureInput('');
  };

  const handleRemoveFeature = (index) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  // Manpower Members helpers - Dedicated Modal flow
  const handleOpenAddManpower = () => {
    setEditingManpowerIndex(null);
    setMemberModalName('');
    setMemberModalPhone('');
    setMemberModalRole('');
    setMemberModalDescription('');
    setMemberModalError('');
    setManpowerModalVisible(true);
  };

  const handleOpenEditManpower = (index) => {
    const member = manpowerMembers[index];
    if (!member) return;
    setEditingManpowerIndex(index);
    setMemberModalName(member.name || '');
    setMemberModalPhone(member.phoneNumber || member.phone || '');
    setMemberModalRole(member.role || member.description || '');
    setMemberModalDescription(member.description || '');
    setMemberModalError('');
    setManpowerModalVisible(true);
  };

  const handleSaveManpowerModal = () => {
    if (!memberModalName.trim()) {
      setMemberModalError('Please enter member name');
      return;
    }

    const memberData = {
      name: memberModalName.trim(),
      phoneNumber: memberModalPhone.trim(),
      role: memberModalRole.trim(),
      description: memberModalDescription.trim() || memberModalRole.trim(),
    };

    if (editingManpowerIndex !== null) {
      setManpowerMembers((prev) => {
        const updated = [...prev];
        updated[editingManpowerIndex] = memberData;
        return updated;
      });
    } else {
      setManpowerMembers((prev) => [...prev, memberData]);
    }

    setManpowerModalVisible(false);
  };

  const handleRemoveManpower = (index) => {
    setManpowerMembers((prev) => prev.filter((_, i) => i !== index));
  };

  // Photo helpers (up to 3 photos)
  const handlePickPhoto = async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit Reached', 'You can attach up to 3 proof photos.');
      return;
    }

    Alert.alert('Attach Proof Photo', 'Choose photo source', [
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
            setPhotos((prev) => [...prev, result.assets[0].uri]);
          }
        },
      },
      {
        text: 'Photo Gallery',
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

  // Lightbox preview openers
  const handleOpenPhotoPreview = (uri, index) => {
    setPreviewImageUri(uri);
    setPreviewTitle(`Proof Photo #${index + 1}`);
    setPreviewSubtitle(customerName || 'Service Verification');
    setPreviewTimestamp(dutyDate || '');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  const handleOpenSignaturePreview = () => {
    if (!signatureData?.dataUri && !signatureData?.url) return;
    setPreviewImageUri(signatureData?.dataUri || signatureData?.url || '');
    setPreviewTitle(companyCategory === 'office' ? 'Office Sign-Off' : 'Customer Signature');
    setPreviewSubtitle(customerName || 'Service Verification');
    setPreviewTimestamp(signatureData?.timestamp || '');
    setPreviewIsSignature(true);
    setPreviewModalVisible(true);
  };

  // Work Details Submission & Checkout
  const handleCheckoutOrSubmit = async () => {
    if (!activeDutyId && !isEditing) {
      Alert.alert(
        'Check-In Required *',
        'Check-in is compulsory! You must check in first before checking out or submitting work details.'
      );
      return;
    }

    if (!machineName.trim()) {
      Alert.alert('Required Field', 'Please enter machine name before submitting work details.');
      return;
    }
    if (!workDescription.trim()) {
      Alert.alert('Required Field', 'Please enter work description before submitting work details.');
      return;
    }
    if (workType === 'Other' && !customWorkDetails.trim()) {
      Alert.alert('Required Field', 'Please specify the custom work details.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let uploadedSignature = { url: '', publicId: '', key: '' };
      let uploadedPhotos = [];

      // 1. Process signature if provided
      if (signatureData) {
        if (signatureData.url && signatureData.url.startsWith('http') && !signatureData.svgPaths) {
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

      // 2. Process proof photos
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
          uploadedPhotos = existingPhotos;
        }
      } else {
        uploadedPhotos = existingPhotos;
      }

      const effectiveDescription =
        workType === 'Other' && customWorkDetails.trim()
          ? `[Work: ${customWorkDetails.trim()}]\n${workDescription.trim()}`
          : workDescription.trim();

      const sanitizedFeatures = features.filter((f) => f && f.trim()).map((f) => f.trim());
      const sanitizedManpower = manpowerMembers.filter((m) => m && m.name && m.name.trim());

      const checkoutPayload = {
        dutyId: activeDutyId,
        machineName: machineName.trim(),
        workType,
        customWorkType: workType === 'Other' ? customWorkDetails.trim() : '',
        workDescription: effectiveDescription,
        features: sanitizedFeatures,
        manpowerMembers: sanitizedManpower,
        customerSignature: uploadedSignature,
        customerProofPhotos: uploadedPhotos,
      };

      let finalCheckOutLoc = checkOutLocationCoords;
      if (!finalCheckOutLoc?.latitude) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const accuracy = Math.round(loc.coords.accuracy || 0);
            const address = await reverseGeocodeCoords(lat, lng);
            finalCheckOutLoc = {
              latitude: lat,
              longitude: lng,
              accuracy,
              address: address || '',
            };
            setCheckOutLocationCoords(finalCheckOutLoc);
          }
        } catch (checkoutGpsErr) {
          console.warn('GPS auto-fetch on checkout error:', checkoutGpsErr);
        }
      }

      if (finalCheckOutLoc?.latitude) {
        checkoutPayload.checkOutLocation = finalCheckOutLoc;
        checkoutPayload.latitude = finalCheckOutLoc.latitude;
        checkoutPayload.longitude = finalCheckOutLoc.longitude;
        checkoutPayload.accuracy = finalCheckOutLoc.accuracy;
        checkoutPayload.address = finalCheckOutLoc.address;
      }

      if (isEditing) {
        await dutyApi.updateDuty(dutyToEdit._id, checkoutPayload);
        Alert.alert('Report Updated', 'Your work report has been updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await dutyApi.checkOut(checkoutPayload);
        // Reset all states so subsequent "New Work" starts fresh
        setIsCheckedIn(false);
        setActiveDutyId(null);
        setActiveCheckInTime('');
        setMachineName('');
        setWorkDescription('');
        setFeatures([]);
        setCustomFeatureInput('');
        setManpowerMembers([]);
        setSignatureData(null);
        setPhotos([]);
        setCheckInLocationCoords(null);
        setCheckOutLocationCoords(null);
        setSelectedCompanyId('');
        setSelectedClientId('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomWorkDetails('');
        setFieldErrors({});

        Alert.alert(
          'Checkout Complete',
          'Checked out and work details submitted successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to complete checkout'));
    } finally {
      setLoading(false);
    }
  };

  const displayedCompanies = companies.filter((c) => {
    if (companyCategory === 'office') return isOfficeCompany(c);
    return !isOfficeCompany(c);
  });

  const selectedCompany = companies.find((c) => String(c._id) === String(selectedCompanyId));
  const selectedClient = clients.find((c) => String(c._id) === String(selectedClientId));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={isEditing ? 'Edit Work Report' : isCheckedIn ? 'Work Details & Checkout' : 'Employee Check-In'}
        subtitle={
          isEditing
            ? `Report #${(dutyToEdit.dutyId || dutyToEdit._id.slice(-6)).toUpperCase()}`
            : isCheckedIn
            ? `Active Session • Checked in at ${activeCheckInTime || 'Today'}`
            : companyCategory === 'office'
            ? 'Select Office & Check In'
            : 'Select Client Company & Check In'
        }
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

          {/* Dynamic Switch: Checking Session Loader -> Stage 1 Check-In -> Stage 2 Work Details */}
          {checkingSession ? (
            <View style={{ paddingVertical: SPACING.xxl, alignItems: 'center' }}>
              <LoadingIndicator message="Verifying duty session..." />
            </View>
          ) : !isCheckedIn ? (
            <Card style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="log-in-outline" size={20} color={COLORS.primary} />
                <Text style={styles.sectionHeader}>Step 1: Duty Check-In</Text>
              </View>

              {/* Duty Date (India Standard Time - Non-Editable) */}
              <View style={styles.fixedDateCard}>
                <View style={styles.fixedDateIconWrap}>
                  <Ionicons name="calendar" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fixedDateLabel}>Duty Date (IST)</Text>
                  <Text style={styles.fixedDateValue}>{formatDate(dutyDate) || dutyDate}</Text>
                </View>
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Today</Text>
                </View>
              </View>

              {/* Duty Type Selector: Office vs Client Company */}
              <Text style={styles.fieldLabel}>Duty Type / Entity *</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.typePill,
                    companyCategory === 'office' && styles.typePillActive,
                  ]}
                  onPress={() => {
                    setCompanyCategory('office');
                    const officeComp = companies.find((c) => isOfficeCompany(c));
                    if (officeComp) {
                      setSelectedCompanyId(officeComp._id);
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
                    Office Duty
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
                    if (!currentComp || isOfficeCompany(currentComp)) {
                      setSelectedCompanyId('');
                      setSelectedClientId('');
                      setCustomerName('');
                      setCustomerPhone('');
                    }
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

              {/* Company Selection Dropdown + Inline Add Company */}
              <View style={styles.companyHeaderRow}>
                <Text style={styles.fieldLabel}>
                  {companyCategory === 'office' ? 'Selected Office *' : 'Client Company *'}
                </Text>
                {companyCategory === 'client' ? (
                  <TouchableOpacity
                    onPress={() => setAddCompanyModalVisible(true)}
                    style={styles.addCompanyBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.addCompanyBtnText}>+ Add Company</Text>
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
                      {selectedCompany?.companyName ||
                        (companyCategory === 'office'
                          ? 'Select Office / Branch...'
                          : 'Select Client Company...')}
                    </Text>
                    {selectedCompany?.location ? (
                      <Text style={styles.companyDropdownSub} numberOfLines={1}>
                        Site: {selectedCompany.location}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
              {fieldErrors.company ? (
                <Text style={styles.errorText}>{fieldErrors.company}</Text>
              ) : null}

              {/* Client Selection (ONLY for Client Company) + Inline Add Client */}
              {companyCategory === 'client' ? (
                <View style={{ marginTop: SPACING.md }}>
                  <View style={styles.companyHeaderRow}>
                    <Text style={styles.fieldLabel}>Client Contact Person *</Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (!selectedCompanyId) {
                          Alert.alert('Select Company', 'Please select a company before adding a client');
                          return;
                        }
                        setAddClientModalVisible(true);
                      }}
                      style={styles.addCompanyBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="person-add-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.addCompanyBtnText}>+ Add Client</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.companyDropdownBtn,
                      fieldErrors.client && styles.companyDropdownBtnError,
                    ]}
                    onPress={() => {
                      if (!selectedCompanyId) {
                        Alert.alert('Company Required', 'Please select a client company first.');
                        return;
                      }
                      setClientDropdownVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.companyDropdownLeft}>
                      <Ionicons
                        name="person"
                        size={18}
                        color={selectedClientId || customerName ? COLORS.primary : COLORS.textMuted}
                      />
                      <View style={styles.companyDropdownTextWrap}>
                        <Text
                          style={[
                            styles.companyDropdownText,
                            !selectedClientId && !customerName && styles.companyDropdownPlaceholder,
                          ]}
                          numberOfLines={1}
                        >
                          {selectedClient
                            ? `${selectedClient.clientName}${selectedClient.clientPhoneNumber ? ` (${selectedClient.clientPhoneNumber})` : ''}`
                            : customerName || 'Select Client Contact Person...'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  {fieldErrors.client ? (
                    <Text style={styles.errorText}>{fieldErrors.client}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* GPS Coordinates Capture for Check-In (Compulsory) */}
              <View style={[styles.gpsContainer, fieldErrors.checkInLocation && styles.gpsContainerError]}>
                <View style={styles.gpsHeaderRow}>
                  <Ionicons
                    name="navigate-circle"
                    size={20}
                    color={fieldErrors.checkInLocation ? '#DC2626' : COLORS.primary}
                  />
                  <Text style={styles.gpsTitle}>Check-In GPS Location *</Text>
                  {checkInLocationCoords ? (
                    <View style={styles.gpsVerifiedBadge}>
                      <Ionicons name="checkmark-circle" size={13} color="#059669" />
                      <Text style={styles.gpsVerifiedText}>Ready</Text>
                    </View>
                  ) : (
                    <View style={styles.gpsMandatoryBadge}>
                      <Text style={styles.gpsMandatoryBadgeText}>Mandatory</Text>
                    </View>
                  )}
                </View>

                {checkInLocationCoords?.address ? (
                  <View style={styles.resolvedAddressBox}>
                    <Text style={styles.resolvedAddressLabel}>Address:</Text>
                    <Text style={styles.resolvedAddressText}>{checkInLocationCoords.address}</Text>
                  </View>
                ) : null}

                {fieldErrors.checkInLocation ? (
                  <Text style={[styles.errorText, { marginTop: 4, marginBottom: 2 }]}>
                    {fieldErrors.checkInLocation}
                  </Text>
                ) : null}

                <SecondaryButton
                  title={
                    locatingCheckIn
                      ? 'Fetching GPS...'
                      : checkInLocationCoords
                      ? 'Update Check-In Location'
                      : 'Capture Check-In Location *'
                  }
                  onPress={handleCaptureCheckInLocation}
                  loading={locatingCheckIn}
                  icon={locatingCheckIn ? undefined : 'location-outline'}
                  style={{ marginTop: SPACING.sm }}
                />
              </View>

              {/* Check-In Action Button */}
              <PrimaryButton
                title="Check In"
                onPress={handleCheckIn}
                loading={loading}
                icon="log-in-outline"
                style={{ marginTop: SPACING.lg }}
              />
            </Card>
          ) : (
            /* STAGE 2: CHECKED-IN SESSION & WORK DETAILS FORM */
            <>
              {/* Checked-In Active Status Card */}
              <Card style={styles.activeCheckInCard}>
                <View style={styles.activeCheckInRow}>
                  <View style={styles.activeDot} />
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.activeCheckInTitle}>
                      {companyCategory === 'office' ? 'Office Duty Session' : 'Client Duty Session'}
                    </Text>
                    <Text style={styles.activeCheckInSub}>
                      Checked in at {activeCheckInTime || 'Today'} • {selectedCompany?.companyName || 'Company'}
                      {selectedClient ? ` • Client: ${selectedClient.clientName}` : customerName ? ` • ${customerName}` : ''}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Work Details Form */}
              <Card style={styles.formCard}>
                <Text style={styles.sectionHeader}>Work Details</Text>

                {/* Auto-filled Date, Company & Client Badges */}
                <View style={styles.autoFilledGrid}>
                  <View style={styles.autoFilledBadge}>
                    <Text style={styles.autoFilledLabel}>Date</Text>
                    <Text style={styles.autoFilledVal}>{dutyDate}</Text>
                  </View>
                  <View style={styles.autoFilledBadge}>
                    <Text style={styles.autoFilledLabel}>{companyCategory === 'office' ? 'Office' : 'Company'}</Text>
                    <Text style={styles.autoFilledVal} numberOfLines={1}>
                      {selectedCompany?.companyName || 'Office'}
                    </Text>
                  </View>
                  {companyCategory === 'client' && (selectedClient || customerName) ? (
                    <View style={styles.autoFilledBadge}>
                      <Text style={styles.autoFilledLabel}>Client</Text>
                      <Text style={styles.autoFilledVal} numberOfLines={1}>
                        {selectedClient?.clientName || customerName}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Machine Name */}
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

                {workType === 'Other' && (
                  <TextInputField
                    label="Custom Work Details *"
                    placeholder="e.g. PLC Programming, Sensor Calibration"
                    value={customWorkDetails}
                    onChangeText={setCustomWorkDetails}
                    required
                  />
                )}

                {/* Work Description */}
                <TextInputField
                  label="Work Description *"
                  placeholder="Describe maintenance or service actions carried out"
                  value={workDescription}
                  onChangeText={setWorkDescription}
                  multiline
                  numberOfLines={4}
                  required
                />

                {/* Features Section */}
                <View style={styles.dynamicSectionWrap}>
                  <View style={styles.dynamicSectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="sparkles" size={18} color="#D97706" />
                      <Text style={styles.dynamicSectionTitle}>Features (Optional)</Text>
                    </View>
                    {features.length > 0 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{features.length} Added</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.dynamicSectionSubtitle}>
                    Select common components or type a custom feature.
                  </Text>

                  {/* Quick Preset Buttons */}
                  <View style={styles.presetChipsWrap}>
                    {PRESET_FEATURES.map((item) => {
                      const isSelected = features.includes(item);
                      return (
                        <TouchableOpacity
                          key={item}
                          style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                          onPress={() => handleTogglePresetFeature(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isSelected ? 'checkmark' : 'add'}
                            size={12}
                            color={isSelected ? '#1E40AF' : '#2563EB'}
                          />
                          <Text
                            style={[
                              styles.presetChipText,
                              isSelected && styles.presetChipTextSelected,
                            ]}
                          >
                            {item}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Inline Custom Feature Input + Add Button */}
                  <View style={styles.addFeatureRow}>
                    <View style={{ flex: 1 }}>
                      <TextInputField
                        label=""
                        placeholder="Type custom feature (e.g. Servo Motor)"
                        value={customFeatureInput}
                        onChangeText={setCustomFeatureInput}
                        style={{ marginBottom: 0 }}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.featureAddBtn}
                      onPress={handleAddCustomFeature}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.featureAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Active Features Tags */}
                  {features.length > 0 ? (
                    <View style={styles.featureTagsContainer}>
                      {features.map((feat, idx) => (
                        <View key={`feat-tag-${idx}`} style={styles.featureTagPill}>
                          <Ionicons name="hardware-chip-outline" size={13} color="#0369A1" />
                          <Text style={styles.featureTagText}>{feat}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveFeature(idx)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="close-circle" size={16} color="#0284C7" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Manpower Members Section */}
                <View style={styles.dynamicSectionWrap}>
                  <View style={styles.dynamicSectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="people" size={18} color={COLORS.primary} />
                      <Text style={styles.dynamicSectionTitle}>Manpower Members</Text>
                      {manpowerMembers.length > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{manpowerMembers.length}</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={handleOpenAddManpower}
                      style={styles.addMemberBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="person-add" size={14} color="#FFFFFF" />
                      <Text style={styles.addMemberBtnText}>+ Add Member</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.dynamicSectionSubtitle}>
                    Add colleagues or technicians assisting on this duty visit.
                  </Text>

                  {manpowerMembers.length === 0 ? (
                    <TouchableOpacity
                      style={styles.emptyManpowerBox}
                      onPress={handleOpenAddManpower}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="person-add-outline" size={24} color={COLORS.textMuted} />
                      <Text style={styles.emptyManpowerText}>
                        No team members added yet.
                      </Text>
                      <Text style={styles.emptyManpowerSub}>
                        Tap here or "+ Add Member" to add assistants without screen clutter.
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.compactMemberList}>
                      {manpowerMembers.map((member, idx) => (
                        <View key={`member-${idx}`} style={styles.compactMemberCard}>
                          <View style={styles.memberAvatarCircle}>
                            <Text style={styles.memberAvatarInitial}>
                              {member.name ? member.name.charAt(0).toUpperCase() : '#'}
                            </Text>
                          </View>

                          <View style={styles.memberInfoCol}>
                            <Text style={styles.memberNameText} numberOfLines={1}>
                              {member.name}
                            </Text>
                            <View style={styles.memberMetaRow}>
                              {(member.role || member.description) ? (
                                <View style={styles.memberRoleBadge}>
                                  <Text style={styles.memberRoleBadgeText} numberOfLines={1}>
                                    {member.role || member.description}
                                  </Text>
                                </View>
                              ) : null}
                              {member.phoneNumber ? (
                                <View style={styles.memberPhoneRow}>
                                  <Ionicons name="call-outline" size={12} color={COLORS.textSecondary} />
                                  <Text style={styles.memberPhoneText}>{member.phoneNumber}</Text>
                                </View>
                              ) : null}
                            </View>
                            {member.description && member.role && member.description !== member.role ? (
                              <Text style={styles.memberDescText} numberOfLines={2}>
                                {member.description}
                              </Text>
                            ) : null}
                          </View>

                          <View style={styles.memberActionsRow}>
                            <TouchableOpacity
                              onPress={() => handleOpenEditManpower(idx)}
                              style={styles.memberActionBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveManpower(idx)}
                              style={styles.memberActionBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={18} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Photo Proof (Max 3) */}
                <View style={styles.photosSection}>
                  <View style={styles.photosHeaderRow}>
                    <Text style={styles.fieldLabel}>Proof Photos ({photos.length}/3)</Text>
                    {photos.length < 3 && (
                      <TouchableOpacity
                        onPress={handlePickPhoto}
                        style={styles.addPhotoLink}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.addPhotoLinkText}>Add Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.photosGrid}>
                    {photos.map((uri, idx) => (
                      <View key={`photo-${idx}`} style={styles.photoThumbWrap}>
                        <TouchableOpacity
                          onPress={() => handleOpenPhotoPreview(uri, idx)}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri }} style={styles.photoThumb} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveBtn}
                          onPress={() => handleRemovePhoto(idx)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={20} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {photos.length === 0 && (
                      <TouchableOpacity
                        style={styles.emptyPhotoSlot}
                        onPress={handlePickPhoto}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera" size={24} color={COLORS.textMuted} />
                        <Text style={styles.emptyPhotoSlotText}>Tap to add proof photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Customer / Office Signature */}
                <View style={styles.signatureSection}>
                  <Text style={styles.fieldLabel}>
                    {companyCategory === 'office' ? 'Office Sign-Off' : 'Customer Signature'}
                  </Text>
                  {signatureData ? (
                    <View style={styles.signaturePreviewWrap}>
                      <TouchableOpacity
                        onPress={handleOpenSignaturePreview}
                        activeOpacity={0.8}
                      >
                        <SignatureImage
                          signature={signatureData.dataUri || signatureData.url}
                          style={styles.signaturePreviewImg}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.resignBtn}
                        onPress={() => setSignatureModalVisible(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh" size={14} color={COLORS.primary} />
                        <Text style={styles.resignBtnText}>Re-Sign</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.openSignPadBtn}
                      onPress={() => setSignatureModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pencil" size={18} color={COLORS.primary} />
                      <Text style={styles.openSignPadBtnText}>Open Signature Pad</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Separate Locations: Check-In Location (Recorded) & Check-Out Location (Fresh) */}
                <View style={styles.locationsSectionWrap}>
                  {/* 1. Check-In Location Summary Card (Recorded) */}
                  <View style={styles.locationBlockCard}>
                    <View style={styles.locationBlockHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="log-in" size={18} color="#059669" />
                        <Text style={styles.locationBlockTitle}>Check-In Location</Text>
                      </View>
                      <View style={styles.locationBlockTagSuccess}>
                        <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        <Text style={styles.locationBlockTagSuccessText}>Recorded</Text>
                      </View>
                    </View>

                    {checkInLocationCoords ? (
                      <View style={styles.locationBlockBody}>
                        {checkInLocationCoords.address ? (
                          <Text style={styles.locationAddressText}>
                            {checkInLocationCoords.address}
                          </Text>
                        ) : null}
                        <Text style={styles.locationCoordsText}>
                          GPS: {Number(checkInLocationCoords.latitude).toFixed(5)},{' '}
                          {Number(checkInLocationCoords.longitude).toFixed(5)}
                          {checkInLocationCoords.accuracy ? ` (±${checkInLocationCoords.accuracy}m)` : ''}
                        </Text>
                        <TouchableOpacity
                          style={styles.openMapLink}
                          onPress={() =>
                            openMapLocation(
                              checkInLocationCoords.latitude,
                              checkInLocationCoords.longitude,
                              'Check-In Location'
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="map-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.openMapLinkText}>View on Google Maps</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.locationFallbackText}>
                        No check-in GPS recorded.
                      </Text>
                    )}
                  </View>

                  {/* 2. Check-Out Location Card (Freshly Tagged at Departure) */}
                  <View style={[styles.locationBlockCard, styles.locationBlockCardCheckout]}>
                    <View style={styles.locationBlockHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="log-out" size={18} color={COLORS.primary} />
                        <Text style={styles.locationBlockTitle}>Check-Out Location</Text>
                      </View>
                      {checkOutLocationCoords ? (
                        <View style={styles.locationBlockTagSuccess}>
                          <Ionicons name="checkmark-circle" size={12} color="#059669" />
                          <Text style={styles.locationBlockTagSuccessText}>Ready</Text>
                        </View>
                      ) : (
                        <View style={styles.locationBlockTagPending}>
                          <Text style={styles.locationBlockTagPendingText}>Fresh Capture</Text>
                        </View>
                      )}
                    </View>

                    {checkOutLocationCoords ? (
                      <View style={styles.locationBlockBody}>
                        {checkOutLocationCoords.address ? (
                          <Text style={styles.locationAddressText}>
                            {checkOutLocationCoords.address}
                          </Text>
                        ) : null}
                        <Text style={styles.locationCoordsText}>
                          GPS: {Number(checkOutLocationCoords.latitude).toFixed(5)},{' '}
                          {Number(checkOutLocationCoords.longitude).toFixed(5)}
                          {checkOutLocationCoords.accuracy ? ` (±${checkOutLocationCoords.accuracy}m)` : ''}
                        </Text>
                        <TouchableOpacity
                          style={styles.openMapLink}
                          onPress={() =>
                            openMapLocation(
                              checkOutLocationCoords.latitude,
                              checkOutLocationCoords.longitude,
                              'Check-Out Location'
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="map-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.openMapLinkText}>View on Google Maps</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.locationHelperText}>
                        Checkout location is freshly captured and independent from check-in. Tap below or it will auto-tag upon submitting.
                      </Text>
                    )}

                    <SecondaryButton
                      title={
                        locatingCheckOut
                          ? 'Fetching Checkout GPS...'
                          : checkOutLocationCoords
                          ? 'Re-Capture Checkout Location'
                          : 'Capture Checkout Location (Fresh)'
                      }
                      onPress={handleCaptureCheckOutLocation}
                      loading={locatingCheckOut}
                      icon={locatingCheckOut ? undefined : 'locate-outline'}
                      style={{ marginTop: SPACING.xs }}
                    />
                  </View>
                </View>

                {/* Single Checkout Action Button */}
                <View style={styles.actionsWrap}>
                  <PrimaryButton
                    title={isEditing ? 'Update Work Report' : 'Submit Work Details & Checkout'}
                    onPress={handleCheckoutOrSubmit}
                    loading={loading}
                    icon="checkmark-done"
                  />
                </View>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        onSelect={(date) => {
          setDutyDate(date);
          setDatePickerVisible(false);
        }}
        initialDate={dutyDate}
      />

      {/* Company Selection Modal */}
      <DropdownPickerModal
        visible={companyDropdownVisible}
        title={companyCategory === 'office' ? 'Select Office' : 'Select Client Company'}
        items={displayedCompanies.map((c) => ({
          label: c.companyName,
          value: c._id,
          id: c._id,
          subtitle: `${c.companyType === 'office' ? 'Office' : 'Site'}: ${c.location || ''}${c.companyPhoneNumber ? ' • ' + c.companyPhoneNumber : ''}`,
        }))}
        selectedValue={selectedCompanyId}
        showAllOption={false}
        onSelect={(val, itemObj) => {
          const compId =
            typeof val === 'object' && val !== null
              ? val.value || val._id || val.id
              : val || itemObj?.value || itemObj?._id || itemObj?.id;
          setSelectedCompanyId(compId);
          // Switching company resets client selection
          setSelectedClientId('');
          setCustomerName('');
          setCustomerPhone('');
          setCompanyDropdownVisible(false);
          if (fieldErrors.company) {
            setFieldErrors((prev) => ({ ...prev, company: null }));
          }
        }}
        onClose={() => setCompanyDropdownVisible(false)}
        actionButtonLabel="+ Add New Company"
        onActionButtonPress={() => {
          setCompanyDropdownVisible(false);
          setAddCompanyModalVisible(true);
        }}
      />

      {/* Client Selection Modal */}
      <DropdownPickerModal
        visible={clientDropdownVisible}
        title="Select Client Contact"
        items={clients.map((cl) => ({
          label: cl.clientName,
          value: cl._id,
          id: cl._id,
          subtitle: cl.clientPhoneNumber ? `Phone: ${cl.clientPhoneNumber}` : '',
        }))}
        selectedValue={selectedClientId}
        showAllOption={false}
        onSelect={(val, itemObj) => {
          const clientId =
            typeof val === 'object' && val !== null
              ? val.value || val._id || val.id
              : val || itemObj?.value || itemObj?._id || itemObj?.id;
          setSelectedClientId(clientId);
          const matched = clients.find((c) => String(c._id) === String(clientId));
          if (matched) {
            setCustomerName(matched.clientName);
            if (matched.clientPhoneNumber) {
              setCustomerPhone(matched.clientPhoneNumber);
            }
          } else if (itemObj?.label) {
            setCustomerName(itemObj.label);
          }
          setClientDropdownVisible(false);
          if (fieldErrors.client) {
            setFieldErrors((prev) => ({ ...prev, client: null }));
          }
        }}
        onClose={() => setClientDropdownVisible(false)}
        actionButtonLabel="+ Add New Client"
        onActionButtonPress={() => {
          setClientDropdownVisible(false);
          setAddClientModalVisible(true);
        }}
      />

      {/* Inline Modal: Add New Company */}
      <Modal
        visible={addCompanyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddCompanyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add New Client Company</Text>
              <TouchableOpacity onPress={() => setAddCompanyModalVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInputField
              label="Company Name *"
              placeholder="e.g. Acme Industrial Corp"
              value={newCompanyName}
              onChangeText={setNewCompanyName}
              required
            />
            <TextInputField
              label="Site Location *"
              placeholder="e.g. Coimbatore, Tamil Nadu"
              value={newCompanyLocation}
              onChangeText={setNewCompanyLocation}
              required
            />
            <TextInputField
              label="Phone Number (Optional)"
              placeholder="10-digit number"
              value={newCompanyPhone}
              onChangeText={(t) => setNewCompanyPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              maxLength={10}
            />

            <View style={styles.dialogButtonsRow}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setAddCompanyModalVisible(false)}
                style={{ flex: 1, marginRight: SPACING.sm }}
              />
              <PrimaryButton
                title="Create Company"
                onPress={handleSaveNewCompany}
                loading={savingNewCompany}
                style={{ flex: 1.2 }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Inline Modal: Add New Client */}
      <Modal
        visible={addClientModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddClientModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add Client Contact</Text>
              <TouchableOpacity onPress={() => setAddClientModalVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInputField
              label="Client Contact Name *"
              placeholder="e.g. Senthil Kumar (Plant Manager)"
              value={newClientName}
              onChangeText={setNewClientName}
              required
            />
            <TextInputField
              label="Phone Number (Optional)"
              placeholder="10-digit mobile number"
              value={newClientPhone}
              onChangeText={(t) => setNewClientPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              maxLength={10}
            />

            <View style={styles.dialogButtonsRow}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setAddClientModalVisible(false)}
                style={{ flex: 1, marginRight: SPACING.sm }}
              />
              <PrimaryButton
                title="Link Client"
                onPress={handleSaveNewClient}
                loading={savingNewClient}
                style={{ flex: 1.2 }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Signature Pad Modal */}
      <SignaturePadModal
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={(sig) => {
          setSignatureData(sig);
          setSignatureModalVisible(false);
        }}
        title={companyCategory === 'office' ? 'Office Sign-Off' : 'Customer Signature'}
      />

      {/* Image Viewer Lightbox Modal */}
      <ImageViewerModal
        visible={previewModalVisible}
        imageUri={previewImageUri}
        title={previewTitle}
        subtitle={previewSubtitle}
        timestamp={previewTimestamp}
        isSignature={previewIsSignature}
        onClose={() => setPreviewModalVisible(false)}
      />

      {/* Manpower Add / Edit Modal */}
      <Modal
        visible={manpowerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManpowerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Card style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people" size={20} color={COLORS.primary} />
                <Text style={styles.dialogTitle}>
                  {editingManpowerIndex !== null ? 'Edit Team Member' : 'Add Team Member'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setManpowerModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {memberModalError ? (
              <Text style={[styles.errorText, { marginBottom: SPACING.xs }]}>
                {memberModalError}
              </Text>
            ) : null}

            <TextInputField
              label="Member Name *"
              placeholder="e.g. Senthil Kumar"
              value={memberModalName}
              onChangeText={(t) => {
                setMemberModalName(t);
                if (memberModalError) setMemberModalError('');
              }}
              required
            />

            {/* Quick Role Selection Presets */}
            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Role / Designation</Text>
            <View style={styles.rolePresetChipsWrap}>
              {['Assistant', 'Technician', 'Electrician', 'Mechanic', 'Helper', 'Programmer'].map(
                (role) => {
                  const isSelected = memberModalRole === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.rolePresetChip,
                        isSelected && styles.rolePresetChipSelected,
                      ]}
                      onPress={() => setMemberModalRole(isSelected ? '' : role)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.rolePresetChipText,
                          isSelected && styles.rolePresetChipTextSelected,
                        ]}
                      >
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            <TextInputField
              label="Custom Role / Title"
              placeholder="Or type custom role (e.g. Wiring Specialist)"
              value={memberModalRole}
              onChangeText={setMemberModalRole}
              style={{ marginTop: SPACING.xs }}
            />

            <TextInputField
              label="Work Description / Task Details (Optional)"
              placeholder="e.g. Panel wiring, sensor calibration, CNC loading"
              value={memberModalDescription}
              onChangeText={setMemberModalDescription}
              multiline
              numberOfLines={2}
            />

            <TextInputField
              label="Phone Number (Optional)"
              placeholder="10-digit mobile number"
              value={memberModalPhone}
              onChangeText={(t) => setMemberModalPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              maxLength={10}
            />

            <View style={styles.dialogButtonsRow}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setManpowerModalVisible(false)}
                style={{ flex: 1, marginRight: SPACING.sm }}
              />
              <PrimaryButton
                title={editingManpowerIndex !== null ? 'Update Member' : 'Add Member'}
                onPress={handleSaveManpowerModal}
                icon="checkmark"
                style={{ flex: 1.3 }}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>
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
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  formCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  fixedDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  fixedDateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedDateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fixedDateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  todayBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  typePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  companyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCompanyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  companyDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
  },
  companyDropdownBtnError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  companyDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  companyDropdownTextWrap: {
    flex: 1,
  },
  companyDropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  companyDropdownPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  companyDropdownSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gpsContainer: {
    backgroundColor: '#F8FAFC',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: SPACING.sm,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  gpsVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  gpsVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  gpsContainerError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  gpsMandatoryBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  gpsMandatoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  resolvedAddressBox: {
    marginTop: 6,
  },
  resolvedAddressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  resolvedAddressText: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 2,
    lineHeight: 16,
  },
  activeCheckInCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  activeCheckInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  activeCheckInTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  activeCheckInSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  autoFilledGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  autoFilledBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 90,
  },
  autoFilledLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  autoFilledVal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 1,
  },
  workTypesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  workTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  workTypeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  workTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  workTypeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dynamicSectionWrap: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  dynamicSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dynamicSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 6,
  },
  dynamicSectionSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  presetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  presetChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  presetChipTextSelected: {
    color: '#1E40AF',
    fontWeight: '700',
  },
  addFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  featureAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
  },
  featureAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  featureTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  featureTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 6,
  },
  featureTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  addMemberBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyManpowerBox: {
    padding: SPACING.md,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyManpowerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyManpowerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  compactMemberList: {
    gap: SPACING.xs,
    marginTop: 2,
  },
  compactMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  memberAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  memberInfoCol: {
    flex: 1,
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  memberRoleBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  memberRoleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  memberPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  memberPhoneText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  memberDescText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
    fontStyle: 'italic',
  },
  memberActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photosSection: {
    marginBottom: SPACING.md,
  },
  photosHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  addPhotoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  emptyPhotoSlot: {
    width: '100%',
    height: 70,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptyPhotoSlotText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  signatureSection: {
    marginBottom: SPACING.md,
  },
  signaturePreviewWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
  },
  signaturePreviewImg: {
    height: 120,
    width: '100%',
  },
  resignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  resignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  openSignPadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    backgroundColor: '#EEF2FF',
  },
  openSignPadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionsWrap: {
    marginTop: SPACING.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    padding: SPACING.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  rolePresetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: SPACING.xs,
  },
  rolePresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rolePresetChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rolePresetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  rolePresetChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationsSectionWrap: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  locationBlockCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  locationBlockCardCheckout: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  locationBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationBlockTagSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  locationBlockTagSuccessText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  locationBlockTagPending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  locationBlockTagPendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  locationBlockBody: {
    marginTop: 2,
    marginBottom: 6,
  },
  locationAddressText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 16,
    marginBottom: 3,
  },
  locationCoordsText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  openMapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  openMapLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  locationFallbackText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  locationHelperText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: 6,
  },
});

export default DutyFormScreen;
