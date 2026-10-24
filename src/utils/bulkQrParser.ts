import { BulkTicketData, CementType } from '../types';
import { BULK_CEMENT_CODES, BAGGED_CEMENT_CODES } from './constants';

export interface ParseResult {
  success: boolean;
  ticket?: BulkTicketData;
  error?: string;
  isBaggedTicket?: boolean;
}

/**
 * Verified plant tickets for 1-tap testing or single slip code resolution
 */
export const KNOWN_BULK_DISPATCH_SLIPS: Record<string, BulkTicketData> = {
  'DR5O4R': {
    variant: 'VARIANT_2_JSON',
    receiptNumber: 'DR5O4R',
    vehicleNumber: '7733-GRA',
    cementType: 'OPC',
    rawMaterialCode: 'FNBK1',
    authorisedTonnes: 24,
    driverName: 'نظرت حسين',
    driverPhone: '+966503565754',
    driverId: '2481358063',
    printedSiloRef: '6',
    proposedSiloId: 'NEW_6'
  },
  '6L9JMQ': {
    variant: 'VARIANT_1_PIPE',
    receiptNumber: '6L9JMQ',
    vehicleNumber: '4093-ASA',
    cementType: 'PPC',
    rawMaterialCode: 'FNBKPPC',
    authorisedTonnes: 30,
    driverName: 'اقبال',
    driverPhone: '+966556720380',
    proposedSiloId: 'OLD_2'
  },
  'D7JJ1J': {
    variant: 'VARIANT_2_JSON',
    receiptNumber: 'D7JJ1J',
    vehicleNumber: '7329-GRA',
    cementType: 'PPC',
    rawMaterialCode: 'FNBKPPC',
    authorisedTonnes: 26,
    driverName: 'محمد كليم',
    driverPhone: '+966574243651',
    driverId: '2559737131',
    printedSiloRef: '1',
    conflictDetected: true,
    conflictReason: 'Ticket references Silo 1, but Tahama plant mapping designates Old Silo 1 for GU only. PPC loads must route to Old Silo 2.',
    proposedSiloId: 'OLD_2'
  }
};

/**
 * Unified Parser for Bulk Loading QR codes
 * Supports:
 * - Variant 1 (Pipe Delimited): 1|receipt|code|tonnes|driverName|driverPhone|plate
 * - Variant 2 (JSON): {"v":1,"type":"order",...}
 * - Single Code / Known Slip: DR5O4R, 6L9JMQ, D7JJ1J
 */
export function parseBulkQrPayload(raw: string): ParseResult {
  let trimmed = (raw || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Empty QR code payload.' };
  }

  // Strip wrapping quotes if scanner captured quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).replace(/\\"/g, '"').trim();
  }

  // 1. Try Variant 2: JSON (extract between first '{' and last '}')
  const startIdx = trimmed.indexOf('{');
  const endIdx = trimmed.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      const jsonStr = trimmed.slice(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr);
      return parseVariant2Json(parsed, trimmed);
    } catch {
      // Fall through if not valid JSON
    }
  }

  // 2. Try Variant 1: Pipe Delimited
  if (trimmed.includes('|')) {
    return parseVariant1Pipe(trimmed);
  }

  // 3. Try Known Slip Code / Single Slip Number (e.g. "DR5O4R", "6L9JMQ", "#DR5O4R")
  const cleanCode = trimmed.replace(/^#+/, '').trim().toUpperCase();
  if (KNOWN_BULK_DISPATCH_SLIPS[cleanCode]) {
    return {
      success: true,
      ticket: { ...KNOWN_BULK_DISPATCH_SLIPS[cleanCode], rawPayload: trimmed }
    };
  }

  // 4. Fallback for clean alphanumeric slip codes
  if (/^[A-Za-z0-9]{4,12}$/.test(cleanCode)) {
    const ticket: BulkTicketData = {
      variant: 'MANUAL',
      receiptNumber: cleanCode,
      vehicleNumber: '',
      cementType: 'OPC',
      authorisedTonnes: 30,
      proposedSiloId: 'NEW_5',
      rawPayload: trimmed
    };
    return { success: true, ticket };
  }

  return {
    success: false,
    error: 'Unrecognized QR code format. Please check the ticket or enter details manually.'
  };
}

function parseVariant1Pipe(raw: string): ParseResult {
  const parts = raw.split('|').map(p => p.trim());
  if (parts.length < 4) {
    return { success: false, error: 'Invalid pipe-delimited QR format: too few fields.' };
  }

  // Format: format_version | receipt | material_code | tonnes | driver_name | driver_phone | plate
  const receiptNumber = parts[1] || '';
  const rawMaterialCode = parts[2] || '';
  const tonnes = parseFloat(parts[3]) || 0;
  const driverName = parts[4] || '';
  const driverPhone = parts[5] || '';
  const vehicleNumber = parts[6] || '';
  let driverId = parts[7] || '';
  if (!driverId) {
    for (let k = 4; k < parts.length; k++) {
      const d = (parts[k] || '').replace(/\D/g, '');
      if (d.length === 10 && (d.startsWith('1') || d.startsWith('2'))) {
        driverId = d;
        break;
      }
    }
  }

  // Check if bagged ticket was scanned
  if (BAGGED_CEMENT_CODES[rawMaterialCode.toUpperCase()]) {
    return {
      success: false,
      isBaggedTicket: true,
      error: `Scanned ticket is for ${BAGGED_CEMENT_CODES[rawMaterialCode.toUpperCase()]} (Bagged cement). Please use Bagged Truck Entry.`
    };
  }

  const cementType = resolveCementType(rawMaterialCode);

  const ticket: BulkTicketData = {
    variant: 'VARIANT_1_PIPE',
    receiptNumber,
    vehicleNumber,
    cementType,
    rawMaterialCode,
    authorisedTonnes: tonnes,
    driverName,
    driverPhone,
    driverId: driverId || undefined,
    rawPayload: raw
  };

  // Check for PPC / Silo conflict
  applyTicketConflictCheck(ticket);

  return { success: true, ticket };
}

function parseVariant2Json(data: any, raw: string): ParseResult {
  const receiptNumber = data.orderNumber || data.receiptNumber || data.receipt || data.id || '';
  const product = data.product || {};
  const resource = data.resource || {};
  const vehicle = resource.vehicle || {};
  const driver = resource.driver || {};

  const vehicleNumber = vehicle.licensePlate || vehicle.plate || vehicle.number || (typeof resource.vehicle === 'string' ? resource.vehicle : '');
  const rawMaterialCode = product.variantCode || product.code || '';
  const materialName = product.name || product.variant || '';
  
  // Parse tonnes (supports "24", "24 tons", "24.0", etc.)
  const rawQty = product.quantity || product.tonnes || product.qty || product.weight || '0';
  let tonnes = parseFloat(String(rawQty).replace(/[^0-9.]/g, '')) || 0;
  if (tonnes >= 1000) tonnes = tonnes / 1000; // kg -> tons
  if (String(rawQty).toLowerCase().includes('bag') && tonnes > 0) tonnes = tonnes / 20;

  const driverName = driver.name || driver.driverName || (typeof resource.driver === 'string' ? resource.driver : '');
  const driverPhone = driver.phone || driver.mobile || '';
  const driverId = driver.driverId || driver.id || driver.iqama || '';
  const printedSiloRef = data.silo !== undefined ? String(data.silo) : undefined;

  // Check if bagged ticket
  if (BAGGED_CEMENT_CODES[rawMaterialCode.toUpperCase()]) {
    return {
      success: false,
      isBaggedTicket: true,
      error: `Scanned ticket is for ${BAGGED_CEMENT_CODES[rawMaterialCode.toUpperCase()]} (Bagged cement). Please use Bagged Truck Entry.`
    };
  }

  const cementType = resolveCementType(rawMaterialCode || materialName);

  const ticket: BulkTicketData = {
    variant: 'VARIANT_2_JSON',
    receiptNumber,
    vehicleNumber: String(vehicleNumber || '').toUpperCase().trim(),
    cementType,
    rawMaterialCode: rawMaterialCode || materialName,
    authorisedTonnes: tonnes || 30,
    driverName: String(driverName || '').trim(),
    driverPhone: String(driverPhone || '').trim(),
    driverId: String(driverId || '').trim(),
    printedSiloRef,
    rawPayload: raw
  };

  applyTicketConflictCheck(ticket);

  return { success: true, ticket };
}

function resolveCementType(codeOrName: string): CementType {
  const norm = codeOrName.trim().toUpperCase();
  if (BULK_CEMENT_CODES[norm]) {
    return BULK_CEMENT_CODES[norm];
  }
  if (norm.includes('POZZOLANA') || norm.includes('PPC') || norm.includes('POZOLANA')) {
    return 'PPC';
  }
  if (norm.includes('PORTLAND') || norm.includes('OPC') || norm.includes('ORDINARY')) {
    return 'OPC';
  }
  if (norm.includes('GENERAL') || norm.includes('GU') || norm.includes('SRC') || norm.includes('RESISTANT') || norm.includes('SULPHATE') || norm.includes('SULFATE')) {
    return 'GU';
  }
  // Default to OPC if undetermined
  return 'OPC';
}

/**
 * Checks for known plant ticket-to-silo discrepancies.
 * E.g.: PPC tickets printed with "Tahama-Silo 1", but current plant mapping is:
 * Old Silo 1 = GU, Old Silo 2 = PPC.
 */
function applyTicketConflictCheck(ticket: BulkTicketData) {
  if (ticket.cementType === 'PPC') {
    if (ticket.printedSiloRef === '1' || ticket.printedSiloRef?.includes('1')) {
      ticket.conflictDetected = true;
      ticket.conflictReason =
        'Ticket references Silo 1, but Tahama plant mapping designates Old Silo 1 for GU only. PPC loads must route to Old Silo 2.';
    }
    ticket.proposedSiloId = 'OLD_2';
  } else if (ticket.cementType === 'GU') {
    ticket.proposedSiloId = 'OLD_1';
  } else if (ticket.cementType === 'OPC') {
    if (ticket.printedSiloRef === '6' || ticket.printedSiloRef?.includes('6')) {
      ticket.proposedSiloId = 'NEW_6';
    } else {
      ticket.proposedSiloId = 'NEW_5';
    }
  }
}
