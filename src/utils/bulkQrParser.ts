import { BulkTicketData, CementType } from '../types';
import { BULK_CEMENT_CODES, BAGGED_CEMENT_CODES } from './constants';

export interface ParseResult {
  success: boolean;
  ticket?: BulkTicketData;
  error?: string;
  isBaggedTicket?: boolean;
}

/**
 * Unified Parser for Bulk Loading QR codes
 * Supports:
 * - Variant 1 (Pipe Delimited): 1|receipt|code|tonnes|driverName|driverPhone|plate
 * - Variant 2 (JSON): {"v":1,"type":"order",...}
 */
export function parseBulkQrPayload(raw: string): ParseResult {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Empty QR code payload.' };
  }

  // 1. Try Variant 2: JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseVariant2Json(parsed, trimmed);
    } catch {
      // Fall through if not valid JSON
    }
  }

  // 2. Try Variant 1: Pipe Delimited
  if (trimmed.includes('|')) {
    return parseVariant1Pipe(trimmed);
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
  const receiptNumber = data.orderNumber || data.receiptNumber || '';
  const product = data.product || {};
  const resource = data.resource || {};
  const vehicle = resource.vehicle || {};
  const driver = resource.driver || {};

  const vehicleNumber = vehicle.licensePlate || vehicle.plate || '';
  const rawMaterialCode = product.variantCode || product.code || '';
  const materialName = product.name || product.variant || '';
  const tonnes = parseFloat(product.quantity || product.tonnes || '0') || 0;
  const driverName = driver.name || '';
  const driverPhone = driver.phone || '';
  const driverId = driver.driverId || '';
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
    vehicleNumber,
    cementType,
    rawMaterialCode: rawMaterialCode || materialName,
    authorisedTonnes: tonnes,
    driverName,
    driverPhone,
    driverId,
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
  if (norm.includes('POZZOLANA') || norm.includes('PPC')) {
    return 'PPC';
  }
  if (norm.includes('PORTLAND') || norm.includes('OPC')) {
    return 'OPC';
  }
  if (norm.includes('GENERAL') || norm.includes('GU') || norm.includes('SRC')) {
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
    if (ticket.printedSiloRef === '6') {
      ticket.proposedSiloId = 'NEW_6';
    } else {
      ticket.proposedSiloId = 'NEW_5';
    }
  }
}
