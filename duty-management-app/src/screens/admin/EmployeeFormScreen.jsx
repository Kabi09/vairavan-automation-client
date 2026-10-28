import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import employeeApi from '../../api/employeeApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { isValidEmail, isValidPhone } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

const ROLE_OPTIONS = [
  {
    label: 'Employee',
    value: 'employee',
    subtitle: 'Standard access to duty forms, assigned tasks & leaves',
  },
  {
    label: 'Admin',
    value: 'admin',
    subtitle: 'Full administrative access to manage team, duties & reports',
  },
];

export const EmployeeFormScreen = ({ navigation, route }) => {
  const existingEmployee = route.params?.employee;
  const isEditing = Boolean(existingEmployee);

  const [name, setName] = useState(existingEmployee?.employeeName || '');
  const [employeeId, setEmployeeId] = useState(existingEmployee?.employeeId || '');
  const [email, setEmail] = useState(existingEmployee?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(existingEmployee?.phoneNumber || '');
  const [designation, setDesignation] = useState(existingEmployee?.designation || '');
  const [address, setAddress] = useState(existingEmployee?.location || existingEmployee?.address || '');
  const [joiningDate, setJoiningDate] = useState(
    existingEmployee?.joiningDate
      ? formatISODateOnly(existingEmployee.joiningDate)
      : isEditing
      ? (existingEmployee?.createdAt ? formatISODateOnly(existingEmployee.createdAt) : '')
      : formatISODateOnly(new Date())
  );
  const [joiningDatePickerVisible, setJoiningDatePickerVisible] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(
    existingEmployee?.dateOfBirth ? formatISODateOnly(existingEmployee.dateOfBirth) : ''
  );
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [role, setRole] = useState(existingEmployee?.role || 'employee');
  const [rolePickerVisible, setRolePickerVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Employee name is required';
    }
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!isValidEmail(email)) {
      errors.email = 'Please provide a valid email address';
    }

    if (!isEditing) {
      if (!employeeId.trim()) {
        errors.employeeId = 'Employee ID is required (e.g. EMP002)';
      }
      if (!password) {
        errors.password = 'Initial password is required';
      } else if (password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }

    if (phone.trim() && !isValidPhone(phone)) {
      errors.phone = 'Phone number must be exactly 10 digits';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        const res = await employeeApi.updateEmployee(existingEmployee._id, {
          employeeName: name.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phone.trim(),
          designation: designation.trim(),
          address: address.trim(),
          location: address.trim(),
          joiningDate: joiningDate || null,
          dateOfBirth: dateOfBirth || null,
          role: role || 'employee',
        });
        if (route.params?.onUpdated && res?.data?.employee) {
          try {
            route.params.onUpdated(res.data.employee);
          } catch (_) {}
        }
        Alert.alert('Success', 'Employee details updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await employeeApi.createEmployee({
          employeeName: name.trim(),
          employeeId: employeeId.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          password,
          phoneNumber: phone.trim(),
          designation: designation.trim() || (role === 'admin' ? 'Administrator' : 'Service Engineer'),
          address: address.trim(),
          location: address.trim(),
          joiningDate: joiningDate || null,
          dateOfBirth: dateOfBirth || null,
          role: role || 'employee',
          accountStatus: 'active',
        });
        Alert.alert('Success', 'Employee registered successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to save employee profile');
      setError(msg);
      if (msg.toLowerCase().includes('phone')) {
        setFieldErrors((prev) => ({ ...prev, phone: msg }));
      } else if (msg.toLowerCase().includes('email')) {
        setFieldErrors((prev) => ({ ...prev, email: msg }));
      } else if (msg.toLowerCase().includes('employee id')) {
        setFieldErrors((prev) => ({ ...prev, employeeId: msg }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={isEditing ? 'Edit Employee' : 'New Employee'}
        subtitle={isEditing ? 'Update profile information' : 'Create an employee account'}
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

          <Card style={styles.formCard}>
            <Text style={styles.sectionHeader}>Account Information</Text>

            <TextInputField
              label="Full Name"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: null }));
              }}
              error={fieldErrors.name}
              required
            />

            {isEditing ? (
              <TextInputField
                label="Email Address"
                placeholder="e.g. ramesh@vairavan.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: null }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={fieldErrors.email}
                required
              />
            ) : (
              <>
                <TextInputField
                  label="Employee ID"
                  placeholder="e.g. EMP005"
                  value={employeeId}
                  onChangeText={(text) => {
                    setEmployeeId(text);
                    if (fieldErrors.employeeId) setFieldErrors((p) => ({ ...p, employeeId: null }));
                  }}
                  autoCapitalize="characters"
                  error={fieldErrors.employeeId}
                  required
                />

                <TextInputField
                  label="Email Address"
                  placeholder="e.g. ramesh@vairavan.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: null }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={fieldErrors.email}
                  required
                />

                <TextInputField
                  label="Temporary Password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: null }));
                  }}
                  secureTextEntry
                  error={fieldErrors.password}
                  required
                />
              </>
            )}

            <Text style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
              Role & Contact
            </Text>

            {/* Account Role Dropdown */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>Account Role *</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setRolePickerVisible(true)}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownLeft}>
                  <Ionicons
                    name={role === 'admin' ? 'shield-checkmark' : 'person'}
                    size={20}
                    color={role === 'admin' ? '#D97706' : COLORS.primary}
                  />
                  <View style={styles.dropdownTextWrap}>
                    <Text style={styles.dropdownValue}>
                      {role === 'admin' ? 'Admin' : 'Employee'}
                    </Text>
                    <Text style={styles.dropdownSub}>
                      {role === 'admin'
                        ? 'Full administrative access to manage team & duties'
                        : 'Standard staff access to duty forms, assigned tasks & leaves'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInputField
              label="Designation"
              placeholder={role === 'admin' ? 'e.g. Operations Manager' : 'e.g. Automation Engineer'}
              value={designation}
              onChangeText={setDesignation}
            />

            <TextInputField
              label="Phone Number"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
                setPhone(cleaned);
                if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: null }));
              }}
              keyboardType="number-pad"
              maxLength={10}
              error={fieldErrors.phone}
            />

            {/* Joining Date Field - Admin Editable */}
            <View style={styles.dobContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.dobLabel}>Date of Joining *</Text>
                <View style={styles.adminOnlyBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#B45309" />
                  <Text style={styles.adminOnlyBadgeText}>Admin Only</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.dobButton}
                onPress={() => setJoiningDatePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={joiningDate ? styles.dobText : styles.dobPlaceholder}>
                  {joiningDate ? formatDate(joiningDate) : 'Select joining date'}
                </Text>
                <Ionicons name="create-outline" size={16} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>

            <View style={styles.dobContainer}>
              <Text style={styles.dobLabel}>Date of Birth (Optional)</Text>
              <TouchableOpacity
                style={styles.dobButton}
                onPress={() => setDobPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="gift-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={dateOfBirth ? styles.dobText : styles.dobPlaceholder}>
                  {dateOfBirth ? formatDate(dateOfBirth) : 'Select date of birth'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>

            <TextInputField
              label="Location / Address"
              placeholder="e.g. Coimbatore, Tamil Nadu"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />
          </Card>

          <PrimaryButton
            title={isEditing ? 'Save Profile' : 'Create Account'}
            onPress={handleSave}
            loading={loading}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={joiningDatePickerVisible}
        title="Select Date of Joining"
        selectedDate={joiningDate}
        onSelectDate={(d) => {
          setJoiningDate(d);
          setJoiningDatePickerVisible(false);
        }}
        onClose={() => setJoiningDatePickerVisible(false)}
      />

      <DatePickerModal
        visible={dobPickerVisible}
        title="Select Date of Birth"
        selectedDate={dateOfBirth}
        onSelectDate={(d) => {
          setDateOfBirth(d);
          setDobPickerVisible(false);
        }}
        onClose={() => setDobPickerVisible(false)}
      />

      <DropdownPickerModal
        visible={rolePickerVisible}
        title="Select Account Role"
        items={ROLE_OPTIONS}
        selectedValue={role}
        showAllOption={false}
        searchPlaceholder="Search role..."
        onSelect={(val) => {
          if (val) setRole(val);
          setRolePickerVisible(false);
        }}
        onClose={() => setRolePickerVisible(false)}
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
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  dropdownContainer: {
    marginBottom: SPACING.md,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  dropdownTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  dropdownValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  dropdownSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dobContainer: {
    marginBottom: SPACING.md,
  },
  dobLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  dobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dobText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  dobPlaceholder: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  adminOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  adminOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
});

export default EmployeeFormScreen;
