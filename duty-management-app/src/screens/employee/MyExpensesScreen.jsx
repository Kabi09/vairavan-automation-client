import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import expenseApi from '../../api/expenseApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import ImageViewerModal from '../../components/ImageViewerModal';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const MyExpensesScreen = ({ navigation }) => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Details Modal
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Lightbox Preview Modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const fetchExpenses = async () => {
    try {
      setError('');
      const res = await expenseApi.getMyExpenses();
      if (res.data) {
        setExpenses(res.data.expenses || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your expenses'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
  };

  // Filtered expenses based on search query
  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter((e) => {
      const expId = (e.expenseId || '').toLowerCase();
      const comp = (e.company?.companyName || '').toLowerCase();
      const client = (e.client?.name || '').toLowerCase();
      const desc = (e.generalDescription || '').toLowerCase();
      const itemsMatch = (e.items || []).some(
        (it) =>
          (it.categoryName || '').toLowerCase().includes(q) ||
          (it.customCategoryName || '').toLowerCase().includes(q) ||
          (it.description || '').toLowerCase().includes(q)
      );
      return expId.includes(q) || comp.includes(q) || client.includes(q) || desc.includes(q) || itemsMatch;
    });
  }, [expenses, search]);

  const renderExpenseItem = ({ item }) => {
    const categoriesList = [
      ...new Set(
        (item.items || []).map((it) =>
          it.categoryName === 'Others' && it.customCategoryName
            ? it.customCategoryName
            : it.categoryName
        )
      ),
    ].join(', ');

    return (
      <Card style={styles.expenseCard} onPress={() => setSelectedExpense(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.idContainer}>
            <Text style={styles.expenseIdBadge}>{item.expenseId || 'EXP'}</Text>
            <Text style={styles.expenseDate}>{formatDate(item.expenseDate)}</Text>
          </View>
          <Text style={styles.grandTotalText}>
            ₹{(item.grandTotal || 0).toLocaleString('en-IN')}
          </Text>
        </View>

        {item.company ? (
          <View style={styles.companyRow}>
            <Ionicons name="business-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.companyText}>
              {item.company.companyName}
              {item.client ? ` • Contact: ${item.client.clientName || item.client.name}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.categoriesRow}>
          <Ionicons name="pricetags-outline" size={13} color={COLORS.primary} />
          <Text style={styles.categoriesText} numberOfLines={1}>
            {categoriesList || 'General Expense'}
          </Text>
        </View>

        {item.generalDescription ? (
          <Text style={styles.descSnippet} numberOfLines={2}>
            {item.generalDescription}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.itemsCountText}>
            {item.items?.length || 0} item{item.items?.length === 1 ? '' : 's'}
          </Text>
          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="My Expenses"
        subtitle="Manage and track your submitted expenses"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => navigation.navigate('ExpenseForm')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Metric Cards Banner */}
        {summary ? (
          <View style={styles.metricsContainer}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Claimed</Text>
              <Text style={styles.metricValue}>
                ₹{(summary.totalAmount || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricSub}>{summary.totalCount || 0} submissions</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>This Month</Text>
              <Text style={styles.metricValue}>
                ₹{(summary.monthAmount || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricSub}>{summary.monthCount || 0} claims</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Today</Text>
              <Text style={styles.metricValue}>
                ₹{(summary.todayAmount || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.metricSub}>{summary.todayCount || 0} claims</Text>
            </View>
          </View>
        ) : null}

        {/* Search Input */}
        <View style={styles.searchWrap}>
          <TextInputField
            placeholder="Search by ID, company, category, description..."
            value={search}
            onChangeText={setSearch}
            leftIcon="search-outline"
            clearButtonMode="while-editing"
          />
        </View>

        <ErrorMessage message={error} onRetry={fetchExpenses} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading expenses..." />
        ) : (
          <FlatList
            data={filteredExpenses}
            keyExtractor={(item) => item._id}
            renderItem={renderExpenseItem}
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
                icon="receipt-outline"
                title="No Expenses Found"
                message={
                  search
                    ? 'No expenses match your search query.'
                    : 'You have not submitted any expenses yet. Tap "+ Add Expense" to create one.'
                }
              />
            }
          />
        )}

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('ExpenseForm')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      {/* Expense Details Modal (Read-Only, Zero Approval Workflow) */}
      <Modal
        visible={Boolean(selectedExpense)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExpense(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Expense #{selectedExpense?.expenseId}
                </Text>
                <Text style={styles.modalSub}>
                  Submitted on {selectedExpense?.createdAt ? new Date(selectedExpense.createdAt).toLocaleString('en-IN') : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedExpense(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Basic Details Info */}
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockLabel}>Expense Date</Text>
                <Text style={styles.detailBlockValue}>
                  {selectedExpense?.expenseDate ? formatDate(selectedExpense.expenseDate) : 'N/A'}
                </Text>
              </View>

              {selectedExpense?.company ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Company & Client</Text>
                  <Text style={styles.detailBlockValue}>
                    {selectedExpense.company.companyName}
                    {selectedExpense.client
                      ? ` • ${selectedExpense.client.clientName || selectedExpense.client.name} (${selectedExpense.client.clientPhoneNumber || selectedExpense.client.phoneNumber || ''})`
                      : ''}
                  </Text>
                </View>
              ) : null}

              {selectedExpense?.relatedDuty ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Related Work / Duty</Text>
                  <Text style={styles.detailBlockValue}>{selectedExpense.relatedDuty}</Text>
                </View>
              ) : null}

              {selectedExpense?.generalDescription ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>General Description</Text>
                  <Text style={styles.detailBlockDesc}>{selectedExpense.generalDescription}</Text>
                </View>
              ) : null}

              {/* Items Breakdown */}
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockLabel}>
                  Expense Items ({selectedExpense?.items?.length || 0})
                </Text>

                {selectedExpense?.items?.map((item, idx) => (
                  <View key={idx} style={styles.itemDetailCard}>
                    <View style={styles.itemDetailTop}>
                      <Text style={styles.itemDetailName}>
                        {item.categoryName === 'Others' && item.customCategoryName
                          ? `Others: ${item.customCategoryName}`
                          : item.categoryName}
                      </Text>
                      <Text style={styles.itemDetailAmount}>
                        ₹{(item.amount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {item.calculationMode === 'automatic' && item.quantity ? (
                      <Text style={styles.itemDetailCalc}>
                        Outbound: {item.outboundDistanceKm || 0} km • Return: {item.returnDistanceKm || 0} km • Total: {item.quantity} {item.unit || 'km'} @ ₹{item.appliedRate}/{item.unit || 'km'}
                      </Text>
                    ) : null}

                    {item.description ? (
                      <Text style={styles.itemDetailDesc}>{item.description}</Text>
                    ) : null}

                    {/* Attachments */}
                    {item.attachments && item.attachments.length > 0 ? (
                      <View style={styles.itemAttachContainer}>
                        <Text style={styles.itemAttachTitle}>Proof Attachments:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                          {item.attachments.map((att, aIdx) => (
                            <TouchableOpacity
                              key={aIdx}
                              onPress={() => {
                                setPreviewImageUri(att.url);
                                setPreviewTitle(`Proof - ${item.categoryName}`);
                                setPreviewModalVisible(true);
                              }}
                              style={styles.itemAttachThumbWrap}
                            >
                              <Image source={{ uri: att.url }} style={styles.itemAttachThumb} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Grand Total */}
              <View style={styles.grandTotalBox}>
                <Text style={styles.grandTotalBoxLabel}>Grand Total</Text>
                <Text style={styles.grandTotalBoxValue}>
                  ₹{(selectedExpense?.grandTotal || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Lightbox Preview */}
      <ImageViewerModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        imageUri={previewImageUri}
        title={previewTitle}
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
    padding: SPACING.md,
  },
  headerAddBtn: {
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchWrap: {
    marginBottom: SPACING.xs,
  },
  listContent: {
    paddingBottom: 80,
  },
  expenseCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseIdBadge: {
    backgroundColor: '#F0F9FF',
    color: '#0369A1',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  expenseDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  grandTotalText: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.primary,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  companyText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  categoriesText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  descSnippet: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  itemsCountText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
    ...SHADOWS.md,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '90%',
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalScroll: {
    marginBottom: SPACING.md,
  },
  detailBlock: {
    marginBottom: SPACING.md,
  },
  detailBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  detailBlockValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailBlockDesc: {
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemDetailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  itemDetailTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetailName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemDetailAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  itemDetailCalc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemDetailDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  itemAttachContainer: {
    marginTop: 6,
  },
  itemAttachTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  itemAttachThumbWrap: {
    marginRight: 8,
  },
  itemAttachThumb: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  grandTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  grandTotalBoxLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalBoxValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },
});

export default MyExpensesScreen;
