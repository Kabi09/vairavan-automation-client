import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dutyApi from '../../api/dutyApi';
import taskApi from '../../api/taskApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const DutyDetailsScreen = ({ navigation, route }) => {
  const { dutyId } = route.params;
  const [duty, setDuty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDuty = async () => {
      try {
        setError('');
        const res = await dutyApi.getDutyById(dutyId);
        if (res.data?.duty) {
          const dutyData = res.data.duty;
          setDuty(dutyData);

          // If task is an ID string rather than populated object, fetch task details
          if (dutyData.task && typeof dutyData.task === 'string') {
            try {
              const taskRes = await taskApi.getTaskById(dutyData.task);
              if (taskRes.data?.task) {
                setDuty((prev) => ({ ...prev, task: taskRes.data.task }));
              }
            } catch {}
          }
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load duty report details'));
      } finally {
        setLoading(false);
      }
    };

    fetchDuty();
  }, [dutyId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Duty Details" onBack={() => navigation.goBack()} />
        <LoadingIndicator message="Loading report..." fullScreen />
      </SafeAreaView>
    );
  }

  if (error || !duty) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Duty Details" onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <ErrorMessage message={error || 'Report not found'} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Duty Visit Details"
        subtitle={`Report #${duty._id.substring(duty._id.length - 6).toUpperCase()}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status & Timing Banner */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.customerName}>{duty.customerName}</Text>
            <StatusBadge status={duty.status} />
          </View>
          <Text style={styles.companyName}>
            {duty.company?.companyName || 'Client Location'}
          </Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
            <Text style={styles.dateText}>
              {formatDate(duty.dutyDate)} ({formatTime(duty.inTime)} - {formatTime(duty.outTime)})
            </Text>
          </View>
        </Card>

        {/* Manager Review Remarks if reviewed */}
        {duty.adminReview?.remarks ? (
          <Card style={styles.reviewRemarksCard}>
            <View style={styles.remarksHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primary} />
              <Text style={styles.remarksTitle}>Manager Feedback</Text>
            </View>
            <Text style={styles.remarksBody}>{duty.adminReview.remarks}</Text>
          </Card>
        ) : null}

        {/* Technical Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Equipment & Work Type</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Machine:</Text>
            <Text style={styles.detailValue}>{duty.machineName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Work Type:</Text>
            <Text style={styles.detailValue}>{duty.workType}</Text>
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
                const lat = duty.location.latitude;
                const lng = duty.location.longitude;
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {
                  Alert.alert('Map Error', 'Unable to open maps application');
                });
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
                <Image
                  key={i}
                  source={{ uri: photo.url }}
                  style={styles.photoThumb}
                />
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Customer Signature */}
        {duty.customerSignature?.url ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Customer Signature Verification</Text>
            <View style={styles.signatureBox}>
              <Image
                source={{ uri: duty.customerSignature.url }}
                style={styles.signatureImage}
                resizeMode="contain"
              />
            </View>
          </Card>
        ) : null}

        {/* Employee Signature (if separately uploaded) */}
        {duty.signature?.url && duty.signature?.url !== duty.customerSignature?.url ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Employee Signature Verification</Text>
            <View style={styles.signatureBox}>
              <Image
                source={{ uri: duty.signature.url }}
                style={styles.signatureImage}
                resizeMode="contain"
              />
            </View>
          </Card>
        ) : null}

        {/* Linked Assigned Task Card */}
        {duty.task && typeof duty.task === 'object' ? (
          <Card style={[styles.sectionCard, styles.linkedTaskCard]}>
            <View style={styles.taskCardHeader}>
              <View style={styles.taskHeaderTitleWrap}>
                <Ionicons name="clipboard" size={18} color={COLORS.primary} />
                <Text style={styles.linkedTaskTitle}>Assigned Task Details</Text>
              </View>
              <StatusBadge status={duty.task.status || 'completed'} />
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Task Title:</Text>
              <Text style={styles.detailValue}>{duty.task.taskName}</Text>
            </View>

            {duty.task.scheduledDate || duty.task.date ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Task Date:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(duty.task.scheduledDate || duty.task.date)}
                </Text>
              </View>
            ) : null}

            {duty.task.companyName ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Client Site:</Text>
                <Text style={styles.detailValue}>{duty.task.companyName}</Text>
              </View>
            ) : null}

            {duty.task.work ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Work Category:</Text>
                <Text style={styles.detailValue}>{duty.task.work}</Text>
              </View>
            ) : null}

            {duty.task.phoneNumber ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Phone:</Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${duty.task.phoneNumber}`).catch(() => {})}
                  style={styles.taskPhoneRow}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={13} color={COLORS.primary} />
                  <Text style={styles.taskPhoneText}>{duty.task.phoneNumber}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {duty.task.description ? (
              <View style={styles.taskInstructionBox}>
                <Text style={styles.taskInstructionLabel}>Manager Instructions / Notes:</Text>
                <Text style={styles.taskInstructionText}>{duty.task.description}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
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
  photoThumb: {
    width: 110,
    height: 110,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  signatureBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
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
  linkedTaskCard: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    marginTop: SPACING.xs,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  taskHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkedTaskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  taskPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  taskPhoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  taskInstructionBox: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  taskInstructionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  taskInstructionText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.text,
  },
});

export default DutyDetailsScreen;
