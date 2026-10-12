import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

const LOGO_URL =
  'https://res.cloudinary.com/etdurbgp/image/upload/v1791802852/vairavan_app/app_logo.png';

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
 * Export duty records to a beautifully styled, print-ready PDF with complete fields
 */
export const exportDutiesToPDF = async ({
  title = 'Duty Service Report',
  subtitle = 'Vairavan Automation Field Operations',
  duties = [],
  filterInfo = '',
}) => {
  if (!duties || duties.length === 0) {
    Alert.alert('No Records', 'There are no duty records to export for the selected filter.');
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
        const empName = escapeHtml(d.employee?.employeeName || 'N/A');
        const empId = escapeHtml(d.employee?.employeeId || 'N/A');
        const compName = escapeHtml(d.company?.companyName || 'N/A');
        const compLoc = escapeHtml(d.company?.location || '');
        const dateStr = formatDate(d.dutyDate);
        const inTime = escapeHtml(d.inTime || 'N/A');
        const outTime = escapeHtml(d.outTime || 'N/A');
        const workType = escapeHtml(d.workType || 'N/A');
        const machine = escapeHtml(d.machineName || 'N/A');
        const customer = escapeHtml(d.customerName || 'N/A');
        const customerPhone = escapeHtml(d.customerPhoneNumber || 'N/A');
        const workDesc = escapeHtml(d.workDescription || 'N/A');

        const lat = d.location?.latitude;
        const lng = d.location?.longitude;
        const locationText =
          lat && lng
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : 'Not Recorded';
        const mapsUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;

        const signatureUrl = d.customerSignature?.url || '';
        const proofPhotos = Array.isArray(d.customerProofPhotos) ? d.customerProofPhotos : [];

        const photosHtml =
          proofPhotos.length > 0
            ? proofPhotos
                .map(
                  (p) =>
                    `<img src="${escapeHtml(p.url)}" style="width: 120px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; margin-right: 8px; margin-top: 6px;" />`
                )
                .join('')
            : '<span style="color: #64748b; font-size: 11px;">No site proof photos attached</span>';

        const signatureHtml = signatureUrl
          ? `<img src="${escapeHtml(signatureUrl)}" style="max-height: 60px; max-width: 180px; object-fit: contain; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px;" />`
          : '<span style="color: #64748b; font-size: 11px;">No signature recorded</span>';

        return `
          <div class="duty-card">
            <div class="card-header">
              <span class="record-badge">#${index + 1}</span>
              <span class="duty-date"><strong>Date:</strong> ${dateStr}</span>
              <span class="duty-time"><strong>Time:</strong> ${inTime} - ${outTime}</span>
              <span class="work-badge">${workType}</span>
            </div>

            <table class="card-table">
              <tr>
                <td style="width: 50%;">
                  <strong>Employee:</strong> ${empName} (${empId})<br/>
                  <strong>Company:</strong> ${compName} ${compLoc ? `• ${compLoc}` : ''}<br/>
                  <strong>Customer Contact:</strong> ${customer} (${customerPhone})<br/>
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
            <img class="brand-logo" src="${LOGO_URL}" alt="Logo" />
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">VAIRAVAN AUTOMATION</div>
              <div style="font-size: 11px; color: #64748b;">Industrial Field Service & Duty Management</div>
            </div>
          </div>
          <div class="title-block">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>

        <div class="filter-bar">
          <div><strong>Filter:</strong> ${escapeHtml(filterInfo || 'All Records')}</div>
          <div><strong>Total Duties:</strong> ${duties.length} | <strong>Generated:</strong> ${generatedDate}</div>
        </div>

        ${rowsHtml}

        <div class="footer-note">
          Official Duty Report Record • Vairavan Automation Automation Client System
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title} (PDF)`,
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate PDF export');
  }
};

/**
 * Export duty records to Excel-compatible CSV file with complete available details
 */
export const exportDutiesToExcel = async ({
  filename = 'Duty_Records',
  duties = [],
}) => {
  if (!duties || duties.length === 0) {
    Alert.alert('No Records', 'There are no duty records to export for the selected filter.');
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
    return;
  }

  try {
    const headers = [
      'Sl No',
      'Duty Date',
      'Employee ID',
      'Employee Name',
      'Employee Designation',
      'Company Name',
      'Company Location',
      'Customer Contact Name',
      'Customer Phone Number',
      'Machine Name',
      'Work Type',
      'In Time',
      'Out Time',
      'Work Description',
      'GPS Coordinates',
      'Customer Signature URL',
      'Proof Photos URLs',
      'Created At',
    ];

    const rows = duties.map((d, index) => {
      const empId = d.employee?.employeeId || '';
      const empName = d.employee?.employeeName || '';
      const empDesig = d.employee?.designation || '';
      const compName = d.company?.companyName || '';
      const compLoc = d.company?.location || '';
      const customer = d.customerName || '';
      const customerPhone = d.customerPhoneNumber || '';
      const machine = d.machineName || '';
      const workType = d.workType || '';
      const inTime = d.inTime || '';
      const outTime = d.outTime || '';
      const workDesc = d.workDescription || '';

      const lat = d.location?.latitude;
      const lng = d.location?.longitude;
      const coords = lat && lng ? `${lat}, ${lng}` : '';

      const signatureUrl = d.customerSignature?.url || '';
      const photos = Array.isArray(d.customerProofPhotos)
        ? d.customerProofPhotos.map((p) => p.url).join(' | ')
        : '';
      const createdAt = d.createdAt ? new Date(d.createdAt).toISOString() : '';

      return [
        index + 1,
        formatDate(d.dutyDate),
        escapeCsv(empId),
        escapeCsv(empName),
        escapeCsv(empDesig),
        escapeCsv(compName),
        escapeCsv(compLoc),
        escapeCsv(customer),
        escapeCsv(customerPhone),
        escapeCsv(machine),
        escapeCsv(workType),
        escapeCsv(inTime),
        escapeCsv(outTime),
        escapeCsv(workDesc),
        escapeCsv(coords),
        escapeCsv(signatureUrl),
        escapeCsv(photos),
        escapeCsv(createdAt),
      ].join(',');
    });

    // Add UTF-8 BOM so Excel opens with proper encoding
    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');

    const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileUri = `${FileSystem.cacheDirectory}${cleanFilename}_${Date.now()}.csv`;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${filename} (Excel/CSV)`,
      UTI: 'public.comma-separated-values-text',
    });
  } catch (err) {
    Alert.alert('Export Failed', err.message || 'Could not generate Excel export');
  }
};

export default {
  exportDutiesToPDF,
  exportDutiesToExcel,
};
