import React, { useMemo } from 'react';
import { QrCode, Printer, CheckCircle, Smartphone, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { Court } from '../lib/sheetsLib';

interface PrintableBarcodesProps {
  courts: Court[];
}

export default function PrintableBarcodes({ courts }: PrintableBarcodesProps) {
  // Determine standard app address for scanning redirection
  const appBaseUrl = useMemo(() => {
    return window.location.href.split('?')[0];
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Informative Jumbotron Bar */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-md">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-emerald-500/20 w-fit px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>Cetak Barcode Lapangan</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">QR Code Cetak untuk Dinding Lapangan</h2>
            <p className="text-emerald-100 text-xs max-w-2xl leading-relaxed">
              Cetak poster kode QR di bawah ini dan tempelkan di sebelah pintu masuk masing-masing lapangan. Penyewa cukup memindai menggunakan kamera handphone untuk otomatis membuka web serta langsung menyewa lapangan tersebut secara real-time!
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="px-5 py-3 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 shrink-0 cursor-pointer"
          >
            <Printer className="w-4.5 h-4.5" />
            Cetak Poster QR Now
          </button>
        </div>
      </div>

      {/* Grid Poster Barcode Layout */}
      <div className="max-w-xl mx-auto">
        {(() => {
          // Dynamic Scan URL incorporating pre-selected Court parameters
          const scanUrl = `${appBaseUrl}?scanned=true`;
          const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}`;

          return (
            <div 
              className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-subtle flex flex-col items-center p-8 relative print:border-slate-400 print:shadow-none print:p-6"
              id="poster-qr-unified"
            >
              {/* Branding Strip header for physical display */}
              <div className="text-center w-full mb-6 border-b border-dashed border-slate-100 pb-5">
                <div className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase mb-1">BADMINTON ARENA REGISTERED</div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">FAZADA BADMINTON</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Pindai QR ini untuk Memesan Lapangan Secara Instan</p>
              </div>

              {/* Poster Main Body Visual */}
              <div className="relative w-64 h-64 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-inner p-4 mb-5">
                <img 
                  src={qrCodeApiUrl} 
                  alt="QR Code Fazada Badminton" 
                  className="w-56 h-56 object-contain"
                  referrerPolicy="no-referrer"
                />
                
                {/* Arena Indicator badge bottom-center */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-mono text-[9px] font-extrabold px-3 py-1 rounded-full tracking-wider border-2 border-white shadow-md">
                  FAZADA ARENA
                </div>
              </div>

              {/* Informative Card specifications */}
              <div className="text-center space-y-3 w-full bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">Pesan Lapangan 1 & 2 Fazada</h4>
                  <p className="text-xs text-slate-500 mt-1 px-2 leading-relaxed">
                    Sistem reservasi online mandiri. Pilih lapangan pilihan Anda, isi jadwal bermain, dan lakukan pembayaran langsung lewat smartphone Anda!
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 mt-2 flex flex-col items-center gap-1.5">
                  <div className="text-[10.5px] font-semibold text-slate-400">Tarif Sewa Lapangan</div>
                  <div className="space-y-1 block text-left">
                    <div className="text-xs font-semibold text-slate-700">
                      • Jam 08.00 - 16.00: <span className="font-bold text-emerald-700 font-mono">Rp 30.000 / Jam</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      • Jam 05.00 - 23.00 (Lainnya): <span className="font-bold text-emerald-700 font-mono">Rp 40.000 / Jam</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Renter Scan Tutorial Footer */}
              <div className="mt-6 flex items-center gap-3 text-left w-full bg-emerald-50/60 border border-emerald-100/50 p-3 rounded-xl">
                <Smartphone className="w-8 h-8 text-emerald-600 shrink-0" />
                <div className="text-[10.5px] text-emerald-800 leading-snug">
                  <span className="font-bold block">Cara Meminang Jadwal:</span>
                  Arahkan kamera HP Anda ke barcode di atas, ketuk tautan pendaftaran, pilih lapangan, jam bermain, lalu isi nama Anda!
                </div>
              </div>

              {/* Interactive Tool bar (Screen only, hidden on printing) */}
              <div className="mt-4 flex items-center justify-between w-full text-xs print:hidden">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(scanUrl);
                    alert("Link Booking Lapangan telah disalin ke Clipboard!");
                  }}
                  className="text-slate-500 hover:text-emerald-700 font-bold transition-colors flex items-center gap-1 hover:underline"
                >
                  Salin Tautan Booking
                </button>
                <a
                  href={scanUrl}
                  target="_blank"
                  className="text-emerald-600 hover:text-emerald-800 font-bold transition-all flex items-center gap-1 font-sans"
                >
                  Buka Link Demo Customer
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

            </div>
          );
        })()}
      </div>

      {/* Visual Guideline Hint for Admin */}
      <div className="bg-slate-100 rounded-2xl p-4 flex items-start gap-3.5 text-slate-600 border border-slate-200">
        <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h5 className="font-extrabold text-slate-800 text-[12px]">Tips Pencetakan Poster Barcode:</h5>
          <p className="leading-relaxed">
            Gunakan kertas poster mengkilap berukuran <strong>A4 atau A5</strong> untuk ketahanan maksimal. Pastikan printer memiliki kontras hitam yang cukup tebal agar dapat dipindai oleh semua jenis model handphone dari kejauhan.
          </p>
        </div>
      </div>

    </div>
  );
}
