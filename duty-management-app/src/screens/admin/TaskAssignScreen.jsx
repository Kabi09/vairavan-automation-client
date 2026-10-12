import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import employeeApi from '../../api/employeeApi';
import taskApi from '../../api/taskApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import { formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const TaskAssignScreen = ({ navigation }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDropdownVisible, setEmployeeDropdownVisible] = useState(false);

  const [taskName, setTaskName] = useState('');
  const [date, setDate] = useState(formatISODateOnly());
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [work, setWork] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingEmployees, setFetchingEmployees] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const fetchActiveStaff = async () => {
      try {
        const res = await employeeApi.getEmployees({ status: 'active', limit: 100 });
        if (res.data?.employees) {
          const formatted = res.data.employees
            .filter((e) => e.accountStatus === 'active')
            .map((e) => ({
              id: e._id,
              label: `${e.employeeName} (${e.employeeId})`,
              subtitle: `${e.designation || 'Staff'} • ${e.phoneNumber || 'No phone'}`,
              raw: e,
            }));
          setEmployees(formatted);
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load active employee list'));
      } finally {
        setFetchingEmployees(false);
      }
    };

    fetchActiveStaff();
  }, []);

  const validate = () => {
    const errs = {};
    if (!selectedEmployee) errs.employee = 'Please select an assigned employee';
    if (!taskName.trim()) errs.taskName = 'Task name is required';
    if (!date) errs.date = 'Scheduled date is required';
    if (!companyName.trim()) errs.companyName = 'Company name is required';
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) {
      errs.phoneNumber = 'Phone number is required';
    } else if (cleanPhone.length !== 10) {
      errs.phoneNumber = 'Phone number must be exactly 10 digits';
    }

    if (!work.trim()) errs.work = 'Work details / title is required';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAssignTask = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    const payload = {
      employee: selectedEmployee.id,
      taskName: taskName.trim(),
      date,
      companyName: companyName.trim(),
      phoneNumber: phoneNumber.replace(/\D/g, '').slice(-10),
      work: work.trim(),
      description: description.trim(),
    };

    try {
      await taskApi.createTask(payload);
      Alert.alert(
        'Task Assigned Successfully',
        `Task "${taskName.trim()}" has been scheduled and assigned to ${selectedEmployee.label}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
            },
          },
        ]
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to assign task'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Assign New Task"
        subtitle="Schedule work and dispatch to employee"
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
            <Text style={styles.sectionTitle}>Assignee & Schedule</Text>

            {/* Employee Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Select Employee *</Text>
              <TouchableOpacity
                style={[
                  styles.pickerBtn,
                  fieldErrors.employee && styles.pickerBtnError,
                ]}
                onPress={() => setEmployeeDropdownVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>
                  {selectedEmployee ? selectedEmployee.label : 'Choose an active employee'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              {fieldErrors.employee ? (
                <Text style={styles.errorText}>{fieldErrors.employee}</Text>
              ) : null}
            </View>

            {/* Scheduled Date */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Task Date *</Text>
              <TouchableOpacity
                style={[
                  styles.pickerBtn,
                  fieldErrors.date && styles.pickerBtnError,
                ]}
                onPress={() => setDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>{date || 'Select Date'}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              {fieldErrors.date ? (
                <Text style={styles.errorText}>{fieldErrors.date}</Text>
              ) : null}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>Task & Site Details</Text>

            <TextInputField
              label="Task Name"
              placeholder="e.g. CNC Machine Maintenance Inspection"
              value={taskName}
              onChangeText={(t) => {
                setTaskName(t);
                if (fieldErrors.taskName) setFieldErrors((p) => ({ ...p, taskName: null }));
              }}
              error={fieldErrors.taskName}
              required
            />

            <TextInputField
              label="Company Name"
              placeholder="e.g. Apex Engineering Ltd"
              value={companyName}
              onChangeText={(t) => {
                setCompanyName(t);
                if (fieldErrors.companyName) setFieldErrors((p) => ({ ...p, companyName: null }));
              }}
              error={fieldErrors.companyName}
              required
            />

            <TextInputField
              label="Contact Phone Number (10 digits)"
              placeholder="e.g. 9876543210"
              value={phoneNumber}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '').slice(0, 10);
                setPhoneNumber(numeric);
                if (fieldErrors.phoneNumber) setFieldErrors((p) => ({ ...p, phoneNumber: null }));
              }}
              keyboardType="number-pad"
              maxLength={10}
              error={fieldErrors.phoneNumber}
              required
            />

            <TextInputField
              label="Work Details / Type"
              placeholder="e.g. Hydraulic Line Service & Calibration"
              value={work}
              onChangeText={(t) => {
                setWork(t);
                if (fieldErrors.work) setFieldErrors((p) => ({ ...p, work: null }));
              }}
              error={fieldErrors.work}
              required
            />

            <TextInputField
              label="Detailed Instructions / Description"
              placeholder="e.g. Check hydraulic pump noise, replace filter O-rings, and obtain client signature..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </Card>

          <PrimaryButton
            title="Assign Task to Employee"
            onPress={handleAssignTask}
            loading={loading}
            disabled={fetchingEmployees}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        selectedDate={date}
        onSelectDate={(d) => {
          setDate(d);
          if (fieldErrors.date) setFieldErrors((p) => ({ ...p, date: null }));
        }}
        title="Select Task Scheduled Date"
      />

      {/* Employee Dropdown Modal */}
      <DropdownPickerModal
        visible={employeeDropdownVisible}
        onClose={() => setEmployeeDropdownVisible(false)}
        title="Select Assigned Staff"
        items={employees}
        selectedValue={selectedEmployee?.id}
        showAllOption={false}
        searchPlaceholder="Search staff by name or ID..."
        onSelect={(item) => {
          setSelectedEmployee(item);
          if (fieldErrors.employee) setFieldErrors((p) => ({ ...p, employee: null }));
        }}
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
    paddingBottom: SPACING.xxl,
  },
  formCard: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
    paddingBottom: SPACING.xs,
  },
  fieldContainer: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  pickerBtnError: {
    borderColor: COLORS.danger,
  },
  pickerBtnText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 4,
    marginLeft: 2,
  },
  submitBtn: {
    marginTop: SPACING.xs,
  },
});

export default TaskAssignScreen;
