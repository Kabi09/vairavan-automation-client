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
import leaveApi from '../../api/leaveApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import { formatISODateOnly, isDateRangeValid } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const LeaveRequestScreen = ({ navigation }) => {
  const today = formatISODateOnly();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (startDate && endDate && !isDateRangeValid(startDate, endDate)) {
      errors.endDate = 'End date cannot be earlier than start date';
    }
    if (!reason.trim()) {
      errors.reason = 'Reason for leave is required';
    } else if (reason.trim().length < 5) {
      errors.reason = 'Please provide a detailed reason';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      await leaveApi.createLeave({
        startDate,
        endDate,
        reason: reason.trim(),
      });

      Alert.alert(
        'Leave Request Submitted',
        'Your application has been forwarded to administration for sanction.',
        [{ text: 'OK', onPress: () => navigation.navigate('MyLeaves') }]
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to submit leave request'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Apply for Leave"
        subtitle="Submit a formal time-off request"
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
            <Text style={styles.sectionTitle}>Leave Period</Text>

            <TextInputField
              label="Start Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-10-20"
              value={startDate}
              onChangeText={(text) => {
                setStartDate(text);
                if (fieldErrors.startDate) setFieldErrors((p) => ({ ...p, startDate: null }));
              }}
              error={fieldErrors.startDate}
              required
            />

            <TextInputField
              label="End Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-10-22"
              value={endDate}
              onChangeText={(text) => {
                setEndDate(text);
                if (fieldErrors.endDate) setFieldErrors((p) => ({ ...p, endDate: null }));
              }}
              error={fieldErrors.endDate}
              required
            />

            <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
              Reason for Absence
            </Text>

            <TextInputField
              label="Reason Details"
              placeholder="e.g. Attending family function in native village / Medical checkup..."
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (fieldErrors.reason) setFieldErrors((p) => ({ ...p, reason: null }));
              }}
              multiline
              numberOfLines={4}
              error={fieldErrors.reason}
              required
            />
          </Card>

          <PrimaryButton
            title="Submit Leave Request"
            onPress={handleSubmit}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
});

export default LeaveRequestScreen;
