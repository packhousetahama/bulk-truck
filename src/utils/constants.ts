import { BulkSiloId, BulkSiloConfig, CementType, User } from '../types';

export const BULK_BACKEND_URL =
  'https://script.google.com/macros/s/AKfycbwU3YZMMInR7_k8_WFTIqv-BDg5sR525AFJaUwpjAl_svkDgFIg_1eQ9227UQPjIZ6qQA/exec';

export const BULK_SILO_IDS: BulkSiloId[] = ['NEW_5', 'NEW_6', 'OLD_1', 'OLD_2'];

export const BULK_SILOS: Record<BulkSiloId, BulkSiloConfig> = {
  NEW_5: {
    id: 'NEW_5',
    nameEn: 'New Silo 5',
    nameAr: 'صومعة جديدة 5',
    cementType: 'OPC',
    defaultStation: 'Station 1',
    status: 'ACTIVE'
  },
  NEW_6: {
    id: 'NEW_6',
    nameEn: 'New Silo 6',
    nameAr: 'صومعة جديدة 6',
    cementType: 'OPC',
    defaultStation: 'Station 2',
    status: 'ACTIVE'
  },
  OLD_1: {
    id: 'OLD_1',
    nameEn: 'Old Silo 1',
    nameAr: 'صومعة قديمة 1',
    cementType: 'GU',
    defaultStation: 'Station 3',
    status: 'ACTIVE'
  },
  OLD_2: {
    id: 'OLD_2',
    nameEn: 'Old Silo 2',
    nameAr: 'صومعة قديمة 2',
    cementType: 'PPC',
    defaultStation: 'Station 4',
    status: 'ACTIVE'
  }
};

export const BULK_CEMENT_COMPATIBLE_SILOS: Record<CementType, BulkSiloId[]> = {
  OPC: ['NEW_5', 'NEW_6'],
  GU: ['OLD_1'],
  PPC: ['OLD_2']
};

export const BULK_CEMENT_CODES: Record<string, CementType> = {
  'FNBK1': 'OPC',
  'FNBKPPC': 'PPC',
  'FNBKGU': 'GU',
  'OPC': 'OPC',
  'PPC': 'PPC',
  'GU': 'GU',
  'SRC': 'GU',
  'ORDINARY PORTLAND CEMENT': 'OPC',
  'PORTLAND POZZOLANA CEMENT': 'PPC',
  'GENERAL USE': 'GU'
};

export const BAGGED_CEMENT_CODES: Record<string, string> = {
  'FNBG1': 'Bagged OPC',
  'FNBGPPC': 'Bagged PPC',
  'FNGU': 'Bagged GU'
};

export interface StoppageReasonOption {
  id: string;
  en: string;
  ar: string;
  category: 'MECHANICAL' | 'ELECTRICAL' | 'OPERATIONAL' | 'LOGISTICS';
}

export const BULK_STOPPAGE_REASONS: StoppageReasonOption[] = [
  { id: 'SCALE_FAULT', en: 'Weighbridge / Scale Malfunction', ar: 'عطل في الميزان / قبان التحميل', category: 'ELECTRICAL' },
  { id: 'AERATION_DELAY', en: 'Silo Fluidization / Aeration Delay', ar: 'تأخر تهوية الصومعة / تدفق غير كافٍ', category: 'MECHANICAL' },
  { id: 'BELLOW_CHUTE', en: 'Loading Bellow / Chute Jam', ar: 'انسداد خرطوم التفريغ / المنفاخ', category: 'MECHANICAL' },
  { id: 'POWER_OUTAGE', en: 'Electrical Power Trip / Outage', ar: 'انقطاع التيار الكهربائي', category: 'ELECTRICAL' },
  { id: 'TRUCK_REPOSITION', en: 'Truck Repositioning / Hatch Realignment', ar: 'إعادة ضبط تموضع الشاحنة / فتحة الخزان', category: 'LOGISTICS' },
  { id: 'VALVE_LEAK', en: 'Pneumatic Discharge Valve Leak', ar: 'تسريب صمام التفريغ الهوائي', category: 'MECHANICAL' },
  { id: 'OPERATOR_BREAK', en: 'Scheduled Operator Rest / Handover', ar: 'استراحة مشغل / تسليم وردية', category: 'OPERATIONAL' },
  { id: 'SAFETY_HOLD', en: 'Safety Hold / Dust Emission Check', ar: 'إيقاف لأسباب السلامة / فحص انبعاث الغبار', category: 'OPERATIONAL' },
  { id: 'OTHER', en: 'Other Technical Stoppage', ar: 'سبب فني آخر', category: 'OPERATIONAL' }
];

export const BULK_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/13WBpFJEtwXWu7bpet_4QTsqOn3DUaA9Ls9lXQ3YUW_Q/edit?gid=919326575';

// Pre-configured users with credentials (Admin + 6 Confirmed Operators + Legacy)
export type BulkStoppageType = 'NONE' | 'MECHANICAL' | 'INSTRUMENT' | 'PRODUCTION';
export const BULK_STOPPAGE_OPTIONS: BulkStoppageType[] = [
  'NONE',
  'MECHANICAL',
  'INSTRUMENT',
  'PRODUCTION'
];

// Pre-configured users with credentials (Admin + 6 Confirmed Operators + Legacy) - Unique 6-digit PINs
export const DEFAULT_USERS: User[] = [
  { id: 'admin', name: 'System Administrator', role: 'admin', enabled: true, pin: '841920' },
  { id: 'supervisor', name: 'Shift Supervisor', role: 'admin', enabled: true, pin: '841925' },
  { id: 'ali_garni', name: 'Ali Garni', role: 'user', enabled: true, pin: '521401' },
  { id: 'gulam_rabani', name: 'Gulam Rabani', role: 'user', enabled: true, pin: '521402' },
  { id: 'siddiq_shari', name: 'Siddiq Shari', role: 'user', enabled: true, pin: '521403' },
  { id: 'siddiq_ansari', name: 'Siddiq Ansari', role: 'user', enabled: true, pin: '521404' },
  { id: 'ahmed_nasir', name: 'Ahmed Nasir', role: 'user', enabled: true, pin: '521405' },
  { id: 'ali_arthi', name: 'Ali Arthi', role: 'user', enabled: true, pin: '521406' },
  // Historical operators
  { id: 'hasani', name: 'HASANI', role: 'user', enabled: true, pin: '631101' },
  { id: 'naif', name: 'NAIF', role: 'user', enabled: true, pin: '631102' },
  { id: 'abdulla', name: 'ABDULLA', role: 'user', enabled: true, pin: '631103' },
  { id: 'gasim', name: 'GASIM', role: 'user', enabled: true, pin: '631104' },
  { id: 'abu_niyaz', name: 'ABU NIYAZ', role: 'user', enabled: true, pin: '631105' },
  { id: 'dede', name: 'DEDE', role: 'user', enabled: true, pin: '631106' },
  { id: 'ayoub', name: 'AYOUB', role: 'user', enabled: true, pin: '631107' },
  { id: 'dvs_reddy', name: 'D. V. S REDDY', role: 'user', enabled: true, pin: '631108' }
];

export const DEFAULT_OPERATORS = [
  { id: 'admin', name: 'System Administrator', role: 'admin' as const },
  { id: 'ali_garni', name: 'Ali Garni', role: 'user' as const },
  { id: 'gulam_rabani', name: 'Gulam Rabani', role: 'user' as const },
  { id: 'siddiq_shari', name: 'Siddiq Shari', role: 'user' as const },
  { id: 'siddiq_ansari', name: 'Siddiq Ansari', role: 'user' as const },
  { id: 'ahmed_nasir', name: 'Ahmed Nasir', role: 'user' as const },
  { id: 'ali_arthi', name: 'Ali Arthi', role: 'user' as const }
];
