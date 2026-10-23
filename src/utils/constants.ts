import { BulkSiloId, BulkSiloConfig, CementType } from '../types';

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

export const DEFAULT_OPERATORS = [
  { name: 'Admin', role: 'admin' as const },
  { name: 'Hussein', role: 'user' as const },
  { name: 'Hassani', role: 'user' as const },
  { name: 'Basha', role: 'user' as const },
  { name: 'Iqbal', role: 'user' as const },
  { name: 'Operator 1', role: 'user' as const },
  { name: 'Operator 2', role: 'user' as const },
  { name: 'Operator 3', role: 'user' as const },
  { name: 'Operator 4', role: 'user' as const }
];
