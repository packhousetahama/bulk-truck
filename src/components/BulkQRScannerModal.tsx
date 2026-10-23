import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseBulkQrPayload, ParseResult } from '../utils/bulkQrParser';
import { useBulkApp } from '../context/BulkAppContext';
import { Camera, X, CheckCircle2, AlertTriangle, Clipboard, Sparkles, RefreshCw } from 'lucide-react';

interface BulkQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (result: ParseResult) => void;
}

export const BulkQRScannerModal: React.FC<BulkQRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const { playBeep, language } = useBulkApp();
  const [manualText, setManualText] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'bulk-qr-reader-container';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCameraError(null);
      const html5QrCode = new Html5Qrcode('bulk-qr-file-dummy');
      const decodedText = await html5QrCode.scanFile(file, true);
      handleDecodedPayload(decodedText);
    } catch (err: any) {
      setCameraError('Could not read QR from selected photo. Please ensure barcode is well lit and not blurry.');
    }
  };

  // Sample payloads from verified plant tickets for instant 1-tap testing
  const sampleVariant1 = '1|6L9JMQ|FNBKPPC|30|اقبال|+966556720380|4093-ASA';
  const sampleVariant2 = JSON.stringify({
    v: 1,
    type: 'order',
    orderNumber: 'DR5O4R',
    silo: 6,
    product: {
      name: 'ORDINARY PORTLAND CEMENT TI',
      variant: 'BULK ORDINARY PORTLAND CEMENT',
      variantCode: 'FNBK1',
      quantity: '24',
      unit: 'tons'
    },
    resource: {
      driver: { name: 'نظرت حسين', phone: '+966503565754', driverId: '2481358063' },
      vehicle: { licensePlate: '7733-GRA' }
    }
  });

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    const startScanner = async () => {
      try {
        setCameraError(null);
        setIsScanning(true);
        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 20,
            qrbox: (w, h) => { const sz = Math.floor(Math.min(w, h) * 0.85); return { width: sz, height: sz }; }
          },
          (decodedText) => {
            if (isMounted) {
              handleDecodedPayload(decodedText);
            }
          },
          () => {
            // Ignore scan frame misses
          }
        );
      } catch (err: any) {
        if (isMounted) {
          console.warn('Camera start error:', err);
          setCameraError(err.message || 'Camera permission denied or camera unavailable.');
          setIsScanning(false);
        }
      }
    };

    const timer = setTimeout(startScanner, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // cleanup ignore
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleDecodedPayload = (raw: string) => {
    playBeep();
    const result = parseBulkQrPayload(raw);
    stopScanner();
    onScanSuccess(result);
  };

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    handleDecodedPayload(manualText.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                {language === 'ar' ? 'مسح تذكرة التحميل' : 'Scan Dispatch Ticket QR'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'وجّه الكاميرا نحو الرمز المربع بالتذكرة' : 'Align camera over the ticket QR code'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Camera Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square flex items-center justify-center">
            <div id={readerId} className="w-full h-full" />

            {/* Target reticle overlay */}
            <div className="pointer-events-none absolute inset-0 border-2 border-amber-500/30 m-8 rounded-2xl flex items-center justify-center">
              <div className="w-12 h-12 border-t-2 border-l-2 border-amber-400 absolute -top-1 -left-1 rounded-tl-lg" />
              <div className="w-12 h-12 border-t-2 border-r-2 border-amber-400 absolute -top-1 -right-1 rounded-tr-lg" />
              <div className="w-12 h-12 border-b-2 border-l-2 border-amber-400 absolute -bottom-1 -left-1 rounded-bl-lg" />
              <div className="w-12 h-12 border-b-2 border-r-2 border-amber-400 absolute -bottom-1 -right-1 rounded-br-lg" />
              <span className="text-[11px] font-bold text-amber-400/80 bg-slate-950/80 px-2 py-0.5 rounded-md">
                {language === 'ar' ? 'ضع الرمز داخل الإطار' : 'Fit QR Inside Frame'}
              </span>
            </div>

            <div id="bulk-qr-file-dummy" className="hidden" />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
            />

            <div className="absolute bottom-3 right-3 z-10">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 shadow-lg backdrop-blur cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'صورة من المعرض / كاميرا' : 'Choose Photo / Snap'}</span>
              </button>
            </div>

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 font-semibold mb-1">
                  Camera unavailable
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mb-3">
                  {cameraError}
                </p>
                <span className="text-[11px] text-amber-400">
                  Please use manual input below
                </span>
              </div>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clipboard className="w-3.5 h-3.5 text-amber-400" />
                {language === 'ar' ? 'لصق أو إدخال يدوي للرمز' : 'Paste or Manual Code Entry'}
              </span>
            </div>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Paste ticket QR text (Pipe or JSON format)..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDecodedPayload(sampleVariant1)}
                  className="text-[10px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 px-2 py-1 rounded-lg font-mono transition"
                  title="Test Variant 1 (PPC Pipe Delimited)"
                >
                  ⚡ Test PPC Pipe
                </button>
                <button
                  type="button"
                  onClick={() => handleDecodedPayload(sampleVariant2)}
                  className="text-[10px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 px-2 py-1 rounded-lg font-mono transition"
                  title="Test Variant 2 (OPC JSON)"
                >
                  ⚡ Test OPC JSON
                </button>
              </div>

              <button
                type="button"
                disabled={!manualText.trim()}
                onClick={handleManualSubmit}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition shadow-md shadow-amber-500/10 active:scale-95"
              >
                {language === 'ar' ? 'تطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
