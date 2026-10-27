import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dutyApi from '../../api/dutyApi';
import expenseApi from '../../api/expenseApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import SignatureImage from '../../components/SignatureImage';
import ImageViewerModal from '../../components/ImageViewerModal';
import ExpenseClaimDetailModal, { parseExpenseItem } from '../../components/ExpenseClaimDetailModal';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { reverseGeocodeCoords, openMapLocation } from '../../utils/locationUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const DutyDetailsScreen = ({ navigation, route }) => {
  const { dutyId } = route.params;
  const { user, isAdmin } = useAuth();
  const [duty, setDuty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedCheckInAddress, setResolvedCheckInAddress] = useState('');
  const [resolvedCheckOutAddress, setResolvedCheckOutAddress] = useState('');
  const [dutyExpenses, setDutyExpenses] = useState([]);
  const [selectedExpenseForModal, setSelectedExpenseForModal] = useState(null);

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewSubtitle, setPreviewSubtitle] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState('');
  const [previewIsSignature, setPreviewIsSignature] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const fetchDuty = async () => {
        try {
          setError('');
          const res = await dutyApi.getDutyById(dutyId);
          if (res.data?.duty) {
            const dutyRecord = res.data.duty;
            setDuty(dutyRecord);

            // Fetch expenses for this duty
            try {
              const expApiCall = isAdmin ? expenseApi.getAllExpenses : expenseApi.getMyExpenses;
              const expRes = await expApiCall({ dutyId: dutyRecord._id || dutyRecord.dutyId, limit: 100 });
              const expList = expRes.data?.expenses || expRes.expenses || [];
              if (expList.length > 0) {
                setDutyExpenses(expList);
              } else if (dutyRecord.expenses && Array.isArray(dutyRecord.expenses)) {
                setDutyExpenses(dutyRecord.expenses);
              } else {
                setDutyExpenses([]);
              }
            } catch {
              if (dutyRecord.expenses && Array.isArray(dutyRecord.expenses)) {
                setDutyExpenses(dutyRecord.expenses);
              } else {
                setDutyExpenses([]);
              }
            }

            // Resolve Check-In address (or legacy location)
            const checkInLoc = dutyRecord.checkInLocation?.latitude
              ? dutyRecord.checkInLocation
              : dutyRecord.location;
            if (checkInLoc?.address) {
              setResolvedCheckInAddress(checkInLoc.address);
            } else if (checkInLoc?.latitude && checkInLoc?.longitude) {
              reverseGeocodeCoords(checkInLoc.latitude, checkInLoc.longitude)
                .then((addr) => {
                  if (addr) setResolvedCheckInAddress(addr);
                })
                .catch(() => {});
            }

            // Resolve Check-Out address
            const checkOutLoc = dutyRecord.checkOutLocation;
            if (checkOutLoc?.address) {
              setResolvedCheckOutAddress(checkOutLoc.address);
            } else if (checkOutLoc?.latitude && checkOutLoc?.longitude) {
              reverseGeocodeCoords(checkOutLoc.latitude, checkOutLoc.longitude)
                .then((addr) => {
                  if (addr) setResolvedCheckOutAddress(addr);
                })
                .catch(() => {});
            }
          }
        } catch (err) {
          setError(extractErrorMessage(err, 'Failed to load work report details'));
        } finally {
          setLoading(false);
        }
      };

      fetchDuty();
    }, [dutyId, isAdmin])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Work Details" onBack={() => navigation.goBack()} />
        <LoadingIndicator message="Loading report..." fullScreen />
      </SafeAreaView>
    );
  }

  if (error || !duty) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Work Details" onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <ErrorMessage message={error || 'Report not found'} />
        </View>
      </SafeAreaView>
    );
  }

  const canEdit =
    isAdmin ||
    (user && duty?.employee && (duty.employee._id === user._id || duty.employee === user._id));
  const canDelete = isAdmin;
  const displayDutyId = duty.dutyId || ('WORK-' + duty._id.substring(duty._id.length - 6).toUpperCase());

  const isOffice =
    duty?.company?.companyType === 'office' ||
    (typeof duty?.company?.companyName === 'string' &&
      duty.company.companyName.toLowerCase().includes('office'));

  const signatureTimestamp = duty.customerSignature?.signedAt
    ? new Date(duty.customerSignature.signedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      new Date(duty.customerSignature.signedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : duty.dutyDate && duty.outTime
    ? `${formatDate(duty.dutyDate)}, ${formatTime(duty.outTime)}`
    : '';

  const handleOpenPhotoPreview = (url, index) => {
    setPreviewImageUri(url);
    setPreviewTitle(`Proof Photo #${index + 1}`);
    setPreviewSubtitle(
      isOffice
        ? (duty.company?.companyName || 'Office Duty')
        : (duty.customerName ? `Client: ${duty.customerName}` : 'Service Verification')
    );
    setPreviewTimestamp(formatDate(duty.dutyDate) || '');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  const handleOpenSignaturePreview = (url, title = isOffice ? 'Office Sign-Off' : 'Customer Signature') => {
    setPreviewImageUri(url);
    setPreviewTitle(title);
    setPreviewSubtitle(
      isOffice
        ? (duty.company?.companyName || 'Office Duty')
        : (duty.customerName ? `Client: ${duty.customerName}` : 'Service Verification')
    );
    setPreviewTimestamp(signatureTimestamp);
    setPreviewIsSignature(true);
    setPreviewModalVisible(true);
  };

  const handleOpenExpensePhotoPreview = (url, itemName) => {
    setPreviewImageUri(url);
    setPreviewTitle(itemName ? `Expense Proof: ${itemName}` : 'Expense Bill / Proof');
    setPreviewSubtitle(displayDutyId ? `Work #${displayDutyId}` : '');
    setPreviewTimestamp('');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  const totalExpenseAmount = dutyExpenses.reduce(
    (sum, exp) => sum + (Number(exp.totalAmount) || Number(exp.amount) || 0),
    0
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={isOffice ? 'Office Work Details' : 'Work Visit Details'}
        subtitle={`Report #${displayDutyId}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Timing & Location Banner */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.customerName}>
              {isOffice ? (duty.company?.companyName || 'Office') : duty.customerName}
            </Text>
          </View>
          {!isOffice ? (
            <Text style={styles.companyName}>
              {duty.company?.companyName || 'Client Company'}
            </Text>
          ) : null}
          {(duty.company?.location || duty.location?.address) ? (
            <View style={styles.companyLocationRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.companyLocationText}>
                {duty.company?.location || duty.location?.address}
              </Text>
            </View>
          ) : null}
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
            <Text style={styles.dateText}>
              {formatDate(duty.dutyDate)} ({formatTime(duty.inTime)} - {formatTime(duty.outTime)})
            </Text>
          </View>
        </Card>

        {/* Technical Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Equipment & Work Type</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{isOffice ? 'Office:' : 'Client Company:'}</Text>
            <Text style={styles.detailValue}>
              {duty.company?.companyName || (isOffice ? 'Office' : 'N/A')}
            </Text>
          </View>

          {(duty.company?.location || duty.location?.address) ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{isOffice ? 'Office Location:' : 'Site Location:'}</Text>
              <Text style={styles.detailValue}>{duty.company?.location || duty.location?.address}</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Machine:</Text>
            <Text style={styles.detailValue}>{duty.machineName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Work Type:</Text>
            <Text style={styles.detailValue}>{formatWorkType(duty)}</Text>
          </View>

          {!isOffice ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact Person:</Text>
              <Text style={styles.detailValue}>
                {duty.client?.name || duty.customerName || 'N/A'}
                {(duty.client?.phoneNumber || duty.customerPhoneNumber)
                  ? ` (${duty.client?.phoneNumber || duty.customerPhoneNumber})`
                  : ''}
              </Text>
            </View>
          ) : null}

          {duty.checkInTime ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-In Time (IST):</Text>
              <Text style={styles.detailValue}>
                {new Date(duty.checkInTime).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </View>
          ) : null}

          {duty.checkOutTime ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-Out Time (IST):</Text>
              <Text style={styles.detailValue}>
                {new Date(duty.checkOutTime).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </View>
          ) : null}

          {duty.totalDurationMinutes ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={[styles.detailValue, { color: COLORS.primary, fontWeight: '700' }]}>
                {Math.floor(duty.totalDurationMinutes / 60)}h {duty.totalDurationMinutes % 60}m ({duty.totalDurationMinutes} mins)
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Features */}
        {duty.features && duty.features.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featuresContainer}>
              {duty.features.map((feat, idx) => (
                <View key={idx} style={styles.featureBadge}>
                  <Ionicons name="sparkles" size={12} color="#0369A1" />
                  <Text style={styles.featureBadgeText}>{feat}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Manpower Members */}
        {duty.manpowerMembers && duty.manpowerMembers.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Manpower Team ({duty.manpowerMembers.length})
            </Text>
            {duty.manpowerMembers.map((m, idx) => (
              <View key={idx} style={styles.manpowerCard}>
                <View style={styles.manpowerHeader}>
                  <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.manpowerName}>{m.name}</Text>
                  {m.phone ? (
                    <Text style={styles.manpowerPhone}>• {m.phone}</Text>
                  ) : null}
                </View>
                {m.description ? (
                  <Text style={styles.manpowerDesc}>{m.description}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        )}

        {/* Work Description */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Work Carried Out</Text>
          <Text style={styles.descriptionText}>{duty.workDescription}</Text>
        </Card>

        {/* GPS Locations: Check-In Location & Check-Out Location */}
        {Boolean(
          (duty.checkInLocation?.latitude || duty.location?.latitude) ||
          duty.checkOutLocation?.latitude
        ) && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Visit GPS Locations</Text>

            {/* 1. Check-In Location */}
            {(duty.checkInLocation?.latitude || duty.location?.latitude) ? (
              <View style={styles.detailLocationBlock}>
                <View style={styles.detailLocationHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="log-in" size={18} color="#059669" />
                    <Text style={styles.detailLocationTitle}>Check-In Location</Text>
                  </View>
                  <View style={styles.detailLocationTagCheckIn}>
                    <Text style={styles.detailLocationTagTextCheckIn}>Check-In</Text>
                  </View>
                </View>

                {(resolvedCheckInAddress || duty.checkInLocation?.address || duty.location?.address) ? (
                  <View style={styles.exactAddressCard}>
                    <Ionicons name="location" size={18} color="#059669" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exactAddressTitle}>Recorded Address</Text>
                      <Text style={styles.exactAddressText}>
                        {resolvedCheckInAddress || duty.checkInLocation?.address || duty.location?.address}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.locationRow}>
                  <Ionicons name="navigate-circle" size={22} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordText}>
                      {(duty.checkInLocation?.latitude || duty.location?.latitude).toFixed(5)},{' '}
                      {(duty.checkInLocation?.longitude || duty.location?.longitude).toFixed(5)}
                    </Text>
                    {(duty.checkInLocation?.accuracy || duty.location?.accuracy) ? (
                      <Text style={styles.accuracyText}>
                        Accuracy: ~{duty.checkInLocation?.accuracy || duty.location?.accuracy} meters
                      </Text>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.mapOpenBtn, styles.mapOpenBtnCheckIn]}
                  onPress={() => {
                    const lat = duty.checkInLocation?.latitude || duty.location?.latitude;
                    const lng = duty.checkInLocation?.longitude || duty.location?.longitude;
                    openMapLocation(lat, lng, `${duty.customerName || 'Service'} Check-In`);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="map-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.mapOpenBtnText}>Open Check-In on Google Maps</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* 2. Check-Out Location */}
            {duty.checkOutLocation?.latitude ? (
              <View style={[styles.detailLocationBlock, styles.detailLocationBlockCheckOut]}>
                <View style={styles.detailLocationHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="log-out" size={18} color={COLORS.primary} />
                    <Text style={styles.detailLocationTitle}>Check-Out Location</Text>
                  </View>
                  <View style={styles.detailLocationTagCheckOut}>
                    <Text style={styles.detailLocationTagTextCheckOut}>Check-Out</Text>
                  </View>
                </View>

                {(resolvedCheckOutAddress || duty.checkOutLocation?.address) ? (
                  <View style={[styles.exactAddressCard, styles.exactAddressCardCheckout]}>
                    <Ionicons name="location" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exactAddressTitle}>Departure Address</Text>
                      <Text style={styles.exactAddressText}>
                        {resolvedCheckOutAddress || duty.checkOutLocation?.address}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.locationRow}>
                  <Ionicons name="navigate-circle" size={22} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordText}>
                      {duty.checkOutLocation.latitude.toFixed(5)}, {duty.checkOutLocation.longitude.toFixed(5)}
                    </Text>
                    {duty.checkOutLocation.accuracy ? (
                      <Text style={styles.accuracyText}>
                        Accuracy: ~{duty.checkOutLocation.accuracy} meters
                      </Text>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.mapOpenBtn}
                  onPress={() => {
                    openMapLocation(
                      duty.checkOutLocation.latitude,
                      duty.checkOutLocation.longitude,
                      `${duty.customerName || 'Service'} Check-Out`
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="map-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.mapOpenBtnText}>Open Check-Out on Google Maps</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Card>
        )}

        {/* Proof Photos */}
        {duty.customerProofPhotos?.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {isOffice ? 'Office Proof Photos' : 'Service Proof Photos'} ({duty.customerProofPhotos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {duty.customerProofPhotos.map((photo, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleOpenPhotoPreview(photo.url, i)}
                  activeOpacity={0.85}
                  style={styles.photoThumbWrap}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoThumb}
                  />
                  <View style={styles.photoZoomHint}>
                    <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Signature */}
        {(duty.customerSignature?.url || (typeof duty.customerSignature === 'string' && duty.customerSignature) || duty.signature?.url) ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {isOffice ? 'Office Sign-Off Verification' : 'Customer Signature Verification'}
            </Text>
            <View style={styles.signatureBox}>
              <SignatureImage
                uri={
                  duty.customerSignature?.url ||
                  (typeof duty.customerSignature === 'string' ? duty.customerSignature : '') ||
                  duty.signature?.url
                }
                height={130}
                timestamp={signatureTimestamp}
                onPress={() => {
                  const sigUrl =
                    duty.customerSignature?.url ||
                    (typeof duty.customerSignature === 'string' ? duty.customerSignature : '') ||
                    duty.signature?.url;
                  handleOpenSignaturePreview(sigUrl, isOffice ? 'Office Sign-Off' : 'Customer Signature');
                }}
              />
            </View>
          </Card>
        ) : null}

        {/* Employee Signature (if separately uploaded) */}
        {duty.signature?.url && duty.signature?.url !== duty.customerSignature?.url ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Employee Signature Verification</Text>
            <View style={styles.signatureBox}>
              <SignatureImage
                uri={duty.signature.url}
                height={130}
                timestamp={signatureTimestamp}
                onPress={() => handleOpenSignaturePreview(duty.signature.url, 'Employee Signature')}
              />
            </View>
          </Card>
        ) : null}

        {/* Expenses & Claims Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.expenseSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="receipt" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Expenses & Claims</Text>
            </View>
            <View style={styles.expenseHeaderBadges}>
              {dutyExpenses.length > 0 && (
                <View style={styles.expenseCountBadge}>
                  <Text style={styles.expenseCountText}>{dutyExpenses.length} Claims</Text>
                </View>
              )}
              {totalExpenseAmount > 0 && (
                <View style={styles.expenseTotalBadge}>
                  <Text style={styles.expenseTotalText}>₹{totalExpenseAmount.toLocaleString('en-IN')}</Text>
                </View>
              )}
            </View>
          </View>

          {dutyExpenses.length === 0 ? (
            <View style={styles.emptyExpenseBox}>
              <Ionicons name="receipt-outline" size={30} color={COLORS.textLight} />
              <Text style={styles.emptyExpenseText}>No expenses or claims submitted yet for this work.</Text>
            </View>
          ) : (
            <View style={styles.expensesList}>
              {dutyExpenses.map((exp, expIdx) => {
                const claimId = exp.expenseId || `EXP-${expIdx + 1}`;
                const expDate = exp.expenseDate ? formatDate(exp.expenseDate) : '';
                const items = exp.items && exp.items.length > 0 ? exp.items : [
                  {
                    category: exp.category || 'other',
                    customCategory: exp.customCategory || '',
                    amount: exp.amount || exp.totalAmount || 0,
                    description: exp.description || '',
                    billProof: exp.billProof || null,
                  }
                ];

                const totalClaimAmt = Number(exp.grandTotal ?? exp.totalAmount ?? exp.amount ?? 0);

                return (
                  <TouchableOpacity
                    key={exp._id || `exp-${expIdx}`}
                    style={styles.expenseClaimCard}
                    onPress={() => setSelectedExpenseForModal(exp)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.expenseClaimHeader}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.expenseClaimId}>{claimId}</Text>
                          {exp.status ? <StatusBadge status={exp.status} /> : null}
                        </View>
                        {expDate ? <Text style={styles.expenseClaimDate}>{expDate}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.expenseClaimTotal}>
                          ₹{totalClaimAmt.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>

                    {/* Itemized lines without large images cluttering */}
                    <View style={styles.expenseItemsTable}>
                      {items.map((itemRaw, itemIdx) => {
                        const item = parseExpenseItem(itemRaw, itemIdx);

                        return (
                          <View key={`item-${itemIdx}`} style={styles.expenseItemRow}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={styles.itemBullet} />
                                <Text style={styles.expenseItemCat}>{item.displayTitle}</Text>
                              </View>
                              {item.calcText ? (
                                <Text style={styles.expenseItemCalc}>{item.calcText}</Text>
                              ) : null}
                              {item.description ? (
                                <Text style={styles.expenseItemDesc}>{item.description}</Text>
                              ) : null}
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={styles.expenseItemAmount}>
                                ₹{item.amount.toLocaleString('en-IN')}
                              </Text>
                              {item.proofUrls.length > 0 && (
                                <View style={styles.proofCountPill}>
                                  <Ionicons name="document-attach" size={11} color="#0369A1" />
                                  <Text style={styles.proofCountPillText}>
                                    {item.proofUrls.length} {item.proofUrls.length === 1 ? 'Proof' : 'Proofs'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Tap to view full detail with proof img hint */}
                    <View style={styles.claimTapHintRow}>
                      <Text style={styles.claimTapHintText}>Tap to view full detail with proof img</Text>
                      <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Action button to add / add more expenses */}
          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => navigation.navigate('ExpenseForm', { duty })}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.addExpenseBtnText}>
              {dutyExpenses.length > 0 ? '+ Add More Expenses for this Work' : '+ Add Expense for this Work'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Action Buttons: Admin has Edit + Delete, Employee has Edit */}
        {(canEdit || canDelete) && (
          <View style={styles.actionRow}>
            {canEdit && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => navigation.navigate('DutyForm', { dutyToEdit: duty })}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Edit Work Report</Text>
              </TouchableOpacity>
            )}

            {canDelete && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => {
                  Alert.alert(
                    'Delete Work Report',
                    'Are you sure you want to permanently delete this work record?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await dutyApi.deleteDuty(duty._id);
                            Alert.alert('Deleted', 'Work report deleted successfully.', [
                              { text: 'OK', onPress: () => navigation.goBack() },
                            ]);
                          } catch (delErr) {
                            Alert.alert('Delete Failed', extractErrorMessage(delErr, 'Failed to delete work report'));
                          }
                        },
                      },
                    ]
                  );
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </ScrollView>

      <ExpenseClaimDetailModal
        visible={Boolean(selectedExpenseForModal)}
        expense={selectedExpenseForModal}
        duty={duty}
        onClose={() => setSelectedExpenseForModal(null)}
        onOpenPhoto={(url, title) => handleOpenExpensePhotoPreview(url, title)}
      />

      <ImageViewerModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        imageUri={previewImageUri}
        title={previewTitle}
        subtitle={previewSubtitle}
        timestamp={previewTimestamp}
        isSignature={previewIsSignature}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  errorContainer: {
    padding: SPACING.lg,
  },
  headerCard: {
    marginBottom: SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  companyName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  companyLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  companyLocationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  reviewRemarksCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: SPACING.md,
  },
  remarksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  remarksTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  remarksBody: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  sectionCard: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  exactAddressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.sm,
  },
  exactAddressTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  exactAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 18,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  coordText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  accuracyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoThumbWrap: {
    position: 'relative',
    marginRight: SPACING.sm,
  },
  photoThumb: {
    width: 110,
    height: 110,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  photoZoomHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 4,
    padding: 3,
  },
  signatureBox: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 90,
  },
  mapOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  mapOpenBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  mapOpenBtnCheckIn: {
    backgroundColor: '#059669',
  },
  detailLocationBlock: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  detailLocationBlockCheckOut: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    marginTop: SPACING.sm,
  },
  detailLocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  detailLocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailLocationTagCheckIn: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  detailLocationTagTextCheckIn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  detailLocationTagCheckOut: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  detailLocationTagTextCheckOut: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  exactAddressCardCheckout: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  editBtn: {
    backgroundColor: COLORS.primary,
  },
  deleteBtn: {
    backgroundColor: COLORS.danger,
    maxWidth: 110,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featureBadgeText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '700',
  },
  manpowerCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: 8,
  },
  manpowerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manpowerName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  manpowerPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  manpowerDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    paddingLeft: 26,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    marginTop: 10,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  expenseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  expenseHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expenseCountBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  expenseCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  expenseTotalBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  expenseTotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  emptyExpenseBox: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    marginVertical: 6,
    gap: 6,
  },
  emptyExpenseText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  expensesList: {
    gap: 10,
    marginVertical: 6,
  },
  expenseClaimCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  expenseClaimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  expenseClaimId: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  expenseClaimDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  expenseClaimTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
  },
  expenseItemsTable: {
    gap: 8,
  },
  expenseItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  itemBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  expenseItemCat: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  expenseItemCalc: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
    marginLeft: 12,
    marginTop: 1,
  },
  expenseItemDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 12,
    marginTop: 2,
  },
  expenseItemAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  proofThumbnailBtn: {
    position: 'relative',
    marginTop: 4,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  proofThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 5,
  },
  proofBadgeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    gap: 2,
  },
  proofBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  claimProofsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  claimProofsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  proofCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 2,
  },
  proofCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  claimTapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  claimTapHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default DutyDetailsScreen;
