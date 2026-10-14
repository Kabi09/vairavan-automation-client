import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import taskApi from '../api/taskApi';
import companyApi from '../api/companyApi';
import employeeApi from '../api/employeeApi';
import TextInputField from './TextInputField';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import DropdownPickerModal from './DropdownPickerModal';
import MultiSelectEmployeeModal from './MultiSelectEmployeeModal';
import { extractErrorMessage } from '../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const TaskCreateModal = ({
  visible,
  onClose,
  onTaskCreated,
}) => {
  const [taskName, setTaskName] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sub-pickers
  const [companyDropdownVisible, setCompanyDropdownVisible] = useState(false);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      resetForm();
      loadCompaniesAndEmployees();
    }
  }, [visible]);

  const resetForm = () => {
    setTaskName('');
    setSelectedCompany(null);
    setSelectedEmployeeIds([]);
    setDescription('');
    setPriority('medium');
  };

  const loadCompaniesAndEmployees = async () => {
    try {
      setLoadingData(true);
      const [compRes, empRes] = await Promise.all([
        companyApi.getCompanies({ status: 'active', limit: 300 }).catch(() => ({ data: { companies: [] } })),
        employeeApi.getEmployees({ accountStatus: 'active', limit: 300 }).catch(() => ({ data: { employees: [] } })),
      ]);

      if (compRes.data?.companies) {
        setCompanies(compRes.data.companies);
      }
      if (empRes.data?.employees) {
        // Only include actual employees/staff
        setEmployees(empRes.data.employees);
      }
    } catch (err) {
      console.warn('[TaskCreateModal] Failed to load form data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async () => {
    if (!taskName.trim()) {
      Alert.alert('Validation Error', 'Please enter a task name.');
      return;
    }
    if (!selectedCompany?._id) {
      Alert.alert('Validation Error', 'Please select a client company.');
      return;
    }
    if (selectedEmployeeIds.length === 0) {
      Alert.alert('Validation Error', 'Please assign at least one employee to this task.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        taskName: taskName.trim(),
        companyId: selectedCompany._id,
        assignedEmployees: selectedEmployeeIds,
        description: description.trim(),
        priority,
      };

      const res = await taskApi.createTask(payload);
      Alert.alert(
        'Task Created! 🚀',
        `Task "${taskName.trim()}" has been created and assigned to ${selectedEmployeeIds.length} employee(s). Notifications sent.`
      );

      if (onTaskCreated && res.data?.task) {
        onTaskCreated(res.data.task);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      Alert.alert('Create Task Failed', extractErrorMessage(err, 'Could not create task'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEmployeesList = employees.filter((e) =>
    selectedEmployeeIds.includes(e._id)
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerIconWrap}>
                  <Ionicons name="add-circle" size={22} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.title}>Assign New Task</Text>
                  <Text style={styles.subtitle}>Create work task for employees</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {/* Task Name */}
              <TextInputField
                label="Task Name *"
                placeholder="e.g. Servo Motor Replacement, PLC Wiring"
                value={taskName}
                onChangeText={setTaskName}
                leftIcon="construct-outline"
                style={{ marginBottom: SPACING.md }}
              />

              {/* Client Company Trigger */}
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={styles.fieldLabel}>Client Company *</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerBtn}
                  onPress={() => setCompanyDropdownVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.pickerTriggerText,
                        !selectedCompany && styles.placeholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCompany
                        ? selectedCompany.companyName
                        : 'Select client company...'}
                    </Text>
                    {selectedCompany?.location ? (
                      <Text style={styles.pickerSubText} numberOfLines={1}>
                        {selectedCompany.location}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Multi-Select Employees Trigger */}
              <View style={{ marginBottom: SPACING.md }}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Assign Employees (Multi-Select) *</Text>
                  {selectedEmployeeIds.length > 0 && (
                    <Text style={styles.selectedCountText}>
                      {selectedEmployeeIds.length} selected
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.pickerTriggerBtn}
                  onPress={() => setEmployeeModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={18} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    {selectedEmployeesList.length === 0 ? (
                      <Text style={styles.placeholderText}>
                        Choose 1 or more employees to assign...
                      </Text>
                    ) : (
                      <Text style={styles.pickerTriggerText} numberOfLines={2}>
                        {selectedEmployeesList.map((e) => e.employeeName).join(', ')}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Task Description */}
              <TextInputField
                label="Task Description & Instructions"
                placeholder="Enter details, issues reported, requirements, tools needed..."
                value={description}
                onChangeText={setDescription}
                leftIcon="document-text-outline"
                multiline
                numberOfLines={3}
                style={{ marginBottom: SPACING.md }}
              />

              {/* Priority Chips */}
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={styles.fieldLabel}>Priority</Text>
                <View style={styles.priorityRow}>
                  {['low', 'medium', 'high'].map((p) => {
                    const isSelected = priority === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.priorityChip,
                          isSelected && styles.priorityChipSelected,
                          isSelected && p === 'high' && { backgroundColor: '#FEE2E2', borderColor: '#F87171' },
                          isSelected && p === 'medium' && { backgroundColor: '#FEF3C7', borderColor: '#FBBF24' },
                          isSelected && p === 'low' && { backgroundColor: '#E0E7FF', borderColor: '#818CF8' },
                        ]}
                        onPress={() => setPriority(p)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.priorityChipText,
                            isSelected && styles.priorityChipTextSelected,
                            isSelected && p === 'high' && { color: '#B91C1C' },
                            isSelected && p === 'medium' && { color: '#B45309' },
                            isSelected && p === 'low' && { color: '#4338CA' },
                          ]}
                        >
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.footer}>
              <SecondaryButton title="Cancel" onPress={onClose} style={styles.footerBtn} />
              <PrimaryButton
                title="Assign Task 🚀"
                onPress={handleSubmit}
                loading={submitting}
                style={styles.footerBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Company Dropdown Modal */}
      <DropdownPickerModal
        visible={companyDropdownVisible}
        title="Select Client Company"
        items={companies.map((c) => ({
          value: c._id,
          label: c.companyName,
          subtitle: c.location || '',
          ...c,
        }))}
        selectedValue={selectedCompany?._id}
        onSelect={(val, item) => setSelectedCompany(item)}
        onClose={() => setCompanyDropdownVisible(false)}
        showAllOption={false}
        searchPlaceholder="Search client company name or city..."
      />

      {/* Multi-Select Employee Modal */}
      <MultiSelectEmployeeModal
        visible={employeeModalVisible}
        title="Assign Employees to Task"
        employees={employees}
        selectedIds={selectedEmployeeIds}
        onConfirm={(ids) => setSelectedEmployeeIds(ids)}
        onClose={() => setEmployeeModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '88%',
    display: 'flex',
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  formScroll: {
    paddingVertical: SPACING.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  pickerTriggerText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  pickerSubText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8FAFC',
  },
  priorityChipSelected: {
    borderColor: COLORS.primary,
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  priorityChipTextSelected: {
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerBtn: {
    flex: 1,
  },
});

export default TaskCreateModal;
