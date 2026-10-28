import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import reportApi from '../api/reportApi';
import { promptDownloadOrShare, writeBase64ToCacheFile, printHtmlOnWeb } from './exportUtils';

const LOGO_URL =
  'https://res.cloudinary.com/etdurbgp/image/upload/v1791802852/vairavan_app/app_logo.png';

const BRANDING_FOOTER_HTML = `
  <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center;">
    Duty Management System • Developed by <a href="https://www.ameyy.in/" target="_blank" style="color: #1e40af; font-weight: 600; text-decoration: underline;">Ameyy Digital Services</a>
  </div>
`;

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
 * Format currency in Indian Rupees
 */
const formatINR = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

/**
 * Build rich HTML for All-in-One PDF Report
 */
export const buildAllInOneReportHtml = (reportData) => {
  const meta = reportData.meta || {};
  const summary = reportData.summary || {};
  const companies = reportData.companies || [];
  const duties = reportData.duties || [];
  const employees = reportData.employees || [];
  const leaves = reportData.leaves || [];
  const compOffCredits = reportData.compOffCredits || [];
  const overtimeRecords = reportData.overtimeRecords || [];
  const expenses = reportData.expenses || [];
  const calendar = reportData.employeeCalendar;

  // Filter summary chips
  const filtersApplied = meta.filtersApplied || {};
  const filterChipsHtml = Object.entries(filtersApplied)
    .filter(([_, v]) => v && v !== 'All')
    .map(([k, v]) => `<span class="chip"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`)
    .join(' ');

  // Summary KPI Cards (9 metrics)
  const kpiCardsHtml = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Companies</div>
        <div class="kpi-value">${summary.totalCompanies || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Clients</div>
        <div class="kpi-value">${summary.totalClients || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Staff Members</div>
        <div class="kpi-value">${summary.totalEmployees || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Work Records</div>
        <div class="kpi-value">${summary.totalWorkRecords || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Working Days</div>
        <div class="kpi-value">${summary.totalWorkingDays || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Leave Days</div>
        <div class="kpi-value">${summary.totalLeaveDays || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Comp-Off Earned</div>
        <div class="kpi-value">${summary.totalCompOffRecords || 0}</div>
      </div>
      <div class="kpi-card highlight-orange">
        <div class="kpi-title">OT Hours (&gt; 8h)</div>
        <div class="kpi-value">${summary.totalOtHours || 0} hrs</div>
      </div>
      <div class="kpi-card highlight-blue">
        <div class="kpi-title">Total Expenses</div>
        <div class="kpi-value">${formatINR(summary.totalExpenses || 0)}</div>
      </div>
    </div>
  `;

  // Section 1: Companies & Clients Table
  const companiesHtml = `
    <div class="section-title">1. Companies & Clients Directory (${companies.length})</div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Company Name</th>
          <th>Type</th>
          <th>Location</th>
          <th>Phone</th>
          <th>Duties</th>
          <th>Expenses</th>
          <th>Clients / Contacts</th>
        </tr>
      </thead>
      <tbody>
        ${companies.length === 0 ? '<tr><td colspan="8" class="empty-cell">No company records</td></tr>' : ''}
        ${companies
          .map(
            (c, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td><strong>${escapeHtml(c.companyName)}</strong></td>
            <td><span class="badge ${c.companyType === 'office' ? 'badge-blue' : 'badge-green'}">${c.companyType === 'office' ? 'Office' : 'Client Site'}</span></td>
            <td>${escapeHtml(c.location || 'N/A')}</td>
            <td>${escapeHtml(c.companyPhoneNumber || 'N/A')}</td>
            <td style="text-align: center;">${c.totalDuties || 0}</td>
            <td style="text-align: right;">${formatINR(c.totalExpenses || 0)}</td>
            <td>${(c.clients || []).map((cl) => `${escapeHtml(cl.clientName)} (${escapeHtml(cl.clientPhoneNumber || 'N/A')})`).join('; ') || 'No clients'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Section 2: Works & Field Visits Table
  const dutiesHtml = `
    <div class="section-title">2. Field Work & Machine Service Details (${duties.length})</div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Work ID</th>
          <th>Date</th>
          <th>Staff Member</th>
          <th>Company & Client</th>
          <th>Timings (IST)</th>
          <th>Duration</th>
          <th>OT</th>
          <th>Machine & Type</th>
          <th>Description</th>
          <th>Expenses</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${duties.length === 0 ? '<tr><td colspan="12" class="empty-cell">No work records for this period</td></tr>' : ''}
        ${duties
          .map(
            (d, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td><strong>${escapeHtml(d.dutyId)}</strong></td>
            <td>${escapeHtml(d.dutyDateReadable || d.dutyDateStr)}</td>
            <td>${escapeHtml(d.employee?.employeeName || 'N/A')}<br/><small style="color: #64748b;">${escapeHtml(d.employee?.employeeId || '')}</small></td>
            <td><strong>${escapeHtml(d.company?.companyName || 'N/A')}</strong><br/><small style="color: #475569;">${escapeHtml(d.customerName || '')}</small></td>
            <td>${escapeHtml(d.inTime || 'N/A')} - ${escapeHtml(d.outTime || 'N/A')}</td>
            <td>${d.workingHours || 0} hrs</td>
            <td style="color: ${d.otHours > 0 ? '#ea580c' : '#64748b'}; font-weight: ${d.otHours > 0 ? '700' : '400'};">${d.otHours > 0 ? `${d.otHours}h` : '-'}</td>
            <td><strong>${escapeHtml(d.machineName || 'N/A')}</strong><br/><small>${escapeHtml(d.workType || '')}</small></td>
            <td style="max-width: 160px; font-size: 9px;">${escapeHtml(d.workDescription || 'N/A')}</td>
            <td style="text-align: right;">${d.totalExpenseAmount > 0 ? formatINR(d.totalExpenseAmount) : '-'}</td>
            <td><span class="badge ${d.status === 'approved' ? 'badge-green' : d.status === 'submitted' ? 'badge-blue' : 'badge-amber'}">${escapeHtml(d.status || 'N/A')}</span></td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Section 3: Employee Details & Performance
  const employeesHtml = `
    <div class="section-title">3. Employee Performance & Attendance Summary (${employees.length})</div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Employee ID</th>
          <th>Staff Name</th>
          <th>Designation</th>
          <th>Contact</th>
          <th>Works</th>
          <th>Worked Days</th>
          <th>Total Hours</th>
          <th>OT Hours</th>
          <th>Leaves Taken</th>
          <th>Comp-Off Earned</th>
          <th>Total Expenses</th>
        </tr>
      </thead>
      <tbody>
        ${employees.length === 0 ? '<tr><td colspan="12" class="empty-cell">No employee records</td></tr>' : ''}
        ${employees
          .map(
            (e, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td><strong>${escapeHtml(e.employeeId)}</strong></td>
            <td><strong>${escapeHtml(e.employeeName)}</strong></td>
            <td>${escapeHtml(e.designation || 'Staff')}</td>
            <td>${escapeHtml(e.phoneNumber || 'N/A')}</td>
            <td style="text-align: center;">${e.totalDuties || 0}</td>
            <td style="text-align: center;">${e.totalWorkingDays || 0}</td>
            <td style="text-align: right;">${e.totalWorkingHours || 0} hrs</td>
            <td style="text-align: right; color: ${e.totalOtHours > 0 ? '#ea580c' : 'inherit'}; font-weight: ${e.totalOtHours > 0 ? '700' : '400'};">${e.totalOtHours || 0} hrs</td>
            <td style="text-align: center;">${(e.casualLeaveDays || 0) + (e.compOffLeaveDays || 0)} d</td>
            <td style="text-align: center; color: #2563eb; font-weight: 700;">${e.compOffCreditsEarned || 0}</td>
            <td style="text-align: right;">${formatINR(e.totalExpensesClaimed || 0)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Section 4: Leaves & Comp-Off Records
  const leavesHtml = `
    <div class="section-title">4. Leaves & Sunday Comp-Off Records (${leaves.length + compOffCredits.length})</div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Employee ID</th>
          <th>Staff Name</th>
          <th>Type</th>
          <th>Date Range / Sunday</th>
          <th>Days / Units</th>
          <th>Reason / Notes</th>
          <th>Status</th>
          <th>Review Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${leaves.length === 0 && compOffCredits.length === 0 ? '<tr><td colspan="9" class="empty-cell">No leave or comp-off records</td></tr>' : ''}
        ${leaves
          .map(
            (l, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>${escapeHtml(l.employee?.employeeId || 'N/A')}</td>
            <td><strong>${escapeHtml(l.employee?.employeeName || 'N/A')}</strong></td>
            <td><span class="badge ${l.leaveType === 'comp_off' ? 'badge-blue' : 'badge-red'}">${l.leaveType === 'comp_off' ? 'Comp-Off Leave' : 'Casual Leave'}</span></td>
            <td>${escapeHtml(l.startDate ? l.startDate.split('T')[0] : '')} to ${escapeHtml(l.endDate ? l.endDate.split('T')[0] : '')}</td>
            <td style="text-align: center;">${l.daysCount || 1} day</td>
            <td>${escapeHtml(l.reason || 'N/A')}</td>
            <td><span class="badge ${l.status === 'approved' ? 'badge-green' : l.status === 'pending' ? 'badge-amber' : 'badge-red'}">${escapeHtml(l.status || 'N/A')}</span></td>
            <td>${escapeHtml(l.adminRemarks || 'N/A')}</td>
          </tr>
        `
          )
          .join('')}
        ${compOffCredits
          .map(
            (c, i) => `
          <tr style="background: #fff7ed;">
            <td style="text-align: center;">${leaves.length + i + 1}</td>
            <td>${escapeHtml(c.employee?.employeeId || 'N/A')}</td>
            <td><strong>${escapeHtml(c.employee?.employeeName || 'N/A')}</strong></td>
            <td><span class="badge badge-orange">Sunday Comp-Off Earned</span></td>
            <td>${escapeHtml(c.sundayDateString || (c.sundayDate ? c.sundayDate.split('T')[0] : ''))}</td>
            <td style="text-align: center;">1 credit</td>
            <td>${escapeHtml(c.notes || 'Sunday attendance credit')}</td>
            <td><span class="badge badge-green">EARNED</span></td>
            <td>Auto-awarded by system</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Section 5: Overtime (OT)
  const otHtml = `
    <div class="section-title">5. Overtime (OT) Log - Shifts Exceeding Standard 8 Hours (${overtimeRecords.length})</div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Date</th>
          <th>Work ID</th>
          <th>Staff Member</th>
          <th>Company</th>
          <th>In - Out</th>
          <th>Total Hours</th>
          <th>Standard Shift</th>
          <th>OT Hours</th>
          <th>Work Type</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${overtimeRecords.length === 0 ? '<tr><td colspan="11" class="empty-cell">No overtime records for this period</td></tr>' : ''}
        ${overtimeRecords
          .map(
            (ot, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>${escapeHtml(ot.dutyDateStr)}</td>
            <td><strong>${escapeHtml(ot.dutyId)}</strong></td>
            <td>${escapeHtml(ot.employee?.employeeName || 'N/A')}</td>
            <td>${escapeHtml(ot.company?.companyName || 'N/A')}</td>
            <td>${escapeHtml(ot.inTime)} - ${escapeHtml(ot.outTime)}</td>
            <td>${ot.workingHours} hrs</td>
            <td>8.0 hrs</td>
            <td style="color: #ea580c; font-weight: 700;">${ot.otHours} hrs</td>
            <td>${escapeHtml(ot.workType)}</td>
            <td><span class="badge badge-green">${escapeHtml(ot.status || 'N/A')}</span></td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Section 6: Expenses
  const expensesHtml = `
    <div class="section-title">6. Expense Claims Breakdown (${expenses.length})</div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Claim #</th>
          <th>Date</th>
          <th>Staff Member</th>
          <th>Company / Site</th>
          <th>Related Duty</th>
          <th>Itemized Breakdown</th>
          <th>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.length === 0 ? '<tr><td colspan="8" class="empty-cell">No expense claims for this period</td></tr>' : ''}
        ${expenses
          .map(
            (exp, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td><strong>${escapeHtml(exp.expenseId || 'EXP')}</strong></td>
            <td>${escapeHtml(exp.expenseDate ? exp.expenseDate.split('T')[0] : 'N/A')}</td>
            <td>${escapeHtml(exp.employee?.employeeName || 'N/A')}</td>
            <td>${escapeHtml(exp.company?.companyName || 'N/A')}</td>
            <td>${escapeHtml(exp.duty?.dutyId || exp.relatedDuty || 'N/A')}</td>
            <td>
              ${(exp.items || [])
                .map((it) => {
                  const dist = it.calculationMode === 'automatic'
                    ? ` (${it.totalDistance || ((it.outboundDistance || 0) + (it.returnDistance || 0))} km @ ₹${it.ratePerUnit}/km)`
                    : '';
                  return `• ${escapeHtml(it.categoryName)}: ${formatINR(it.amount)}${dist}`;
                })
                .join('<br/>')}
            </td>
            <td style="text-align: right; font-weight: 700; color: #1e40af;">${formatINR(exp.grandTotal || 0)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Section 7: Individual Employee Calendar (if available)
  let calendarHtml = '';
  if (calendar && calendar.calendarDays && calendar.calendarDays.length > 0) {
    calendarHtml = `
      <div class="section-title">7. Employee Monthly Calendar - ${escapeHtml(calendar.employee?.employeeName || 'Staff')} (${escapeHtml(calendar.employee?.employeeId || '')})</div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Date</th>
            <th>Day</th>
            <th>Attendance Status</th>
            <th>Schedule</th>
            <th>Work ID / Duty</th>
            <th>Shift Timings</th>
            <th>Duration</th>
            <th>OT Hours</th>
            <th>Leave Details</th>
          </tr>
        </thead>
        <tbody>
          ${calendar.calendarDays
            .map(
              (day, i) => `
            <tr>
              <td style="text-align: center;">${i + 1}</td>
              <td>${escapeHtml(day.dateStr)}</td>
              <td>${escapeHtml(day.dayName)}</td>
              <td><span style="color: ${day.statusColor}; font-weight: 700;">${escapeHtml(day.status)}</span></td>
              <td>${day.isSunday ? 'Sunday Holiday' : day.isHoliday ? `Holiday (${escapeHtml(day.holidayName || '')})` : 'Working Day'}</td>
              <td>${day.duty ? `${escapeHtml(day.duty.dutyId)} • ${escapeHtml(day.duty.companyName)}` : '-'}</td>
              <td>${day.duty ? `${escapeHtml(day.duty.inTime)} - ${escapeHtml(day.duty.outTime)}` : '-'}</td>
              <td>${day.duty ? `${day.duty.durationMinutes} mins` : '-'}</td>
              <td style="color: ${day.duty && day.duty.otHours > 0 ? '#ea580c' : 'inherit'}; font-weight: 700;">${day.duty && day.duty.otHours > 0 ? `${day.duty.otHours}h` : '-'}</td>
              <td>${day.leave ? `${escapeHtml(day.leave.leaveType)} (${escapeHtml(day.leave.status)})` : '-'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Vairavan Automation - All-in-One Operations Report</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 16px;
            margin: 0;
            font-size: 10px;
            background: #ffffff;
          }
          @page {
            margin: 12mm 10mm;
            size: A4 portrait;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .header-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
          }
          .title-area h1 {
            margin: 0;
            font-size: 16px;
            color: #1e40af;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .title-area .sub {
            font-size: 11px;
            color: #475569;
            font-weight: 600;
            margin-top: 2px;
          }
          .meta-box {
            text-align: right;
            font-size: 9px;
            color: #64748b;
          }
          .chips-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 12px;
            padding: 6px 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
          }
          .chip {
            background: #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            color: #1e293b;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 6px;
            text-align: center;
          }
          .kpi-title {
            font-size: 8px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .kpi-value {
            font-size: 14px;
            font-weight: 800;
            color: #1e293b;
          }
          .highlight-orange {
            background: #fff7ed;
            border-color: #fdba74;
          }
          .highlight-orange .kpi-value {
            color: #ea580c;
          }
          .highlight-blue {
            background: #eff6ff;
            border-color: #bfdbfe;
          }
          .highlight-blue .kpi-value {
            color: #1e40af;
          }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            color: #1e40af;
            border-left: 4px solid #1e40af;
            padding-left: 8px;
            margin-top: 18px;
            margin-bottom: 8px;
            page-break-after: avoid;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin-bottom: 14px;
            page-break-inside: auto;
          }
          .report-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .report-table th {
            background: #1e40af;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 5px 6px;
            border: 1px solid #1e40af;
            font-size: 9px;
          }
          .report-table td {
            padding: 5px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
          }
          .report-table tbody tr:nth-child(even) {
            background: #f8fafc;
          }
          .empty-cell {
            text-align: center;
            color: #94a3b8;
            padding: 12px;
            font-style: italic;
          }
          .badge {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-green { background: #dcfce7; color: #15803d; }
          .badge-blue { background: #dbeafe; color: #1d4ed8; }
          .badge-amber { background: #fef3c7; color: #b45309; }
          .badge-orange { background: #ffedd5; color: #c2410c; }
          .badge-red { background: #fee2e2; color: #b91c1c; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${LOGO_URL}" class="header-logo" alt="Logo" />
            <div class="title-area">
              <h1>Vairavan Automation</h1>
              <div class="sub">All-in-One Operations & Executive Summary Report</div>
            </div>
          </div>
          <div class="meta-box">
            <div><strong>Period:</strong> ${escapeHtml(meta.dateRangeLabel || 'This Month')}</div>
            <div><strong>Range:</strong> ${escapeHtml(meta.startDate || '')} to ${escapeHtml(meta.endDate || '')}</div>
            <div><strong>Generated:</strong> ${escapeHtml(meta.generatedAtReadable || '')}</div>
          </div>
        </div>

        ${filterChipsHtml ? `<div class="chips-bar">${filterChipsHtml}</div>` : ''}

        ${kpiCardsHtml}
        ${companiesHtml}
        ${dutiesHtml}
        ${employeesHtml}
        ${leavesHtml}
        ${otHtml}
        ${expensesHtml}
        ${calendarHtml}

        ${BRANDING_FOOTER_HTML}
      </body>
    </html>
  `;
};

/**
 * Generate and Download or Share All-in-One PDF Report
 */
export const exportAllInOneToPDF = async ({ reportData, action = 'download' }) => {
  if (!reportData) {
    Alert.alert('Error', 'Report data is required to generate PDF export.');
    return;
  }

  const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);

  try {
    const htmlContent = buildAllInOneReportHtml(reportData);

    // On Web: print via isolated iframe / window (triggers browser "Save as PDF" / Print)
    if (Platform.OS === 'web') {
      printHtmlOnWeb(htmlContent, 'All-in-One Operations Report');
      return;
    }

    const pdf = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const safeStart = (reportData.meta?.startDate || 'start').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeEnd = (reportData.meta?.endDate || 'end').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Vairavan_All_In_One_Report_${safeStart}_to_${safeEnd}.pdf`;

    if (action === 'share') {
      if (!isSharingAvailable) {
        Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(pdf.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share All-in-One Report (PDF)',
        UTI: 'com.adobe.pdf',
      });
      return;
    }

    // Default download action
    await promptDownloadOrShare({
      fileUri: pdf.uri,
      filename,
      mimeType: 'application/pdf',
      dialogTitle: 'Download All-in-One Report (PDF)',
    });
  } catch (err) {
    console.error('PDF export error:', err);
    Alert.alert('Export Failed', err.message || 'Could not generate PDF report.');
  }
};

/**
 * Fetch and Download or Share All-in-One Excel Report (.xlsx with 9 worksheets)
 */
export const exportAllInOneToExcel = async ({ filters = {}, action = 'download' }) => {
  const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);

  try {
    const response = await reportApi.exportExcel(filters);
    const payload = response?.data || response;
    const base64 = payload?.base64;
    const filename = payload?.filename;

    if (!base64) {
      throw new Error('Server did not return Excel file data.');
    }

    const safeName = filename || `Vairavan_All_In_One_Report_${Date.now()}.xlsx`;

    // On Web: direct download via Blob URL
    if (Platform.OS === 'web') {
      try {
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        return;
      } catch (webErr) {
        console.warn('Web Excel download error, fallback to data URI:', webErr);
        const link = document.createElement('a');
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }

    const fileUri = await writeBase64ToCacheFile(safeName, base64);

    if (action === 'share') {
      if (!isSharingAvailable || !fileUri) {
        Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Share All-in-One Report (Excel)',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
      return;
    }

    // Default download action
    await promptDownloadOrShare({
      fileUri,
      filename: safeName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Download All-in-One Report (Excel)',
      base64,
    });
  } catch (err) {
    console.error('Excel export error:', err);
    Alert.alert('Excel Export Failed', err.message || 'Could not generate Excel spreadsheet.');
  }
};

export default {
  buildAllInOneReportHtml,
  exportAllInOneToPDF,
  exportAllInOneToExcel,
};

