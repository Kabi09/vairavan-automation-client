import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import employeeApi from '../../api/employeeApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const EmployeeListScreen = ({ navigation }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Status toggle confirmation
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const fetchEmployees = useCallback(async (searchQuery = '') => {
    try {
      setError('');
      const params = { limit: 100 };
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const res = await employeeApi.getEmployees(params);
      if (res.data?.employees) {
        setEmployees(res.data.employees);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load employees'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees(search);
  }, [fetchEmployees, search]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployees(search);
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setStatusLoading(true);

    const newStatus = statusTarget.accountStatus === 'active' ? 'inactive' : 'active';
    try {
      await employeeApi.updateEmployeeStatus(statusTarget._id, newStatus);
      setStatusTarget(null);
      fetchEmployees(search);
    } catch (err) {
      Alert.alert('Status Change Failed', extractErrorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long');
      return;
    }
    setResetLoading(true);
    setResetError('');

    try {
      await employeeApi.resetEmployeePassword(resetTarget._id, newPassword);
      Alert.alert('Success', 'Password has been reset successfully');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setResetError(extractErrorMessage(err, 'Failed to reset password'));
    } finally {
      setResetLoading(false);
    }
  };

  const renderEmployeeItem = ({ item }) => (
    <Card
      style={styles.employeeCard}
      onPress={() => navigation.navigate('EmployeeDetails', { employee: item })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(item.employeeName || 'E').substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.employeeName}>{item.employeeName}</Text>
            {item.role === 'admin' ? (
              <View style={styles.adminTag}>
                <Text style={styles.adminTagText}>ADMIN</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.employeeSub}>
            ID: {item.employeeId} • {item.designation || 'Staff'}
          </Text>
          <Text style={styles.employeeEmail}>{item.email}</Text>
        </View>
        <StatusBadge status={item.accountStatus} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.phoneText}>
          <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />{' '}
          {item.phoneNumber || 'No phone'}
        </Text>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setResetTarget(item);
              setNewPassword('');
              setResetError('');
            }}
          >
            <Ionicons name="key-outline" size={19} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('EmployeeForm', { employee: item })}
          >
            <Ionicons name="create-outline" size={19} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setStatusTarget(item)}
          >
            <Ionicons
              name={item.accountStatus === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
              size={19}
              color={item.accountStatus === 'active' ? COLORS.danger : COLORS.success}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Employees"
        subtitle="Manage accounts and system access"
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('EmployeeForm')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={COLORS.textLight} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        <TextInputField
          placeholder="Search by name, ID, email, or designation..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        <ErrorMessage message={error} onRetry={() => fetchEmployees(search)} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading employees..." />
        ) : (
          <FlatList
            data={employees}
            keyExtractor={(item) => item._id}
            renderItem={renderEmployeeItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title="No Employees Found"
                description={
                  search
                    ? `No employees matching "${search}".`
                    : 'Register your staff and service technicians.'
                }
                actionTitle="Add New Employee"
                onAction={() => navigation.navigate('EmployeeForm')}
              />
            }
          />
        )}
      </View>

      {/* Status Confirmation Dialog */}
      <ConfirmationDialog
        visible={Boolean(statusTarget)}
        title={statusTarget?.accountStatus === 'active' ? 'Deactivate Employee' : 'Activate Employee'}
        message={`Are you sure you want to mark ${statusTarget?.employeeName} (${statusTarget?.employeeId}) as ${
          statusTarget?.accountStatus === 'active' ? 'inactive' : 'active'
        }?`}
        confirmText={statusTarget?.accountStatus === 'active' ? 'Deactivate' : 'Activate'}
        confirmVariant={statusTarget?.accountStatus === 'active' ? 'danger' : 'primary'}
        loading={statusLoading}
        onCancel={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
      />

      {/* Reset Password Modal */}
      <Modal
        visible={Boolean(resetTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setResetTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Employee Password</Text>
            <Text style={styles.modalSubtitle}>
              Set a new temporary password for {resetTarget?.employeeName} ({resetTarget?.employeeId})
            </Text>

            <ErrorMessage message={resetError} />

            <TextInputField
              label="New Password"
              placeholder="Enter at least 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              required
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setResetTarget(null)}
                disabled={resetLoading}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Update Password"
                onPress={handleResetPassword}
                loading={resetLoading}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addButtonText: {
    color: COLORS.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  searchBar: {
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  employeeCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  adminTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  adminTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  employeeSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  employeeEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  phoneText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBtn: {
    padding: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  modalBtn: {
    flex: 1,
  },
});

export default EmployeeListScreen;
