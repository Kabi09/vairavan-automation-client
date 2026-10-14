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
import dutyApi from '../../api/dutyApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import SignatureImage from '../../components/SignatureImage';
import ImageViewerModal from '../../components/ImageViewerModal';
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
  const [resolvedAddress, setResolvedAddress] = useState('');

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewSubtitle, setPreviewSubtitle] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState('');
  const [previewIsSignature, setPreviewIsSignature] = useState(false);

  useEffect(() => {
    const fetchDuty = async () => {
      try {
        setError('');
        const res = await dutyApi.getDutyById(dutyId);
        if (res.data?.duty) {
          const dutyRecord = res.data.duty;
          setDuty(dutyRecord);

          if (dutyRecord.location?.address) {
            setResolvedAddress(dutyRecord.location.address);
          } else if (dutyRecord.location?.latitude && dutyRecord.location?.longitude) {
            reverseGeocodeCoords(dutyRecord.location.latitude, dutyRecord.location.longitude)
              .then((addr) => {
                if (addr) setResolvedAddress(addr);
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
  }, [dutyId]);

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
    setPreviewSubtitle(duty.customerName ? `Client: ${duty.customerName}` : 'Service Verification');
    setPreviewTimestamp(formatDate(duty.dutyDate) || '');
    setPreviewIsSignature(false);
    setPreviewModalVisible(true);
  };

  const handleOpenSignaturePreview = (url, title = 'Customer Signature') => {
    setPreviewImageUri(url);
    setPreviewTitle(title);
    setPreviewSubtitle(duty.customerName ? `Client: ${duty.customerName}` : 'Service Verification');
    setPreviewTimestamp(signatureTimestamp);
    setPreviewIsSignature(true);
    setPreviewModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Work Visit Details"
        subtitle={`Report #${displayDutyId}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Client & Timing Banner */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.customerName}>{duty.customerName}</Text>
          </View>
          <Text style={styles.companyName}>
            {duty.company?.companyName || 'Client Company'}
          </Text>
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
            <Text style={styles.detailLabel}>Client Company:</Text>
            <Text style={styles.detailValue}>{duty.company?.companyName || 'N/A'}</Text>
          </View>

          {(duty.company?.location || duty.location?.address) ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Site Location:</Text>
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

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contact Phone:</Text>
            <Text style={styles.detailValue}>{duty.customerPhoneNumber}</Text>
          </View>
        </Card>

        {/* Work Description */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Work Carried Out</Text>
          <Text style={styles.descriptionText}>{duty.workDescription}</Text>
        </Card>

        {/* GPS Location & Interactive Map */}
        {duty.location?.latitude ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Service Location GPS</Text>

            {resolvedAddress ? (
              <View style={styles.exactAddressCard}>
                <Ionicons name="location" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exactAddressTitle}>Exact Location Name</Text>
                  <Text style={styles.exactAddressText}>{resolvedAddress}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.locationRow}>
              <Ionicons name="navigate-circle" size={26} color={COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.coordText}>
                  {duty.location.latitude.toFixed(5)}, {duty.location.longitude.toFixed(5)}
                </Text>
                {duty.location.accuracy ? (
                  <Text style={styles.accuracyText}>
                    Accuracy: ~{duty.location.accuracy} meters
                  </Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              style={styles.mapOpenBtn}
              onPress={() => {
                openMapLocation(
                  duty.location.latitude,
                  duty.location.longitude,
                  duty.customerName || 'Service Location'
                );
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={16} color="#FFFFFF" />
              <Text style={styles.mapOpenBtnText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Proof Photos */}
        {duty.customerProofPhotos?.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Service Proof Photos ({duty.customerProofPhotos.length})
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

        {/* Customer Signature */}
        {(duty.customerSignature?.url || (typeof duty.customerSignature === 'string' && duty.customerSignature) || duty.signature?.url) ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Customer Signature Verification</Text>
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
                  handleOpenSignaturePreview(sigUrl, 'Customer Signature');
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
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
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
});

export default DutyDetailsScreen;
