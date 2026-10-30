import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { parseBulkQrPayload, ParseResult, KNOWN_BULK_DISPATCH_SLIPS } from '../utils/bulkQrParser';
import { useBulkApp } from '../context/BulkAppContext';
import { Camera, X, CheckCircle2, AlertTriangle, Clipboard, Sparkles, RefreshCw, Upload } from 'lucide-react';

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
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isScanningRef = useRef<boolean>(false);
  const readerId = 'bulk-qr-reader-container';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);



  // Handle photo capture / file upload with multi-pass scanning
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingPhoto(true);
      setCameraError(null);

      // Pass 1: Try Native BarcodeDetector API if supported (extremely fast & accurate for dense QR codes)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const imgBitmap = await createImageBitmap(file);
          const detected = await detector.detect(imgBitmap);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            handleDecodedPayload(detected[0].rawValue);
            setIsProcessingPhoto(false);
            return;
          }
        } catch (nativeErr) {
          console.warn('Native BarcodeDetector pass failed, falling back:', nativeErr);
        }
      }

      // Pass 2: Html5Qrcode standard file scan
      const html5QrCode = new Html5Qrcode('bulk-qr-file-dummy', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false
      });

      try {
        const decodedText = await html5QrCode.scanFile(file, true);
        if (decodedText) {
          handleDecodedPayload(decodedText);
          setIsProcessingPhoto(false);
          return;
        }
      } catch {
        // Continue to canvas preprocessing pass
      }

      // Pass 3: Canvas Preprocessing (Upper 60% crop + High Contrast Binarization)
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Crop top 65% of the ticket where the QR code resides
        const cropH = Math.floor(img.naturalHeight * 0.65);
        canvas.width = img.naturalWidth;
        canvas.height = cropH;
        ctx.drawImage(img, 0, 0, img.naturalWidth, cropH, 0, 0, img.naturalWidth, cropH);

        // Try scanning the crop with BarcodeDetector if available
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const detected = await detector.detect(canvas);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              URL.revokeObjectURL(objectUrl);
              handleDecodedPayload(detected[0].rawValue);
              setIsProcessingPhoto(false);
              return;
            }
          } catch {}
        }

        // Apply contrast thresholding (turns dark grey dots black and yellow paper white)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const val = lum > 130 ? 255 : 0;
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        }
        ctx.putImageData(imgData, 0, 0);

        // Convert canvas to blob and scan with Html5Qrcode
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
        if (blob) {
          const processedFile = new File([blob], 'preprocessed_qr.png', { type: 'image/png' });
          try {
            const text = await html5QrCode.scanFile(processedFile, true);
            if (text) {
              URL.revokeObjectURL(objectUrl);
              handleDecodedPayload(text);
              setIsProcessingPhoto(false);
              return;
            }
          } catch {}
        }
      }
      URL.revokeObjectURL(objectUrl);

      // If all automatic decoding failed, prompt user to enter the receipt code directly (e.g. DR5O4R)
      setCameraError(
        language === 'ar'
          ? 'تعذر قراءة الرمز من الصورة. يمكنك إدخال رقم الإيصال المطبوع بالتذكرة (مثال: DR5O4R) أدناه للمتابعة الفورية.'
          : 'Could not read QR from selected photo. You can type or paste the printed ticket code (e.g. DR5O4R) below to proceed immediately.'
      );
    } catch (err: any) {
      setCameraError('Photo decoding failed. Please use manual entry or tap test buttons.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Forcefully stop all active camera video tracks on the page to prevent hardware HAL lock
  const forceStopCameraStreams = () => {
    try {
      const container = document.getElementById(readerId);
      if (container) {
        const videos = container.querySelectorAll('video');
        videos.forEach(v => {
          if (v.srcObject && 'getTracks' in (v.srcObject as any)) {
            (v.srcObject as MediaStream).getTracks().forEach(t => {
              try {
                t.stop();
                t.enabled = false;
              } catch {}
            });
            v.srcObject = null;
          }
        });
      }
      document.querySelectorAll<HTMLVideoElement>('video').forEach(v => {
        if (v.closest('#' + readerId) || v.id.includes('bulk-qr') || v.id.includes('html5-qrcode')) {
          if (v.srcObject && 'getTracks' in (v.srcObject as any)) {
            (v.srcObject as MediaStream).getTracks().forEach(t => {
              try {
                t.stop();
                t.enabled = false;
              } catch {}
            });
            v.srcObject = null;
          }
        }
      });
    } catch (err) {
      console.warn('Error releasing bulk camera hardware tracks:', err);
    }
  };

  const stopScanner = async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (scanner.isScanning) {
          await scanner.stop().catch(() => {});
        }
        try {
          await scanner.clear();
        } catch {}
      }
    } catch (e) {
      console.warn('Error stopping bulk scanner:', e);
    } finally {
      forceStopCameraStreams();
      isScanningRef.current = false;
      setIsScanning(false);
      const container = document.getElementById(readerId);
      if (container) {
        container.innerHTML = '';
      }
    }
  };

  const startScanner = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    try {
      // 1. Fully release previous camera stream before acquiring new stream
      await stopScanner();

      // Brief delay to allow mobile camera hardware HAL to completely release
      await new Promise(resolve => setTimeout(resolve, 150));

      const container = document.getElementById(readerId);
      if (!container) {
        isStartingRef.current = false;
        return;
      }
      container.innerHTML = '';

      const html5QrCode = new Html5Qrcode(readerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 20,
          qrbox: (w, h) => {
            const sz = Math.floor(Math.min(w, h) * 0.85);
            return { width: sz, height: sz };
          },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
          }
        },
        (decodedText) => {
          handleDecodedPayload(decodedText);
        },
        () => {
          // Ignore scan frame misses
        }
      );

      isScanningRef.current = true;
      setIsScanning(true);

      // Native BarcodeDetector continuous video scanning overlay if supported
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const checkVideo = async () => {
            if (!isScanningRef.current) return;
            const video = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
            if (video && video.readyState >= 2) {
              try {
                const barcodes = await detector.detect(video);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleDecodedPayload(barcodes[0].rawValue);
                  return;
                }
              } catch {}
            }
            animationFrameRef.current = requestAnimationFrame(checkVideo);
          };
          animationFrameRef.current = requestAnimationFrame(checkVideo);
        } catch {}
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      forceStopCameraStreams();
      setCameraError(err.message || 'Camera permission denied or camera unavailable.');
      setIsScanning(false);
      isScanningRef.current = false;
    } finally {
      isStartingRef.current = false;
    }
  };

  useEffect(() => {
    let isCancelled = false;
    if (isOpen) {
      const timer = setTimeout(() => {
        if (!isCancelled) {
          startScanner();
        }
      }, 250);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleSafeClose = async () => {
    await stopScanner();
    setCameraError(null);
    onClose();
  };

  const handleDecodedPayload = async (raw: string) => {
    playBeep();
    const result = parseBulkQrPayload(raw);
    await stopScanner();
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
                {language === 'ar' ? 'مسح تذكرة التحميل السائب' : 'Scan Bulk Ticket QR'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'يدعم تذاكر الصوامع (JSON و Pipe والرموز المباشرة)' : 'Supports JSON orders, Pipe, & Slip Codes'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
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
              <span className="text-[11px] font-bold text-amber-400/90 bg-slate-950/85 px-2.5 py-0.5 rounded-md shadow">
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
                disabled={isProcessingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 disabled:opacity-50 text-amber-400 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 shadow-lg backdrop-blur cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isProcessingPhoto ? (language === 'ar' ? 'جاري فحص الصورة...' : 'Analyzing Photo...') : language === 'ar' ? 'التقاط صورة / المعرض' : 'Snap Photo / Upload'}</span>
              </button>
            </div>

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-20">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 font-semibold mb-1">{language === 'ar' ? "تنبيه الكاميرا والمسح" : "Camera or Scan Notice"}</p>
                <p className="text-[11px] text-slate-400 max-w-xs mb-3">
                  {cameraError}
                </p>
                <span className="text-[11px] text-amber-400 font-bold mb-2">{language === 'ar' ? "أدخل رقم التذكرة (مثال: DR5O4R) أدناه" : "Enter slip code (e.g. DR5O4R) below"}</span>
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? "إعادة تشغيل الكاميرا" : "Retry Camera"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clipboard className="w-3.5 h-3.5 text-amber-400" />
                {language === 'ar' ? 'لصق الرمز أو كتابة رقم التذكرة' : 'Paste QR Text or Enter Slip #'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">e.g. DR5O4R</span>
            </div>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder={language === 'ar' ? 'الصق نص الرمز أو اكتب رقم التذكرة (مثال: DR5O4R)...' : 'Paste ticket QR JSON / Pipe or type slip code (e.g. DR5O4R)...'}
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={!manualText.trim()}
                onClick={handleManualSubmit}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer"
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
