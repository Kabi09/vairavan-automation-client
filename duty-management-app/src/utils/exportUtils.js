import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import { formatWorkType } from './dutyUtils';

const LOGO_URL =
  'https://res.cloudinary.com/etdurbgp/image/upload/v1791802852/vairavan_app/app_logo.png';

const SAVED_DOWNLOAD_DIR_KEY = 'saved_download_directory_uri';

/**
 * Format date nicely for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toISOString().split('T')[0];
  } catch {
    return String(dateStr);
  }
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

    const rowsHtml = duties
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

        const lat = d.location?.latitude;
        const lng = d.location?.longitude;
        const locAddress = d.location?.address ? escapeHtml(d.location.address) : '';
        const coordsText = lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '';
        let locationText = 'Not Recorded';
        if (locAddress && coordsText) {
          locationText = `${locAddress}<br/><span style="color: #64748b; font-size: 10px;">Coordinates: ${coordsText}</span>`;
        } else if (locAddress) {
          locationText = locAddress;
        } else if (coordsText) {
          locationText = coordsText;
        }
        const mapsUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;

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

        const effectiveCustomer = isOffice ? 'Office' : (customer || 'N/A');
        const effectiveCustomerPhone = isOffice
          ? (d.company?.companyPhoneNumber || customerPhone || 'N/A')
          : (customerPhone || 'N/A');

        return `
          <div class="duty-card">
            <div class="card-header">
              <span class="record-badge">${dutyId}</span>
              <span class="duty-date"><strong>Date:</strong> ${dateStr}</span>
              <span class="duty-time"><strong>Time:</strong> ${inTime} - ${outTime}</span>
              <span class="work-badge">${workType}</span>
            </div>

            <table class="card-table">
              <tr>
                <td style="width: 50%;">
                  <strong>Work ID:</strong> ${dutyId}<br/>
                  <strong>Employee:</strong> ${empName} (${empId})<br/>
                  <strong>${isOffice ? 'Office:' : 'Client Company:'}</strong> ${compName || (isOffice ? 'Office' : 'Client Company')} ${compLoc ? `• ${compLoc}` : ''}<br/>
                  <strong>Customer Name:</strong> ${effectiveCustomer}<br/>
                  <strong>Phone Number:</strong> ${effectiveCustomerPhone}<br/>
                  <strong>Machine / Asset:</strong> ${machine}
                </td>
                <td style="width: 50%;">
                  <strong>GPS Location:</strong> ${locationText}
                  ${mapsUrl ? `<br/><a href="${mapsUrl}" target="_blank" style="color: #1e40af; font-size: 11px;">[View on Google Maps]</a>` : ''}
                </td>
              </tr>
            </table>

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
      'Employee ID',
      'Employee Name',
      'Employee Designation',
      'Location / Entity Type',
      'Company / Office Name',
      'Company Location',
      'Customer Name',
      'Phone Number',
      'Machine Name',
      'Work Type',
      'In Time',
      'Out Time',
      'Work Description',
      'Location Address',
      'GPS Coordinates',
      'Signature Timestamp',
      'Customer Signature URL',
      'Proof Photos URLs',
      'Created At',
    ];

    const rows = duties.map((d, index) => {
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

      const lat = d.location?.latitude;
      const lng = d.location?.longitude;
      const coords = lat && lng ? `${lat}, ${lng}` : '';
      const address = d.location?.address || '';

      const signatureUrl = d.customerSignature?.url || '';
      const sigTime = d.customerSignature?.signedAt
        ? new Date(d.customerSignature.signedAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) +
          ', ' +
          new Date(d.customerSignature.signedAt).toLocaleTimeString('en-IN', {
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
      const createdAt = d.createdAt ? new Date(d.createdAt).toISOString() : '';

      const isOffice =
        d.company?.companyType === 'office' ||
        (compName && compName.toLowerCase().includes('office'));

      const effectiveCustomer = isOffice ? 'Office' : customer;
      const effectiveCustomerPhone = isOffice
        ? (d.company?.companyPhoneNumber || customerPhone || '')
        : customerPhone;

      return [
        index + 1,
        escapeCsv(dutyId),
        formatDate(d.dutyDate),
        escapeCsv(empId),
        escapeCsv(empName),
        escapeCsv(empDesig),
        escapeCsv(isOffice ? 'Office' : 'Client Company'),
        escapeCsv(compName || (isOffice ? 'Office' : 'Client Company')),
        escapeCsv(compLoc),
        escapeCsv(effectiveCustomer),
        escapeCsv(effectiveCustomerPhone),
        escapeCsv(machine),
        escapeCsv(workType),
        escapeCsv(inTime),
        escapeCsv(outTime),
        escapeCsv(workDesc),
        escapeCsv(address),
        escapeCsv(coords),
        escapeCsv(sigTime),
        escapeCsv(signatureUrl),
        escapeCsv(photos),
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

export default {
  exportDutiesToPDF,
  exportDutiesToExcel,
  exportLeavesToPDF,
  exportLeavesToExcel,
  exportEmployeesToPDF,
  exportEmployeesToExcel,
  exportCompaniesToPDF,
  exportCompaniesToExcel,
};
