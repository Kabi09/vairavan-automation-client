import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import companyApi from '../../api/companyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import { isValidPhone } from '../../utils/validators';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const CompanyFormScreen = ({ navigation, route }) => {
  const existingCompany = route.params?.company;
  const isEditing = Boolean(existingCompany);

  const [companyName, setCompanyName] = useState(existingCompany?.companyName || '');
  const [location, setLocation] = useState(existingCompany?.location || '');
  const [phone, setPhone] = useState(existingCompany?.companyPhoneNumber || '');
  const [companyType, setCompanyType] = useState(existingCompany?.companyType || 'client');
  const [isActive, setIsActive] = useState(existingCompany ? existingCompany.status === 'active' : true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!companyName.trim()) {
      errors.companyName = 'Company name is required';
    }
    if (!location.trim()) {
      errors.location = 'Location is required';
    }
    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!isValidPhone(phone)) {
      errors.phone = 'Phone number must be exactly 10 digits';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    const payload = {
      companyName: companyName.trim(),
      location: location.trim(),
      companyPhoneNumber: phone.trim(),
      companyType,
      status: isActive ? 'active' : 'inactive',
    };

    try {
      if (isEditing) {
        await companyApi.updateCompany(existingCompany._id, payload);
        Alert.alert('Success', 'Company details updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await companyApi.createCompany(payload);
        Alert.alert('Success', 'Company created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save company'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={isEditing ? 'Edit Company' : 'New Company'}
        subtitle={isEditing ? 'Update client details' : 'Register a new customer unit'}
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
            {/* Classification: Office vs Client Company */}
            <Text style={styles.fieldLabel}>Classification *</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.typePill,
                  companyType === 'office' && styles.typePillActive,
                ]}
                onPress={() => setCompanyType('office')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="business"
                  size={18}
                  color={companyType === 'office' ? '#FFFFFF' : COLORS.primary}
                />
                <Text
                  style={[
                    styles.typePillText,
                    companyType === 'office' && styles.typePillTextActive,
                  ]}
                >
                  Office
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typePill,
                  companyType === 'client' && styles.typePillActive,
                ]}
                onPress={() => setCompanyType('client')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="storefront"
                  size={18}
                  color={companyType === 'client' ? '#FFFFFF' : COLORS.primary}
                />
                <Text
                  style={[
                    styles.typePillText,
                    companyType === 'client' && styles.typePillTextActive,
                  ]}
                >
                  Client Company
                </Text>
              </TouchableOpacity>
            </View>

            <TextInputField
              label={companyType === 'office' ? 'Office / Branch Name' : 'Company Name'}
              placeholder={
                companyType === 'office'
                  ? 'e.g. Vairavan Automation Head Office'
                  : 'e.g. Apex Spinning Mills'
              }
              value={companyName}
              onChangeText={(text) => {
                setCompanyName(text);
                if (fieldErrors.companyName) {
                  setFieldErrors((prev) => ({ ...prev, companyName: null }));
                }
              }}
              error={fieldErrors.companyName}
              required
            />

            <TextInputField
              label="Location"
              placeholder="e.g. Coimbatore, Tamil Nadu"
              value={location}
              onChangeText={(text) => {
                setLocation(text);
                if (fieldErrors.location) {
                  setFieldErrors((prev) => ({ ...prev, location: null }));
                }
              }}
              error={fieldErrors.location}
              required
            />

            <TextInputField
              label="Company Phone Number"
              placeholder="10-digit mobile or office number"
              value={phone}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
                setPhone(cleaned);
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => ({ ...prev, phone: null }));
                }
              }}
              keyboardType="number-pad"
              maxLength={10}
              error={fieldErrors.phone}
              required
            />

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Active Status</Text>
                <Text style={styles.switchSublabel}>
                  {isActive
                    ? 'Available for duty reports'
                    : 'Inactive (hidden from new reports)'}
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={isActive ? COLORS.primary : '#F4F3F4'}
              />
            </View>
          </Card>

          <PrimaryButton
            title={isEditing ? 'Save Changes' : 'Create Company'}
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  switchSublabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
});

export default CompanyFormScreen;
