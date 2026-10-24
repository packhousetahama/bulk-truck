export type BulkSiloId = 'NEW_5' | 'NEW_6' | 'OLD_1' | 'OLD_2';

export type CementType = 'OPC' | 'GU' | 'PPC';

export type BulkQRVariant = 'VARIANT_1_PIPE' | 'VARIANT_2_JSON' | 'MANUAL';

export interface BulkSiloConfig {
  id: BulkSiloId;
  nameEn: string;
  nameAr: string;
  cementType: CementType;
  defaultStation: string;
  capacityTonnes?: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE';
}

export interface BulkTicketData {
  variant: BulkQRVariant;
  receiptNumber: string;
  vehicleNumber: string;
  cementType: CementType;
  rawMaterialCode?: string;
  authorisedTonnes: number;
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  printedSiloRef?: string; // e.g. "Tahama-Silo 1" or "6"
  isBaggedTicket?: boolean;
  conflictDetected?: boolean;
  conflictReason?: string;
  proposedSiloId?: BulkSiloId;
  rawPayload?: string;
}

export interface BulkActiveJob {
  siloId: BulkSiloId;
  receiptNumber: string;
  truckNumber: string;
  cementType: CementType;
  authorisedTonnes: number;
  actualTonnes?: number;
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  ticketSiloRef?: string;
  startTime: string; // "HH:MM:SS" or ISO
  startEpochMs: number;
  operator: string;
  shift: string;
  variant: BulkQRVariant;
  conflictDetected?: boolean;
  conflictResolution?: string;
  status: 'LOADING' | 'STOPPAGE';
  stoppageReason?: string;
  stoppageStartTime?: string;
  stoppageStartEpochMs?: number;
  totalDowntimeSeconds?: number;
  downtimeLog?: Array<{
    reason: string;
    startTime: string;
    endTime?: string;
    durationSeconds: number;
  }>;
}

export interface BulkEntry {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  shift: string;
  siloId: BulkSiloId;
  siloName: string;
  station: string;
  truckNumber: string;
  receiptNumber: string;
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  cementType: CementType;
  authorisedTonnes: number;
  actualTonnes: number;
  varianceTonnes?: number;
  startTime: string;
  endTime: string;
  grossDurationMinutes: number;
  downtimeMinutes: number;
  netDurationMinutes: number;
  loadingRateTonnesPerHour?: number;
  operator: string;
  status: 'COMPLETED' | 'CANCELLED';
  qrVariant: BulkQRVariant;
  conflictDetected: boolean;
  conflictResolution?: string;
  stoppageReason?: string;
  comments?: string;
}

export interface BulkSiloMetric {
  siloId: BulkSiloId;
  siloName: string;
  cementType: CementType;
  station: string;
  status: 'IDLE' | 'LOADING' | 'STOPPAGE' | 'MAINTENANCE';
  activeJob?: BulkActiveJob;
  todayTrucks: number;
  todayTonnes: number;
  todayDowntimeMinutes: number;
  avgLoadingMinutes: number;
}

export interface BulkDashboardMetrics {
  totalTrucks: number;
  totalTonnes: number;
  opcTonnes: number;
  guTonnes: number;
  ppcTonnes: number;
  avgGrossMinutes: number;
  avgNetMinutes: number;
  totalDowntimeMinutes: number;
  activeLoadingCount: number;
  activeStoppageCount: number;
  silos: Record<BulkSiloId, BulkSiloMetric>;
  recentEntries: BulkEntry[];
}

export interface User {
  id?: string;
  name: string;
  role: 'admin' | 'user';
  pin?: string;
  enabled?: boolean;
  plant?: string;
}

export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';
