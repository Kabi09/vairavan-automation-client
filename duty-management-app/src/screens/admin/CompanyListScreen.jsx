import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import companyApi from '../../api/companyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportCompaniesToPDF, exportCompaniesToExcel } from '../../utils/exportUtils';
import { useResponsive } from '../../hooks/useResponsive';
import { useData, CACHE_TTL } from '../../context/DataContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const CompanyListScreen = ({ navigation }) => {
  const { isDesktop } = useResponsive();
  const { fetchWithCache, syncCompany } = useData();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'office' | 'client'
  const [error, setError] = useState('');

  // Deactivate modal state
  const [companyToDeactivate, setCompanyToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchCompanies = useCallback(async (searchQuery = '', force = false) => {
    try {
      setError('');
      const params = { limit: 100 };
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const companiesData = await fetchWithCache(
        `companies_list_${searchQuery.trim()}`,
        async () => {
          const res = await companyApi.getCompanies(params);
          return res.data?.companies || [];
        },
        { ttl: CACHE_TTL.LISTS, forceRefresh: force }
      );
      if (companiesData) {
        setCompanies(companiesData);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load companies'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchWithCache]);

  useFocusEffect(
    useCallback(() => {
      fetchCompanies(search);
    }, [fetchCompanies, search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompanies(search, true);
  };

  const handleDeactivateConfirm = async () => {
    if (!companyToDeactivate) return;
    setDeactivating(true);

    try {
      await companyApi.deleteCompany(companyToDeactivate._id);
      syncCompany();
      setCompanyToDeactivate(null);
      fetchCompanies(search, true);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to deactivate company'));
    } finally {
      setDeactivating(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (typeFilter === 'office') return c.companyType === 'office';
      if (typeFilter === 'client') return c.companyType !== 'office';
      return true;
    });
  }, [companies, typeFilter]);

  const officeCount = companies.filter((c) => c.companyType === 'office').length;
  const clientCount = companies.filter((c) => c.companyType !== 'office').length;

  const handleExportPDF = () => {
    const subtitle =
      typeFilter === 'office'
        ? 'Offices & Branches Directory'
        : typeFilter === 'client'
        ? 'Client Companies Directory'
        : 'Company & Office Directory';

    exportCompaniesToPDF({
      title: 'Companies & Offices Directory',
      subtitle,
      companies: filteredCompanies,
      filterInfo: search ? `Filter: "${search}"` : `Type: ${typeFilter.toUpperCase()}`,
    });
  };

  const handleExportExcel = () => {
    exportCompaniesToExcel({
      filename: `Companies_${typeFilter}`,
      companies: filteredCompanies,
    });
  };

  const renderCompanyItem = ({ item }) => {
    const isOffice = item.companyType === 'office';
    return (
      <Card
        style={styles.companyCard}
        onPress={() => navigation.navigate('CompanyDetails', { company: item })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.companyName}>{item.companyName}</Text>
            </View>
            <Text style={styles.locationText}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />{' '}
              {item.location}
            </Text>
          </View>
          <View style={styles.badgeCol}>
            <StatusBadge status={item.status} />
            <View
              style={[
                styles.typeBadgePill,
                isOffice ? styles.typeBadgePillOffice : styles.typeBadgePillClient,
              ]}
            >
              <Ionicons
                name={isOffice ? 'business' : 'storefront'}
                size={11}
                color={isOffice ? '#1E40AF' : '#047857'}
              />
              <Text
                style={[
                  styles.typeBadgePillText,
                  { color: isOffice ? '#1E40AF' : '#047857' },
                ]}
              >
                {isOffice ? 'Office' : 'Client'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.phoneText}>
            <Ionicons name="call-outline" size={14} color={COLORS.textSecondary} />{' '}
            {item.companyPhoneNumber}
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => navigation.navigate('CompanyForm', { company: item })}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            {Boolean(item.status === 'active') ? (
              <TouchableOpacity
                style={styles.iconAction}
                onPress={() => setCompanyToDeactivate(item)}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Companies"
        subtitle="Manage client and factory locations"
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CompanyForm')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={COLORS.textLight} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        <TextInputField
          placeholder="Search by company, location, or phone..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchBar}
        />

        {/* Export Buttons */}
        <View style={styles.exportBarRow}>
          <TouchableOpacity
            style={[styles.exportBtn, styles.pdfBtn]}
            onPress={handleExportPDF}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, styles.excelBtn]}
            onPress={handleExportExcel}
            activeOpacity={0.8}
          >
            <Ionicons name="grid" size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export Excel</Text>
          </TouchableOpacity>
        </View>

        {/* Type Filter Tabs: All, Offices, Client Companies */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, typeFilter === 'all' && styles.filterTabActive]}
            onPress={() => setTypeFilter('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterTabText,
                typeFilter === 'all' && styles.filterTabTextActive,
              ]}
            >
              All ({companies.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, typeFilter === 'office' && styles.filterTabActive]}
            onPress={() => setTypeFilter('office')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={13}
              color={typeFilter === 'office' ? '#FFFFFF' : '#1E40AF'}
            />
            <Text
              style={[
                styles.filterTabText,
                typeFilter === 'office' && styles.filterTabTextActive,
                typeFilter !== 'office' && { color: '#1E40AF' },
              ]}
            >
              Offices ({officeCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, typeFilter === 'client' && styles.filterTabActive]}
            onPress={() => setTypeFilter('client')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="storefront"
              size={13}
              color={typeFilter === 'client' ? '#FFFFFF' : '#047857'}
            />
            <Text
              style={[
                styles.filterTabText,
                typeFilter === 'client' && styles.filterTabTextActive,
                typeFilter !== 'client' && { color: '#047857' },
              ]}
            >
              Clients ({clientCount})
            </Text>
          </TouchableOpacity>
        </View>

        <ErrorMessage message={error} onRetry={() => fetchCompanies(search)} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading companies..." />
        ) : (
          <FlatList
            data={filteredCompanies}
            keyExtractor={(item) => item._id}
            renderItem={renderCompanyItem}
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
                icon="business-outline"
                title="No Companies Found"
                description={
                  search
                    ? `No companies matching "${search}".`
                    : 'Get started by adding your first client company.'
                }
                actionTitle="Add New Company"
                onAction={() => navigation.navigate('CompanyForm')}
              />
            }
          />
        )}
      </View>

      <ConfirmationDialog
        visible={Boolean(companyToDeactivate)}
        title="Deactivate Company"
        message={`Are you sure you want to deactivate "${companyToDeactivate?.companyName}"? Active duty reports will be preserved, but new submissions will be disabled.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        loading={deactivating}
        onCancel={() => setCompanyToDeactivate(null)}
        onConfirm={handleDeactivateConfirm}
      />
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
  companyCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
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
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconAction: {
    padding: SPACING.xs,
  },
  exportBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  pdfBtn: {
    backgroundColor: '#DC2626',
  },
  excelBtn: {
    backgroundColor: '#16A34A',
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  badgeCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  typeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
  },
  typeBadgePillOffice: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  typeBadgePillClient: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  typeBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CompanyListScreen;
