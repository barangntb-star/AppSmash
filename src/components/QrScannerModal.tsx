import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Sparkles, Laptop } from 'lucide-react';
import { Court } from '../lib/sheetsLib';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (courtId: string) => void;
  courts: Court[];
}

export default function QrScannerModal({ isOpen, onClose, onScanSuccess, courts }: QrScannerModalProps) {
  const [scanMethod, setScanMethod] = useState<'camera' | 'simulation'>('camera');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || scanMethod !== 'camera') return;

    let scanner: Html5QrcodeScanner | null = null;
    
    // Slight timeout to let DOM element render
    const timer = setTimeout(() => {
      try {
        scanner = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            console.log("QR Code scanned:", decodedText);
            // Expected QR formats: "court-id:CT001" or raw "CT001" or url containing "?courtId=CT001"
            let courtId = "";
            if (decodedText.startsWith("court-id:")) {
              courtId = decodedText.split(":")[1];
            } else if (decodedText.includes("courtId=")) {
              const urlParams = new URLSearchParams(decodedText.split("?")[1]);
              courtId = urlParams.get("courtId") || "";
            } else {
              // Direct ID like "CT001"
              courtId = decodedText.trim();
            }

            // Verify if scanned ID is a valid court ID
            const match = courts.find(c => c.id.toLowerCase() === courtId.toLowerCase());
            if (match) {
              if (scanner) {
                scanner.clear().then(() => {
                  onScanSuccess(match.id);
                }).catch(err => {
                  console.error("Scanner clear error:", err);
                  onScanSuccess(match.id);
                });
              } else {
                onScanSuccess(match.id);
              }
            } else {
              setErrorMsg(`QR Code tidak dikenali ("${decodedText}"). Pastikan Anda menscan QR Code Lapangan yang tertera.`);
            }
          },
          (err) => {
            // Quiet fail during scans to avoid flooding
          }
        );
      } catch (err: any) {
        console.error("Error initializing camera scanner:", err);
        setErrorMsg("Gagal mengakses kamera. Pastikan Anda mengijinkan hak akses kamera di iFrame.");
        setScanMethod('simulation');
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(e => console.log("Failed to clear scanner on unmount:", e));
      }
    };
  }, [isOpen, scanMethod, courts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 animate-pulse" />
            <h3 className="font-semibold text-lg text-white">Scan Barcode / QR Lapangan</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Method Switcher */}
        <div className="flex bg-slate-100 p-1 m-4 rounded-xl">
          <button
            onClick={() => {
              setScanMethod('camera');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              scanMethod === 'camera'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Gunakan Kamera
          </button>
          <button
            onClick={() => {
              setScanMethod('simulation');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              scanMethod === 'simulation'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Simulasi Scan
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 pb-5 flex-1 overflow-y-auto flex flex-col items-center">
          
          {errorMsg && (
            <div className="w-full bg-rose-50 text-rose-700 text-xs px-3 py-2.5 rounded-xl border border-rose-100 mb-4 font-medium">
              {errorMsg}
            </div>
          )}

          {scanMethod === 'camera' ? (
            <div className="text-center w-full">
              <p className="text-xs text-slate-500 mb-4">
                Arahkan kamera ke QR Code Lapangan Bulu Tangkis untuk membuka jadwal secara otomatis.
              </p>
              
              <div className="relative w-full max-w-[280px] mx-auto aspect-square bg-slate-900 rounded-xl overflow-hidden shadow-inner border-2 border-dashed border-emerald-500 flex items-center justify-center">
                <div id="qr-reader" className="w-full h-full [&_video]:object-cover" />
                
                {/* Visual scanner guides */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-md"></div>
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-md"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-md"></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-md"></div>
                
                {/* Moving red scan-line */}
                <div className="absolute left-2 right-2 h-[2px] bg-emerald-500/80 animate-[bounce_2s_infinite] shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"></div>
              </div>
            </div>
          ) : (
            <div className="text-center w-full flex flex-col flex-1 justify-center py-4">
              <p className="text-sm text-slate-600 mb-6">
                Pilih lapangan di bawah ini untuk mensimulasikan pemindaian QR Code ketersediaan jadwal secara real-time.
              </p>

              <div className="grid grid-cols-1 gap-2.5 w-full">
                {courts.map((court) => (
                  <button
                    key={court.id}
                    onClick={() => onScanSuccess(court.id)}
                    className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700">
                        {court.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{court.id}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium px-2.5 py-1 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      <Sparkles className="w-3.5 h-3.5" />
                      Scan
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Guide information */}
          <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 w-full">
            <span className="font-semibold text-slate-700 block mb-1">💡 Cara Scan:</span>
            Pilih opsi "Cetak QR" pada detail lapangan di beranda, cetak / tampilkan QR di device lain, lalu arahkan kamera Anda di sini. Diperlukan iFrame permissions yang aktif.
          </div>
        </div>

      </div>
    </div>
  );
}
