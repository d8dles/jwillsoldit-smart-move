// pdf.js — renders an invoice's fields into a professional PDF document.
// This is the actual document Joey downloads or emails to a property
// manager; the JSON export is a separate, raw-data-only feature.

import PDFDocument from 'pdfkit';

const INK = '#0D0D0D';
const MID = '#6B6B6B';
const FOREST = '#1C3B2E';
const TRACE = '#E7E1D8';

const ROWS = [
  ['attention', 'Attention'],
  ['communityName', 'Community Name'],
  ['managementCompany', 'Property Management Company'],
  ['communityAddress', 'Community Address'],
  ['client', 'Client'],
  ['unitSuite', 'Unit/Suite'],
  ['leaseTerm', 'Lease Term'],
  ['applicationDate', 'Application Date'],
  ['moveInDate', 'Move In Date'],
  ['monthlyRent', 'Monthly Rent'],
  ['offeredCommissionFeePct', 'Offered Commission Fee %'],
];

function formatCurrency(value) {
  const num = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return null;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawLabelValue(doc, label, value, width) {
  const startY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MID).text(label.toUpperCase(), doc.x, startY, { width });
  doc.font('Helvetica').fontSize(11).fillColor(INK).text(value || '—', doc.x, doc.y, { width });
  doc.moveDown(0.6);
}

export function renderInvoicePdf(fields) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header band
      doc.rect(0, 0, doc.page.width, 92).fill(FOREST);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('JWILLSOLDIT', 54, 28);
      doc.font('Helvetica').fontSize(10).fillColor('#E7F0EA').text('Christin Rachelle Group · Locator Placement Invoice', 54, 54);
      doc.fillColor(INK);

      doc.moveDown(3.2);

      // Invoice number / date, top right of the body
      const topY = doc.y;
      doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(`Invoice ${fields.invoiceNumber || ''}`, 54, topY);
      doc.font('Helvetica').fontSize(10).fillColor(MID).text(`Date: ${fields.date || '—'}`, 54, doc.y + 2);
      doc.font('Helvetica').fontSize(10).fillColor(MID).text(`Agent: ${fields.agent || 'Joey Williams'}  ·  TREC #${fields.trecNumber || ''}`, 54, doc.y + 2);
      doc.moveDown(1.2);

      doc.moveTo(54, doc.y).lineTo(doc.page.width - 54, doc.y).strokeColor(TRACE).stroke();
      doc.moveDown(1);

      const colWidth = (doc.page.width - 108 - 24) / 2;
      let leftY = doc.y;
      let rightY = doc.y;

      ROWS.forEach(([key, label], i) => {
        let value = fields[key];
        if (key === 'monthlyRent') {
          const formatted = formatCurrency(value);
          value = formatted ? `$${formatted}` : value;
        } else if (key === 'offeredCommissionFeePct' && value) {
          value = `${value}%`;
        }
        if (i % 2 === 0) {
          doc.y = leftY;
          drawLabelValue(doc, label, value, colWidth);
          leftY = doc.y;
        } else {
          doc.y = rightY;
          const savedX = doc.x;
          doc.x = 54 + colWidth + 24;
          drawLabelValue(doc, label, value, colWidth);
          rightY = doc.y;
          doc.x = savedX;
        }
      });

      doc.y = Math.max(leftY, rightY);
      doc.x = 54;
      doc.moveDown(0.4);

      // Commission description, full width
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MID).text('COMMISSION DESCRIPTION', 54, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(fields.commissionDescription || '—', 54, doc.y, { width: doc.page.width - 108 });
      doc.moveDown(1);

      // Balance due — highlighted box, the number that matters most
      const boxY = doc.y;
      doc.rect(54, boxY, doc.page.width - 108, 48).fill(FOREST);
      doc.fillColor('#E7F0EA').font('Helvetica-Bold').fontSize(9).text('BALANCE DUE', 70, boxY + 10);
      const formattedBalance = formatCurrency(fields.balanceDue);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(
        formattedBalance ? `$${formattedBalance}` : (fields.balanceDue || '—'),
        70, boxY + 22
      );
      doc.fillColor(INK);
      doc.y = boxY + 48;
      doc.moveDown(1.4);

      // Payment instructions + W9 note
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MID).text('PAYMENT INSTRUCTIONS', 54, doc.y);
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(fields.paymentInstructions || '—', 54, doc.y, { width: doc.page.width - 108 });
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MID).text('BROKER W9 NOTE', 54, doc.y);
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(fields.brokerW9Note || '—', 54, doc.y, { width: doc.page.width - 108 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
