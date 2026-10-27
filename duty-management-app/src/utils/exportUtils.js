import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import { formatWorkType } from './dutyUtils';

const LOGO_URL =
  'https://res.cloudinary.com/etdurbgp/image/upload/v1791802852/vairavan_app/app_logo.png';

const SAVED_DOWNLOAD_DIR_KEY = 'saved_download_directory_uri';

const BRANDING_PDF_FOOTER_HTML = `
  <div style="margin-top: 6px; font-size: 10px; color: #64748b; text-align: center;">
    Developed by <a href="https://www.ameyy.in/" target="_blank" style="color: #1e40af; font-weight: 600; text-decoration: underline; text-decoration-color: #1e40af;">Ameyy Digital Services</a> <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: 0px; margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
  </div>
`;

/**
 * Format date nicely for display in India Standard Time (Asia/Kolkata)
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? String(dateStr)
      : d.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
  } catch {
    return String(dateStr);
  }
};

/**
 * Format time in India Standard Time (Asia/Kolkata)
 */
const formatTimeIST = (timeOrDate) => {
  if (!timeOrDate) return 'N/A';
  if (typeof timeOrDate === 'string' && timeOrDate.includes(':') && !timeOrDate.includes('T')) {
    const parts = timeOrDate.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH}:${m} ${ampm}`;
    }
  }
  try {
    const d = new Date(timeOrDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch {}
  return String(timeOrDate);
};

/**
 * Escape HTML special chars
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Escape CSV field
 */
const escapeCsv = (val) => {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Prompt user to either save directly to device Downloads/documents or share via WhatsApp/other apps
 */
const promptDownloadOrShare = async ({ fileUri, filename, mimeType, dialogTitle, content }) => {
  const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);

  const doDownload = async () => {
    try {
      let LegacyFS = null;
      try {
        LegacyFS = require('expo-file-system/legacy');
      } catch {}

      if (!LegacyFS) {
        try {
          LegacyFS = require('expo-file-system');
        } catch {}
      }

      // Android: Save automatically to user's saved directory (e.g. Downloads) or request once initially
      if (Platform.OS === 'android' && LegacyFS && LegacyFS.StorageAccessFramework) {
        // Prepare base64 data first
        let base64Data = '';
        if (fileUri) {
          base64Data = await LegacyFS.readAsStringAsync(fileUri, {
            encoding: LegacyFS.EncodingType ? LegacyFS.EncodingType.Base64 : 'base64',
          });
        } else if (content) {
          try {
            const tempCachePath = `${LegacyFS.cacheDirectory || ''}temp_export_${Date.now()}`;
            await LegacyFS.writeAsStringAsync(tempCachePath, content, {
              encoding: LegacyFS.EncodingType ? LegacyFS.EncodingType.UTF8 : 'utf8',
            });
            base64Data = await LegacyFS.readAsStringAsync(tempCachePath, {
              encoding: LegacyFS.EncodingType ? LegacyFS.EncodingType.Base64 : 'base64',
            });
          } catch (convErr) {
            base64Data = '';
          }
        }

        // 1. Check if user previously granted & saved directory permission (Chrome-like automatic download)
        let savedDirectoryUri = null;
        try {
          savedDirectoryUri = await SecureStore.getItemAsync(SAVED_DOWNLOAD_DIR_KEY);
        } catch (e) {
          savedDirectoryUri = null;
        }

        if (savedDirectoryUri) {
          try {
            const createdFileUri = await LegacyFS.StorageAccessFramework.createFileAsync(
              savedDirectoryUri,
              filename,
              mimeType
            );

            await LegacyFS.writeAsStringAsync(createdFileUri, base64Data, {
              encoding: LegacyFS.EncodingType ? LegacyFS.EncodingType.Base64 : 'base64',
            });

            Alert.alert(
              'Download Complete',
              `File automatically downloaded to your device:\n\n${filename}`
            );
            return;
          } catch (autoSaveErr) {
            console.warn('Auto-save to saved directory failed, prompting directory permission:', autoSaveErr);
            // In case the directory permission was revoked or folder moved, clear saved key and prompt
            await SecureStore.deleteItemAsync(SAVED_DOWNLOAD_DIR_KEY).catch(() => {});
            savedDirectoryUri = null;
          }
        }

        // 2. Initial stage permission request if no saved directory or if auto-save failed
        let permissions = null;
        try {
          permissions = await LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync();
        } catch (permErr) {
          permissions = { granted: false };
        }

        if (permissions && permissions.granted && permissions.directoryUri) {
          // Persist the granted directory URI so future downloads are completely automatic!
          try {
            await SecureStore.setItemAsync(SAVED_DOWNLOAD_DIR_KEY, permissions.directoryUri);
          } catch (storeErr) {
            console.warn('Could not persist download directory URI:', storeErr);
          }

          const createdFileUri = await LegacyFS.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            mimeType
          );

          await LegacyFS.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: LegacyFS.EncodingType ? LegacyFS.EncodingType.Base64 : 'base64',
          });

          Alert.alert(
            'Download Complete',
            `File saved successfully:\n\n${filename}\n\nFuture downloads will save automatically without asking for a folder!`
          );
          return;
        } else {
          // User backed out of folder selection -> directly open share sheet so user can save or send
          if (isSharingAvailable && fileUri) {
            await doShare();
            return;
          }
        }
      }

      // iOS or fallback: save to documents directory
      if (LegacyFS && LegacyFS.documentDirectory && fileUri) {
        const dest = `${LegacyFS.documentDirectory}${filename}`;
        await LegacyFS.copyAsync({ from: fileUri, to: dest }).catch(() => {});
        Alert.alert('Download Complete', `File saved to device documents:\n\n${filename}`);
        return;
      }

      Alert.alert('Download Complete', `File is ready on your device:\n\n${filename}`);
    } catch (err) {
      console.warn('Download error:', err);
      if (isSharingAvailable && fileUri) {
        Alert.alert(
          'Download Notice',
          'Direct save encountered an issue. You can use the Share sheet to save to your files.',
          [
            { text: 'Open Share', onPress: () => doShare() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Download Error', err.message || 'Could not download file');
      }
    }
  };

  const doShare = async () => {
    if (!isSharingAvailable) {
      Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: dialogTitle || `Share ${filename}`,
      UTI: mimeType === 'application/pdf' ? '.pdf' : 'public.comma-separated-values-text',
    });
  };

  Alert.alert(
    'Export Ready',
    `Choose an action for "${filename}":`,
    [
      {
        text: 'Download to Phone',
        onPress: doDownload,
      },
      {
        text: 'Share (WhatsApp/Apps)',
        onPress: doShare,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
    { cancelable: true }
  );
};

/**
 * Universal file writer compatible with Expo SDK 52/54/57+ and legacy runtimes
 */
const writeCsvFileAndShare = async (cleanFilename, csvContent, dialogTitle) => {
  const filenameWithExt = `${cleanFilename}_${Date.now()}.csv`;
  let fileUri = null;

  // 1. Try legacy expo-file-system (preferred for writeAsStringAsync without deprecation warnings)
  try {
    const LegacyFS = require('expo-file-system/legacy');
    if (LegacyFS && LegacyFS.writeAsStringAsync && LegacyFS.cacheDirectory) {
      fileUri = `${LegacyFS.cacheDirectory}${filenameWithExt}`;
      await LegacyFS.writeAsStringAsync(fileUri, csvContent, {
        encoding: LegacyFS.EncodingType ? LegacyFS.EncodingType.UTF8 : 'utf8',
      });
    }
  } catch (legacyErr) {
    // Fall back to modern File class
  }

  // 2. Try modern File API from expo-file-system if legacy did not execute
  if (!fileUri) {
    try {
      const ModernFS = require('expo-file-system');
      if (ModernFS.File && ModernFS.Paths) {
        const file = new ModernFS.File(ModernFS.Paths.cache, filenameWithExt);
        if (file.create) file.create();
        if (file.write) await file.write(csvContent);
        fileUri = file.uri;
      } else if (ModernFS.writeAsStringAsync && ModernFS.cacheDirectory) {
        fileUri = `${ModernFS.cacheDirectory}${filenameWithExt}`;
        await ModernFS.writeAsStringAsync(fileUri, csvContent, {
          encoding: 'utf8',
        });
      }
    } catch (modernErr) {
      console.warn('Modern FS write attempt failed:', modernErr);
    }
  }

  if (!fileUri) {
    throw new Error('Unable to initialize local file system storage for export');
  }

  await promptDownloadOrShare({
    fileUri,
    filename: filenameWithExt,
    mimeType: 'text/csv',
    dialogTitle,
    content: csvContent,
  });
};

/**
 * Export work records to PDF
 */
export const exportDutiesToPDF = async ({
  title = 'Work Service Report',
  subtitle = 'Vairavan Automation Field Operations',
  duties = [],
  filterInfo = '',
}) => {
  if (!duties || duties.length === 0) {
    Alert.alert('No Records', 'There are no work records to export for the selected filter.');
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
    return;
  }

  try {
    const generatedDate = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Sort duties strictly in Ascending order by Work ID (e.g. WORK-1000, WORK-1001, ...)
    const sortedDuties = [...duties].sort((a, b) => {
      const idA = a.dutyId || ('WORK-' + String(a._id || '').slice(-6).toUpperCase());
      const idB = b.dutyId || ('WORK-' + String(b._id || '').slice(-6).toUpperCase());
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const rowsHtml = sortedDuties
      .map((d, index) => {
        const dutyId = escapeHtml(d.dutyId || ('WORK-' + (d._id || '').slice(-6).toUpperCase()));
        const empName = escapeHtml(d.employee?.employeeName || 'N/A');
        const empId = escapeHtml(d.employee?.employeeId || 'N/A');
        const compName = escapeHtml(d.company?.companyName || 'N/A');
        const compLoc = escapeHtml(d.company?.location || '');
        const dateStr = formatDate(d.dutyDate);
        const inTime = escapeHtml(d.inTime || 'N/A');
        const outTime = escapeHtml(d.outTime || 'N/A');
        const workType = escapeHtml(formatWorkType(d));
        const machine = escapeHtml(d.machineName || 'N/A');
        const customer = escapeHtml(d.customerName || 'N/A');
        const customerPhone = escapeHtml(d.customerPhoneNumber || 'N/A');
        const workDesc = escapeHtml(d.workDescription || 'N/A');

        // Check-In Location
        const checkInLat = d.checkInLocation?.latitude || d.location?.latitude;
        const checkInLng = d.checkInLocation?.longitude || d.location?.longitude;
        const checkInAddr = (d.checkInLocation?.address || d.location?.address)
          ? escapeHtml(d.checkInLocation?.address || d.location?.address)
          : '';
        const checkInCoords = checkInLat && checkInLng ? `${checkInLat.toFixed(5)}, ${checkInLng.toFixed(5)}` : '';
        let checkInLocText = 'Not Recorded';
        if (checkInAddr && checkInCoords) {
          checkInLocText = `${checkInAddr} (${checkInCoords})`;
        } else if (checkInAddr) {
          checkInLocText = checkInAddr;
        } else if (checkInCoords) {
          checkInLocText = checkInCoords;
        }
        const checkInMapsUrl = checkInLat && checkInLng ? `https://maps.google.com/?q=${checkInLat},${checkInLng}` : null;

        // Check-Out Location
        const checkOutLat = d.checkOutLocation?.latitude;
        const checkOutLng = d.checkOutLocation?.longitude;
        const checkOutAddr = d.checkOutLocation?.address ? escapeHtml(d.checkOutLocation.address) : '';
        const checkOutCoords = checkOutLat && checkOutLng ? `${checkOutLat.toFixed(5)}, ${checkOutLng.toFixed(5)}` : '';
        let checkOutLocText = 'Not Recorded';
        if (checkOutAddr && checkOutCoords) {
          checkOutLocText = `${checkOutAddr} (${checkOutCoords})`;
        } else if (checkOutAddr) {
          checkOutLocText = checkOutAddr;
        } else if (checkOutCoords) {
          checkOutLocText = checkOutCoords;
        }
        const checkOutMapsUrl = checkOutLat && checkOutLng ? `https://maps.google.com/?q=${checkOutLat},${checkOutLng}` : null;

        const signatureUrl =
          d.customerSignature?.url ||
          (typeof d.customerSignature === 'string' ? d.customerSignature : '') ||
          d.signature?.url ||
          '';
        const proofPhotos = Array.isArray(d.customerProofPhotos) ? d.customerProofPhotos : [];
        const photosToRender = proofPhotos.slice(0, 3);

        const photosHtml =
          photosToRender.length > 0
            ? photosToRender
                .map(
                  (p) =>
                    `<img src="${escapeHtml(p.url)}" style="width: 120px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; margin-right: 8px; margin-top: 6px;" loading="lazy" onerror="this.style.display='none'" />`
                )
                .join('')
            : '<span style="color: #64748b; font-size: 11px;">No site proof photos attached</span>';

        const sigTime = d.customerSignature?.signedAt
          ? formatDate(d.customerSignature.signedAt) + ' ' + (d.customerSignature.signedAt ? new Date(d.customerSignature.signedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '')
          : (dateStr && outTime ? `${dateStr} ${outTime}` : '');

        let signatureBodyHtml = '';
        if (signatureUrl) {
          if (signatureUrl.startsWith('data:image/svg+xml;utf8,') || signatureUrl.startsWith('data:image/svg+xml,')) {
            try {
              const prefixMatch = /^data:image\/svg\+xml(;utf8)?,/;
              const rawSvg = decodeURIComponent(signatureUrl.replace(prefixMatch, ''));
              signatureBodyHtml = `<div style="max-height: 60px; max-width: 180px; display: inline-block;">${rawSvg}</div>`;
            } catch {
              signatureBodyHtml = `<img src="${escapeHtml(signatureUrl)}" style="max-height: 60px; max-width: 180px; object-fit: contain; display: block; margin-bottom: 4px;" loading="lazy" onerror="this.style.display='none'" />`;
            }
          } else if (signatureUrl.trim().startsWith('<svg')) {
            signatureBodyHtml = `<div style="max-height: 60px; max-width: 180px; display: inline-block;">${signatureUrl}</div>`;
          } else {
            signatureBodyHtml = `<img src="${escapeHtml(signatureUrl)}" style="max-height: 60px; max-width: 180px; object-fit: contain; display: block; margin-bottom: 4px;" loading="lazy" onerror="this.style.display='none'" />`;
          }
        }

        const signatureHtml = signatureUrl
          ? `<div style="display: inline-block; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: right;">
               ${signatureBodyHtml}
               ${sigTime ? `<div style="font-size: 9px; color: #475569; font-weight: 700; border-top: 1px dashed #e2e8f0; padding-top: 2px;">🕒 ${escapeHtml(sigTime)}</div>` : ''}
             </div>`
          : '<span style="color: #64748b; font-size: 11px;">No signature recorded</span>';

        const isOffice =
          d.company?.companyType === 'office' ||
          (compName && compName.toLowerCase().includes('office'));

        const effectiveCustomer = isOffice ? 'Office' : (customer || d.client?.clientName || 'N/A');
        const effectiveCustomerPhone = isOffice
          ? (d.company?.companyPhoneNumber || customerPhone || 'N/A')
          : (customerPhone || d.client?.clientPhoneNumber || 'N/A');

        const checkInIST = d.checkInTime ? formatTimeIST(d.checkInTime) : inTime;
        const checkOutIST = d.checkOutTime ? formatTimeIST(d.checkOutTime) : outTime;
        const durationText = d.totalDurationMinutes
          ? `${Math.floor(d.totalDurationMinutes / 60)}h ${d.totalDurationMinutes % 60}m (${d.totalDurationMinutes} mins)`
          : 'N/A';

        const featuresList = Array.isArray(d.features) ? d.features.filter(Boolean) : [];
        const featuresHtml =
          featuresList.length > 0
            ? `<div style="margin-top: 8px; font-size: 11px;">
                 <strong style="color: #0f172a;">Features:</strong> ` +
              featuresList
                .map(
                  (f) =>
                    `<span style="display: inline-block; background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; margin-right: 4px; margin-bottom: 2px;">${escapeHtml(
                      f
                    )}</span>`
                )
                .join('') +
              `</div>`
            : '';

        const manpowerList = Array.isArray(d.manpowerMembers)
          ? d.manpowerMembers.filter((m) => m && m.name)
          : [];
        const manpowerHtml =
          manpowerList.length > 0
            ? `<div style="margin-top: 8px; padding: 8px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;">
                 <strong style="color: #0f172a; font-size: 11px;">Manpower Team (${manpowerList.length}):</strong><br/>` +
              manpowerList
                .map(
                  (m) =>
                    `<span style="font-size: 11px; color: #334155;">• <strong>${escapeHtml(
                      m.name
                    )}</strong>${
                      m.phoneNumber || m.phone
                        ? ` (Phone: ${escapeHtml(m.phoneNumber || m.phone)})`
                        : ''
                    }${m.description ? ` - <em>${escapeHtml(m.description)}</em>` : ''}</span>`
                )
                .join('<br/>') +
              `</div>`
            : '';

        return `
          <div class="duty-card">
            <div class="card-header">
              <span class="record-badge">${dutyId}</span>
              <span class="duty-date"><strong>Date:</strong> ${dateStr}</span>
              <span class="duty-time"><strong>Time (IST):</strong> ${checkInIST} - ${checkOutIST}</span>
              <span class="work-badge">${workType}</span>
            </div>

            <table class="card-table">
              <tr>
                <td style="width: 50%;">
                  <strong>Work ID:</strong> ${dutyId}<br/>
                  <strong>Employee:</strong> ${empName} (${empId})<br/>
                  <strong>Duty Type:</strong> ${isOffice ? 'Office Duty' : 'Client Company Duty'}<br/>
                  <strong>${isOffice ? 'Office:' : 'Client Company:'}</strong> ${compName || (isOffice ? 'Office' : 'Client Company')} ${compLoc ? `• ${compLoc}` : ''}<br/>
                  <strong>Customer / Client Name:</strong> ${effectiveCustomer}<br/>
                  <strong>Phone Number:</strong> ${effectiveCustomerPhone}<br/>
                  <strong>Machine / Asset:</strong> ${machine}
                </td>
                <td style="width: 50%;">
                  <strong>Check-In Time (IST):</strong> ${checkInIST}<br/>
                  <strong>Check-Out Time (IST):</strong> ${checkOutIST}<br/>
                  <strong>Total Working Duration:</strong> ${durationText}<br/>
                  <strong>Check-In Location:</strong> ${checkInLocText}
                  ${checkInMapsUrl ? `<a href="${checkInMapsUrl}" target="_blank" style="color: #059669; font-size: 10px; margin-left: 4px;">[Maps ↗]</a>` : ''}<br/>
                  <strong>Check-Out Location:</strong> ${checkOutLocText}
                  ${checkOutMapsUrl ? `<a href="${checkOutMapsUrl}" target="_blank" style="color: #1e40af; font-size: 10px; margin-left: 4px;">[Maps ↗]</a>` : ''}
                </td>
              </tr>
            </table>

            ${featuresHtml}
            ${manpowerHtml}

            <div class="description-box">
              <strong>Work Performed / Observations:</strong><br/>
              <span style="white-space: pre-wrap;">${workDesc}</span>
            </div>

            <div class="media-row">
              <div class="media-block" style="flex: 2;">
                <div class="media-title">Proof Photos (${proofPhotos.length})</div>
                <div class="photos-container">${photosHtml}</div>
              </div>
              <div class="media-block" style="flex: 1;">
                <div class="media-title">Customer Digital Signature</div>
                <div>${signatureHtml}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 24px;
            margin: 0;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .brand-logo {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 12px;
          }
          .title-block {
            text-align: right;
          }
          .title-block h1 {
            margin: 0;
            font-size: 20px;
            color: #1e40af;
            font-weight: 800;
          }
          .title-block p {
            margin: 2px 0 0 0;
            color: #475569;
            font-size: 11px;
          }
          .filter-bar {
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #334155;
            display: flex;
            justify-content: space-between;
          }
          .duty-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            page-break-inside: avoid;
            background: #fafafa;
          }
          .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .record-badge {
            background: #1e40af;
            color: #ffffff;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
          }
          .work-badge {
            margin-left: auto;
            background: #e0e7ff;
            color: #3730a3;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
          }
          .card-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 8px;
          }
          .card-table td {
            vertical-align: top;
            padding: 2px 0;
          }
          .description-box {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 8px;
            font-size: 11px;
          }
          .media-row {
            display: flex;
            gap: 16px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px;
          }
          .media-block {
            display: flex;
            flex-direction: column;
          }
          .media-title {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .photos-container {
            display: flex;
            flex-wrap: wrap;
          }
          .footer-note {
            margin-top: 24px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img class="brand-logo" src="${LOGO_URL}" alt="Logo" onerror="this.style.display='none'" />
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VAIRAVAN AUTOMATION</div>
              <div style="font-size: 11px; color: #64748b;">Industrial Field Service & Work Management</div>
            </div>
          </div>
          <div class="title-block">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>

        <div class="filter-bar">
          <div><strong>Filter:</strong> ${escapeHtml(filterInfo || 'All Records')}</div>
          <div><strong>Total Works:</strong> ${duties.length} | <strong>Generated:</strong> ${generatedDate}</div>
        </div>

        ${rowsHtml}

        <div class="footer-note">
          Official Work Report Record • Vairavan Automation Client System
          ${BRANDING_PDF_FOOTER_HTML}
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filenameWithExt = `${cleanTitle}_${Date.now()}.pdf`;

    await promptDownloadOrShare({
      fileUri: uri,
      filename: filenameWithExt,
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title} (PDF)`,
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate PDF export');
  }
};

/**
 * Export work records to Excel / CSV
 */
export const exportDutiesToExcel = async ({
  filename = 'Work_Records',
  duties = [],
}) => {
  if (!duties || duties.length === 0) {
    Alert.alert('No Records', 'There are no work records to export for the selected filter.');
    return;
  }

  try {
    const headers = [
      'Sl No',
      'Work ID',
      'Work Date',
      'Duty Type',
      'Employee ID',
      'Employee Name',
      'Employee Designation',
      'Company / Office Name',
      'Company Location',
      'Client / Customer Name',
      'Client Phone Number',
      'Check-In Time (IST)',
      'Check-Out Time (IST)',
      'Working Duration (Minutes)',
      'Working Duration (Hours)',
      'Machine / Asset Name',
      'Work Type',
      'Features',
      'Manpower Team',
      'Work Description',
      'Check-In Location Address',
      'Check-In GPS Coordinates',
      'Check-Out Location Address',
      'Check-Out GPS Coordinates',
      'Signature Timestamp',
      'Customer Signature URL',
      'Proof Photos URLs',
      'Record Created At (IST)',
    ];

    // Sort duties strictly in Ascending order by Work ID (e.g. WORK-1000, WORK-1001, ...)
    const sortedDuties = [...duties].sort((a, b) => {
      const idA = a.dutyId || ('WORK-' + String(a._id || '').slice(-6).toUpperCase());
      const idB = b.dutyId || ('WORK-' + String(b._id || '').slice(-6).toUpperCase());
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const rows = sortedDuties.map((d, index) => {
      const dutyId = d.dutyId || ('WORK-' + (d._id || '').slice(-6).toUpperCase());
      const empId = d.employee?.employeeId || '';
      const empName = d.employee?.employeeName || '';
      const empDesig = d.employee?.designation || '';
      const compName = d.company?.companyName || '';
      const compLoc = d.company?.location || '';
      const customer = d.customerName || '';
      const customerPhone = d.customerPhoneNumber || '';
      const machine = d.machineName || '';
      const workType = formatWorkType(d);
      const inTime = d.inTime || '';
      const outTime = d.outTime || '';
      const workDesc = d.workDescription || '';

      const checkInLat = d.checkInLocation?.latitude || d.location?.latitude;
      const checkInLng = d.checkInLocation?.longitude || d.location?.longitude;
      const checkInCoords = checkInLat && checkInLng ? `${checkInLat}, ${checkInLng}` : '';
      const checkInAddress = d.checkInLocation?.address || d.location?.address || '';

      const checkOutLat = d.checkOutLocation?.latitude;
      const checkOutLng = d.checkOutLocation?.longitude;
      const checkOutCoords = checkOutLat && checkOutLng ? `${checkOutLat}, ${checkOutLng}` : '';
      const checkOutAddress = d.checkOutLocation?.address || '';

      const signatureUrl = d.customerSignature?.url || '';
      const sigTime = d.customerSignature?.signedAt
        ? new Date(d.customerSignature.signedAt).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) +
          ', ' +
          new Date(d.customerSignature.signedAt).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : d.dutyDate && d.outTime
        ? `${formatDate(d.dutyDate)} ${d.outTime}`
        : '';
      const photos = Array.isArray(d.customerProofPhotos)
        ? d.customerProofPhotos.map((p) => p.url).join(' | ')
        : '';

      const isOffice =
        d.company?.companyType === 'office' ||
        (compName && compName.toLowerCase().includes('office'));

      const dutyTypeLabel = isOffice ? 'Office Duty' : 'Client Company Duty';
      const effectiveCustomer = isOffice ? 'Office' : (customer || d.client?.clientName || 'N/A');
      const effectiveCustomerPhone = isOffice
        ? (d.company?.companyPhoneNumber || customerPhone || '')
        : (customerPhone || d.client?.clientPhoneNumber || '');

      const checkInTimeIST = d.checkInTime ? formatTimeIST(d.checkInTime) : inTime;
      const checkOutTimeIST = d.checkOutTime ? formatTimeIST(d.checkOutTime) : outTime;
      const durationMins =
        d.totalDurationMinutes !== undefined && d.totalDurationMinutes !== null
          ? String(d.totalDurationMinutes)
          : '';
      const durationHours = d.totalDurationMinutes
        ? (d.totalDurationMinutes / 60).toFixed(2)
        : '';

      const featuresStr = Array.isArray(d.features)
        ? d.features.filter(Boolean).join('; ')
        : '';

      const manpowerStr = Array.isArray(d.manpowerMembers)
        ? d.manpowerMembers
            .filter((m) => m && m.name)
            .map((m) => {
              const parts = [m.name];
              if (m.phoneNumber || m.phone) parts.push(m.phoneNumber || m.phone);
              if (m.description) parts.push(m.description);
              return parts.join(', ');
            })
            .join(' | ')
        : '';

      const createdAtIST = d.createdAt
        ? new Date(d.createdAt).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) +
          ' ' +
          new Date(d.createdAt).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : '';

      return [
        index + 1,
        escapeCsv(dutyId),
        formatDate(d.dutyDate),
        escapeCsv(dutyTypeLabel),
        escapeCsv(empId),
        escapeCsv(empName),
        escapeCsv(empDesig),
        escapeCsv(compName || (isOffice ? 'Office' : 'Client Company')),
        escapeCsv(compLoc),
        escapeCsv(effectiveCustomer),
        escapeCsv(effectiveCustomerPhone),
        escapeCsv(checkInTimeIST),
        escapeCsv(checkOutTimeIST),
        escapeCsv(durationMins),
        escapeCsv(durationHours),
        escapeCsv(machine),
        escapeCsv(workType),
        escapeCsv(featuresStr),
        escapeCsv(manpowerStr),
        escapeCsv(workDesc),
        escapeCsv(checkInAddress),
        escapeCsv(checkInCoords),
        escapeCsv(checkOutAddress),
        escapeCsv(checkOutCoords),
        escapeCsv(sigTime),
        escapeCsv(signatureUrl),
        escapeCsv(photos),
        escapeCsv(createdAtIST),
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeCsvFileAndShare(cleanFilename, csvContent, `Export ${filename} (Excel/CSV)`);
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate Excel export');
  }
};

/**
 * Export leave records to PDF
 */
export const exportLeavesToPDF = async ({
  title = 'Employee Leave Records',
  subtitle = 'Vairavan Automation Leave Management',
  leaves = [],
  filterInfo = '',
}) => {
  if (!leaves || leaves.length === 0) {
    Alert.alert('No Records', 'There are no leave records to export for the selected filter.');
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
    return;
  }

  try {
    const generatedDate = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const rowsHtml = leaves
      .map((l, index) => {
        const empName = escapeHtml(l.employee?.employeeName || 'Employee');
        const empId = escapeHtml(l.employee?.employeeId || 'N/A');
        const empDesig = escapeHtml(l.employee?.designation || 'Employee');
        const startDate = formatDate(l.startDate);
        const endDate = formatDate(l.endDate);
        const reason = escapeHtml(l.reason || 'N/A');
        const status = (l.status || 'pending').toUpperCase();
        const remarks = escapeHtml(l.adminRemarks || 'None');
        const reviewer = escapeHtml(l.adminReviewer?.employeeName || 'Admin');

        const statusColor =
          status === 'APPROVED' ? '#059669' : status === 'REJECTED' ? '#DC2626' : '#D97706';

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 8px 6px; text-align: center;">${index + 1}</td>
            <td style="padding: 8px 6px;">
              <strong>${empName}</strong><br/>
              <span style="color: #64748b; font-size: 10px;">ID: ${empId} • ${empDesig}</span>
            </td>
            <td style="padding: 8px 6px; white-space: nowrap;">
              <strong>${startDate}</strong> to <strong>${endDate}</strong>
            </td>
            <td style="padding: 8px 6px;">${reason}</td>
            <td style="padding: 8px 6px; text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 10px; color: #ffffff; background: ${statusColor};">
                ${status}
              </span>
            </td>
            <td style="padding: 8px 6px;">
              ${remarks}
              ${l.reviewedAt ? `<br/><span style="color: #64748b; font-size: 9px;">By ${reviewer} on ${formatDate(l.reviewedAt)}</span>` : ''}
            </td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 24px;
            margin: 0;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .brand-logo {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 12px;
          }
          .title-block {
            text-align: right;
          }
          .title-block h1 {
            margin: 0;
            font-size: 20px;
            color: #1e40af;
            font-weight: 800;
          }
          .title-block p {
            margin: 2px 0 0 0;
            color: #475569;
            font-size: 11px;
          }
          .filter-bar {
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #334155;
            display: flex;
            justify-content: space-between;
          }
          .records-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          .records-table th {
            background: #1e40af;
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            padding: 8px 6px;
            text-align: left;
          }
          .footer-note {
            margin-top: 24px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img class="brand-logo" src="${LOGO_URL}" alt="Logo" />
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VAIRAVAN AUTOMATION</div>
              <div style="font-size: 11px; color: #64748b;">Employee Operations & Leave Management</div>
            </div>
          </div>
          <div class="title-block">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>

        <div class="filter-bar">
          <div><strong>Filter:</strong> ${escapeHtml(filterInfo || 'All Leave Records')}</div>
          <div><strong>Total Requests:</strong> ${leaves.length} | <strong>Generated:</strong> ${generatedDate}</div>
        </div>

        <table class="records-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 25%;">Employee</th>
              <th style="width: 20%;">Leave Duration</th>
              <th style="width: 22%;">Reason</th>
              <th style="width: 13%; text-align: center;">Status</th>
              <th style="width: 15%;">Admin Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-note">
          Official Employee Leave Documentation • Vairavan Automation System
          ${BRANDING_PDF_FOOTER_HTML}
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filenameWithExt = `${cleanTitle}_${Date.now()}.pdf`;

    await promptDownloadOrShare({
      fileUri: uri,
      filename: filenameWithExt,
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title} (PDF)`,
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate PDF export');
  }
};

/**
 * Export leave records to Excel / CSV
 */
export const exportLeavesToExcel = async ({
  filename = 'Leave_Records',
  leaves = [],
}) => {
  if (!leaves || leaves.length === 0) {
    Alert.alert('No Records', 'There are no leave records to export for the selected filter.');
    return;
  }

  try {
    const headers = [
      'Sl No',
      'Employee ID',
      'Employee Name',
      'Employee Designation',
      'Employee Email',
      'Start Date',
      'End Date',
      'Reason',
      'Status',
      'Admin Remarks',
      'Reviewed By',
      'Reviewed At',
      'Applied Date',
    ];

    const rows = leaves.map((l, index) => {
      const empId = l.employee?.employeeId || '';
      const empName = l.employee?.employeeName || '';
      const empDesig = l.employee?.designation || '';
      const empEmail = l.employee?.email || '';
      const startDate = formatDate(l.startDate);
      const endDate = formatDate(l.endDate);
      const reason = l.reason || '';
      const status = l.status || 'pending';
      const remarks = l.adminRemarks || '';
      const reviewer = l.adminReviewer?.employeeName || '';
      const reviewedAt = l.reviewedAt ? new Date(l.reviewedAt).toISOString() : '';
      const createdAt = l.createdAt ? new Date(l.createdAt).toISOString() : '';

      return [
        index + 1,
        escapeCsv(empId),
        escapeCsv(empName),
        escapeCsv(empDesig),
        escapeCsv(empEmail),
        escapeCsv(startDate),
        escapeCsv(endDate),
        escapeCsv(reason),
        escapeCsv(status),
        escapeCsv(remarks),
        escapeCsv(reviewer),
        escapeCsv(reviewedAt),
        escapeCsv(createdAt),
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeCsvFileAndShare(cleanFilename, csvContent, `Export ${filename} (Excel/CSV)`);
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate Excel export');
  }
};

/**
 * Export employees to PDF
 */
export const exportEmployeesToPDF = async ({
  title = 'Employee Directory',
  subtitle = 'Vairavan Automation Employee Records',
  employees = [],
  filterInfo = '',
}) => {
  if (!employees || employees.length === 0) {
    Alert.alert('No Records', 'There are no employee records to export.');
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
    return;
  }

  try {
    const generatedDate = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const rowsHtml = employees
      .map((emp, index) => {
        const empName = escapeHtml(emp.employeeName || 'N/A');
        const empId = escapeHtml(emp.employeeId || 'N/A');
        const designation = escapeHtml(emp.designation || 'Employee');
        const phone = escapeHtml(emp.phoneNumber || 'N/A');
        const email = escapeHtml(emp.email || 'N/A');
        const role = escapeHtml(emp.role || 'employee');
        const status = (emp.accountStatus || 'active').toUpperCase();
        const statusColor = status === 'ACTIVE' ? '#059669' : '#DC2626';

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 8px 6px; text-align: center;">${index + 1}</td>
            <td style="padding: 8px 6px;">
              <strong>${empName}</strong><br/>
              <span style="color: #64748b; font-size: 10px;">ID: ${empId}</span>
            </td>
            <td style="padding: 8px 6px;">${designation}</td>
            <td style="padding: 8px 6px;">${phone}</td>
            <td style="padding: 8px 6px;">${email}</td>
            <td style="padding: 8px 6px; text-transform: uppercase;">${role}</td>
            <td style="padding: 8px 6px; text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 10px; color: #ffffff; background: ${statusColor};">
                ${status}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 24px;
            margin: 0;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .brand-logo {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 12px;
          }
          .title-block {
            text-align: right;
          }
          .title-block h1 {
            margin: 0;
            font-size: 20px;
            color: #1e40af;
            font-weight: 800;
          }
          .title-block p {
            margin: 2px 0 0 0;
            color: #475569;
            font-size: 11px;
          }
          .filter-bar {
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #334155;
            display: flex;
            justify-content: space-between;
          }
          .records-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          .records-table th {
            background: #1e40af;
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            padding: 8px 6px;
            text-align: left;
          }
          .footer-note {
            margin-top: 24px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img class="brand-logo" src="${LOGO_URL}" alt="Logo" />
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VAIRAVAN AUTOMATION</div>
              <div style="font-size: 11px; color: #64748b;">Human Resources & Employee Directory</div>
            </div>
          </div>
          <div class="title-block">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>

        <div class="filter-bar">
          <div><strong>Filter:</strong> ${escapeHtml(filterInfo || 'Active Roster')}</div>
          <div><strong>Total Employees:</strong> ${employees.length} | <strong>Generated:</strong> ${generatedDate}</div>
        </div>

        <table class="records-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 25%;">Employee</th>
              <th style="width: 18%;">Designation</th>
              <th style="width: 17%;">Phone</th>
              <th style="width: 20%;">Email</th>
              <th style="width: 8%;">Role</th>
              <th style="width: 7%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-note">
          Official Employee Directory • Vairavan Automation System
          ${BRANDING_PDF_FOOTER_HTML}
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filenameWithExt = `${cleanTitle}_${Date.now()}.pdf`;

    await promptDownloadOrShare({
      fileUri: uri,
      filename: filenameWithExt,
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title} (PDF)`,
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate PDF export');
  }
};

/**
 * Export employees to Excel / CSV
 */
export const exportEmployeesToExcel = async ({
  filename = 'Employee_Directory',
  employees = [],
}) => {
  if (!employees || employees.length === 0) {
    Alert.alert('No Records', 'There are no employee records to export.');
    return;
  }

  try {
    const headers = [
      'Sl No',
      'Employee ID',
      'Employee Name',
      'Designation',
      'Phone Number',
      'Email',
      'Role',
      'Status',
      'Joined Date',
    ];

    const rows = employees.map((emp, index) => {
      return [
        index + 1,
        escapeCsv(emp.employeeId || ''),
        escapeCsv(emp.employeeName || ''),
        escapeCsv(emp.designation || ''),
        escapeCsv(emp.phoneNumber || ''),
        escapeCsv(emp.email || ''),
        escapeCsv(emp.role || 'employee'),
        escapeCsv(emp.accountStatus || 'active'),
        escapeCsv(formatDate(emp.createdAt)),
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeCsvFileAndShare(cleanFilename, csvContent, `Export ${filename} (Excel/CSV)`);
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate Excel export');
  }
};

/**
 * Export companies to PDF
 */
export const exportCompaniesToPDF = async ({
  title = 'Client Companies Directory',
  subtitle = 'Vairavan Automation Client Accounts',
  companies = [],
  filterInfo = '',
}) => {
  if (!companies || companies.length === 0) {
    Alert.alert('No Records', 'There are no company records to export.');
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
    return;
  }

  try {
    const generatedDate = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const rowsHtml = companies
      .map((c, index) => {
        const name = escapeHtml(c.companyName || 'N/A');
        const isOffice = c.companyType === 'office';
        const typeLabel = isOffice ? 'OFFICE' : 'CLIENT';
        const typeBg = isOffice ? '#dbeafe' : '#d1fae5';
        const typeColor = isOffice ? '#1e40af' : '#047857';
        const loc = escapeHtml(c.location || 'N/A');
        const phone = escapeHtml(c.companyPhoneNumber || 'N/A');
        const status = (c.status || 'active').toUpperCase();
        const statusColor = status === 'ACTIVE' ? '#059669' : '#DC2626';

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 8px 6px; text-align: center;">${index + 1}</td>
            <td style="padding: 8px 6px;"><strong>${name}</strong></td>
            <td style="padding: 8px 6px; text-align: center;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 6px; font-weight: 700; font-size: 9.5px; color: ${typeColor}; background: ${typeBg};">
                ${typeLabel}
              </span>
            </td>
            <td style="padding: 8px 6px;">${loc}</td>
            <td style="padding: 8px 6px;">${phone}</td>
            <td style="padding: 8px 6px; text-align: center;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 10px; color: #ffffff; background: ${statusColor};">
                ${status}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 24px;
            margin: 0;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .brand-logo {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 12px;
          }
          .title-block {
            text-align: right;
          }
          .title-block h1 {
            margin: 0;
            font-size: 20px;
            color: #1e40af;
            font-weight: 800;
          }
          .title-block p {
            margin: 2px 0 0 0;
            color: #475569;
            font-size: 11px;
          }
          .filter-bar {
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #334155;
            display: flex;
            justify-content: space-between;
          }
          .records-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          .records-table th {
            background: #1e40af;
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            padding: 8px 6px;
            text-align: left;
          }
          .footer-note {
            margin-top: 24px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img class="brand-logo" src="${LOGO_URL}" alt="Logo" />
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VAIRAVAN AUTOMATION</div>
              <div style="font-size: 11px; color: #64748b;">Client Accounts & Corporate Relations</div>
            </div>
          </div>
          <div class="title-block">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>

        <div class="filter-bar">
          <div><strong>Filter:</strong> ${escapeHtml(filterInfo || 'Active Client Accounts')}</div>
          <div><strong>Total Companies:</strong> ${companies.length} | <strong>Generated:</strong> ${generatedDate}</div>
        </div>

        <table class="records-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 33%;">Company Name</th>
              <th style="width: 12%; text-align: center;">Type</th>
              <th style="width: 26%;">Location / Site</th>
              <th style="width: 14%;">Contact Phone</th>
              <th style="width: 10%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-note">
          Official Client Directory • Vairavan Automation System
          ${BRANDING_PDF_FOOTER_HTML}
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filenameWithExt = `${cleanTitle}_${Date.now()}.pdf`;

    await promptDownloadOrShare({
      fileUri: uri,
      filename: filenameWithExt,
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title} (PDF)`,
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate PDF export');
  }
};

/**
 * Export companies to Excel / CSV
 */
export const exportCompaniesToExcel = async ({
  filename = 'Company_Directory',
  companies = [],
}) => {
  if (!companies || companies.length === 0) {
    Alert.alert('No Records', 'There are no company records to export.');
    return;
  }

  try {
    const headers = [
      'Sl No',
      'Company Name',
      'Type',
      'Location',
      'Phone Number',
      'Status',
      'Created At',
    ];

    const rows = companies.map((c, index) => {
      return [
        index + 1,
        escapeCsv(c.companyName || ''),
        escapeCsv(c.companyType === 'office' ? 'Office' : 'Client Company'),
        escapeCsv(c.location || ''),
        escapeCsv(c.companyPhoneNumber || ''),
        escapeCsv(c.status || 'active'),
        escapeCsv(formatDate(c.createdAt)),
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeCsvFileAndShare(cleanFilename, csvContent, `Export ${filename} (Excel/CSV)`);
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate Excel export');
  }
};

/**
 * Export Expenses to PDF
 */
export const exportExpensesToPDF = async ({
  title = 'Expense Claims Report',
  subtitle = 'VairaWorks Employee Expense Submissions',
  expenses = [],
  filterInfo = '',
}) => {
  if (!expenses || expenses.length === 0) {
    Alert.alert('No Records', 'There are no expense records to export.');
    return;
  }

  try {
    const totalAmount = expenses.reduce((sum, e) => sum + (e.grandTotal || 0), 0);

    const rowsHtml = expenses
      .map((e, index) => {
        const empName = escapeHtml(e.employee?.employeeName || 'Employee');
        const empId = escapeHtml(e.employee?.employeeId || '');
        const comp = escapeHtml(e.company?.companyName || '—');
        const client = escapeHtml(e.client?.name || '');
        const dateStr = escapeHtml(formatDate(e.expenseDate));
        const expId = escapeHtml(e.expenseId || `EXP-${index + 1}`);
        const total = (e.grandTotal || 0).toLocaleString('en-IN');

        const itemsSummary = (e.items || [])
          .map((it) => {
            const name = it.categoryName === 'Others' && it.customCategoryName ? it.customCategoryName : it.categoryName;
            const amt = (it.amount || 0).toLocaleString('en-IN');
            return `${escapeHtml(name)}: ₹${amt}`;
          })
          .join('<br/>');

        return `
          <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td><strong>${expId}</strong></td>
            <td>${empName} <br/><span style="font-size: 9px; color: #64748b;">${empId}</span></td>
            <td>${dateStr}</td>
            <td>${comp}${client ? `<br/><span style="font-size: 9px; color: #64748b;">Contact: ${client}</span>` : ''}</td>
            <td style="font-size: 10px;">${itemsSummary}</td>
            <td style="text-align: right; font-weight: bold; color: #1e40af;">₹${total}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 12px; }
          .logo { height: 40px; }
          .title { font-size: 18px; font-weight: 800; color: #1e3a8a; margin: 0; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
          .filter-bar { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 10px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 700; font-size: 10px; text-transform: uppercase; border: 1px solid #cbd5e1; padding: 7px 6px; text-align: left; }
          td { border: 1px solid #e2e8f0; padding: 7px 6px; vertical-align: top; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary-card { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
          .summary-label { font-size: 12px; font-weight: 700; color: #1e40af; }
          .summary-value { font-size: 18px; font-weight: 900; color: #1e40af; }
          .footer-note { margin-top: 16px; font-size: 9px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${escapeHtml(title)}</h1>
            <div class="subtitle">${escapeHtml(subtitle)}</div>
          </div>
          <img src="${LOGO_URL}" class="logo" alt="Logo" />
        </div>

        ${filterInfo ? `<div class="filter-bar"><strong>Filters:</strong> ${escapeHtml(filterInfo)}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th style="width: 75px;">ID</th>
              <th>Employee</th>
              <th style="width: 75px;">Date</th>
              <th>Company / Client</th>
              <th>Items & Details</th>
              <th style="width: 80px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary-card">
          <div class="summary-label">Total Expenses (${expenses.length} Records)</div>
          <div class="summary-value">₹${totalAmount.toLocaleString('en-IN')}</div>
        </div>

        <div class="footer-note">
          Official Expense Report • Vairavan Automation System
          ${BRANDING_PDF_FOOTER_HTML}
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filenameWithExt = `${cleanTitle}_${Date.now()}.pdf`;

    await promptDownloadOrShare({
      fileUri: uri,
      filename: filenameWithExt,
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title} (PDF)`,
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate PDF export');
  }
};

/**
 * Export Expenses to Excel / CSV
 */
export const exportExpensesToExcel = async ({
  filename = 'Expense_Claims_Report',
  expenses = [],
}) => {
  if (!expenses || expenses.length === 0) {
    Alert.alert('No Records', 'There are no expense records to export.');
    return;
  }

  try {
    const headers = [
      'Sl No',
      'Expense ID',
      'Employee Name',
      'Employee ID',
      'Expense Date',
      'Company Name',
      'Client Name',
      'Client Phone',
      'Related Duty',
      'Items Breakdown',
      'Total Items Count',
      'Grand Total Amount (INR)',
      'General Description',
      'Submitted At',
    ];

    const rows = expenses.map((e, index) => {
      const itemsStr = (e.items || [])
        .map((it) => {
          const name = it.categoryName === 'Others' && it.customCategoryName ? it.customCategoryName : it.categoryName;
          const calc = it.calculationMode === 'automatic' ? ` (${it.quantity || 0}km @ Rs.${it.appliedRate})` : '';
          return `${name}${calc}: Rs.${it.amount || 0}`;
        })
        .join('; ');

      return [
        index + 1,
        escapeCsv(e.expenseId || `EXP-${index + 1}`),
        escapeCsv(e.employee?.employeeName || ''),
        escapeCsv(e.employee?.employeeId || ''),
        escapeCsv(formatDate(e.expenseDate)),
        escapeCsv(e.company?.companyName || ''),
        escapeCsv(e.client?.name || ''),
        escapeCsv(e.client?.phoneNumber || ''),
        escapeCsv(e.relatedDuty || ''),
        escapeCsv(itemsStr),
        e.items?.length || 0,
        e.grandTotal || 0,
        escapeCsv(e.generalDescription || ''),
        escapeCsv(formatDate(e.createdAt)),
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeCsvFileAndShare(cleanFilename, csvContent, `Export ${filename} (Excel/CSV)`);
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate Excel export');
  }
};

export default {
  exportDutiesToPDF,
  exportDutiesToExcel,
  exportLeavesToPDF,
  exportLeavesToExcel,
  exportEmployeesToPDF,
  exportEmployeesToExcel,
  exportCompaniesToPDF,
  exportCompaniesToExcel,
  exportExpensesToPDF,
  exportExpensesToExcel,
};
