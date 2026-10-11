import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import employeeApi from '../../api/employeeApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import { isValidEmail, isValidPhone } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const EmployeeFormScreen = ({ navigation, route }) => {
  const existingEmployee = route.params?.employee;
  const isEditing = Boolean(existingEmployee);

  const [name, setName] = useState(existingEmployee?.employeeName || '');
  const [employeeId, setEmployeeId] = useState(existingEmployee?.employeeId || '');
  const [email, setEmail] = useState(existingEmployee?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(existingEmployee?.phoneNumber || '');
  const [designation, setDesignation] = useState(existingEmployee?.designation || '');
  const [address, setAddress] = useState(existingEmployee?.address || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Employee name is required';
    }
    if (!isEditing) {
      if (!employeeId.trim()) {
        errors.employeeId = 'Employee ID is required (e.g. EMP002)';
      }
      if (!email.trim()) {
        errors.email = 'Email address is required';
      } else if (!isValidEmail(email)) {
        errors.email = 'Please provide a valid email address';
      }
      if (!password) {
        errors.password = 'Initial password is required';
      } else if (password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }

    if (phone.trim() && !isValidPhone(phone)) {
      errors.phone = 'Please provide a valid phone number';
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
        await employeeApi.updateEmployee(existingEmployee._id, {
          employeeName: name.trim(),
          phoneNumber: phone.trim(),
          designation: designation.trim(),
          address: address.trim(),
        });
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
          designation: designation.trim() || 'Service Engineer',
          address: address.trim(),
          role: 'employee',
          accountStatus: 'active',
        });
        Alert.alert('Success', 'Employee registered successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save employee profile'));
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

            {!isEditing && (
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

            <TextInputField
              label="Designation"
              placeholder="e.g. Automation Engineer"
              value={designation}
              onChangeText={setDesignation}
            />

            <TextInputField
              label="Phone Number"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: null }));
              }}
              keyboardType="phone-pad"
              error={fieldErrors.phone}
            />

            <TextInputField
              label="Address / Branch"
              placeholder="e.g. Coimbatore Branch"
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
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
});

export default EmployeeFormScreen;
