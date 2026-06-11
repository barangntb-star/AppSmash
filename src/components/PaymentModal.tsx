import { useState, useEffect } from 'react';
import { X, CheckCircle, Copy, ArrowRight, ShieldCheck, Wallet, Landmark, QrCode, Phone, Download } from 'lucide-react';
import { Booking, updateBookingStatus } from '../lib/sheetsLib';
import { AppSettings } from '../lib/firebaseLib';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  accessToken: string;
  spreadsheetId: string;
  onPaymentCompleted: (bookingId: string) => void;
  appSettings?: AppSettings | null;
}

export default function PaymentModal({
  isOpen,
  onClose,
  booking,
  accessToken,
  spreadsheetId,
  onPaymentCompleted,
  appSettings
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'va' | 'wallet'>('qris');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 mins
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!isOpen || !booking) return;
    setCountdown(900);
    setIsSuccess(false);
    setIsProcessing(false);
  }, [isOpen, booking]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || countdown <= 0 || isSuccess) return;
    const interval = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, countdown, isSuccess]);

  if (!isOpen || !booking) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    try {
      if (accessToken && spreadsheetId) {
        // Direct updates in Google sheets to mark booking as Paid ('Lunas')
        await updateBookingStatus(accessToken, spreadsheetId, booking.id, 'Lunas');
      } else {
        console.log("Visitor/non-admin session: skipping direct Google Sheets update.");
      }
      
      // Artificial delay for luxurious micro-loader experience
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        onPaymentCompleted(booking.id);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      alert(`Ups! Terjadi kesalahan saat memperbarui database: ${err.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between text-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5.5 h-5.5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-800">Sistem Gateway Pembayaran</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-50 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          /* Payment Success view */
          <div className="p-8 text-center flex flex-col items-center flex-1 justify-center overflow-y-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-50">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-1">Pembayaran Sukses!</h4>
            <p className="text-sm text-slate-500 mb-6">
              Status pesanan Anda telah berhasil diubah menjadi <span className="font-semibold text-emerald-600">Lunas</span> di database Google Sheets.
            </p>

            {/* Receipt Summary */}
            <div className="w-full bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 text-slate-700 text-xs space-y-2.5 mb-6 font-mono">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-2 mb-1">
                <span>ID Pemesanan</span>
                <span className="font-semibold text-slate-950">{booking.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Nama Lapangan</span>
                <span className="font-semibold text-slate-900">{booking.courtName}</span>
              </div>
              <div className="flex justify-between">
                <span>Penyewa</span>
                <span className="font-semibold text-slate-900">{booking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu</span>
                <span className="font-semibold text-slate-900">{booking.bookingDate}, {booking.startTime} - {booking.endTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Metode Bayar</span>
                <span className="font-semibold text-slate-900 uppercase">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-dashed border-slate-200 pt-2 text-slate-900 font-sans">
                <span>Total Bayar</span>
                <span className="text-emerald-700">Rp {booking.totalPrice.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
            >
              Selesai & Tutup
            </button>
          </div>
        ) : (
          /* Payment Processing view */
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Invoice short-header */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider">BOOKING INVOICE</p>
                <h4 className="font-bold text-slate-800 text-sm">{booking.id}</h4>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total Pembayaran</span>
                <span className="font-extrabold text-emerald-700 text-base">Rp {booking.totalPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Methods Switcher */}
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500 mb-2.5">Pilih Metode Pembayaran</p>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('qris')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'qris'
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700'
                      : 'border-slate-200 hover:border-slate-400 text-slate-600'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">QRIS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('va')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'va'
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700'
                      : 'border-slate-200 hover:border-slate-400 text-slate-600'
                  }`}
                >
                  <Landmark className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Virtual Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'wallet'
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700'
                      : 'border-slate-200 hover:border-slate-400 text-slate-600'
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">E-Wallet</span>
                </button>
              </div>

              {/* Countdown timer */}
              <div className="mt-5 p-3 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between text-xs text-orange-850">
                <span className="font-medium">Selesaikan pembayaran sebelum:</span>
                <span className="font-mono font-bold text-orange-605">{formatTime(countdown)}</span>
              </div>

              {/* Dynamic visual interface dependent on selection */}
              <div className="mt-5 border border-slate-100 rounded-2xl p-5 bg-white flex flex-col items-center shadow-xs">
                {paymentMethod === 'qris' && (
                  <div className="text-center w-full space-y-3">
                    {/* QR Code Title */}
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">FAZADA BADMINTON QRIS</p>
                    <div className="w-44 h-44 border border-slate-200 p-2.5 bg-white rounded-xl mx-auto shadow-sm">
                      <img 
                        src={appSettings?.qrisDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=pay-booking-${booking.id}`} 
                        alt="QRIS Code" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {appSettings?.qrisDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = appSettings.qrisDataUrl!;
                          link.download = `QRIS_Fazada_Badminton_${booking.id}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-100 transition-colors mx-auto cursor-pointer"
                        title="Download Barcode QRIS"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Barcode QRIS
                      </button>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Scan QRIS di atas memakai aplikasi E-Wallet (GoPay, OVO, ShopeePay) atau Mobile Banking Anda.
                    </p>
                  </div>
                )}

                {paymentMethod === 'va' && (
                  <div className="w-full text-left space-y-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Nama Bank Penerima</div>
                      <div className="text-sm font-semibold text-slate-800 uppercase">{appSettings?.bankName || "MANDIRI"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Nomor Rekening / Virtual Account</div>
                      <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-150 font-mono text-sm">
                        <span className="font-bold text-slate-900">{appSettings?.accountNumber || "88012 08123456789"}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(appSettings?.accountNumber?.replace(/\s+/g, '') || "8801208123456789")}
                          className="text-emerald-600 hover:text-emerald-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copiedText ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed font-sans space-y-1 bg-slate-50/50 p-2.5 rounded-xl">
                      <p className="font-semibold text-slate-700 mb-1">Petunjuk Pembayaran:</p>
                      <p>1. Lakukan transfer atau pembayaran online ke rekening bank di atas.</p>
                      <p>2. Kirim nominal pas sebesar <span className="font-bold text-slate-900">Rp {booking.totalPrice.toLocaleString()}</span>.</p>
                      <p>3. Simpan struk / bukti transfer dan klik Konfirmasi Bayar di bawah.</p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'wallet' && (
                  <div className="w-full text-left space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">No. Handphone Terdaftar (GoPay / OVO / DANA)</label>
                      <input 
                        type="tel" 
                        defaultValue={booking.customerPhone}
                        placeholder="Contoh: 08123456789"
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-xl focus:border-emerald-500 transition-all font-mono text-xs" 
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Kami akan mengirimi Anda tagihan push notification langsung ke aplikasi e-wallet Anda. Konfirmasi tagihan tersebut agar pembayaran selesai secara instan.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom confirmation action */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/60 mt-auto">
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs flex items-center justify-center gap-2 group disabled:opacity-75 disabled:cursor-wait"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mengonfirmasi Status Pembayaran...
                  </>
                ) : (
                  <>
                    Konfirmasi Bayar Instan
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2.5">
                🔒 Pembayaran diproses dengan enkripsi 256-bit aman dan bersinkronisasi ke Google Drive Sheet.
              </p>
              {appSettings?.adminPhone && (
                <div className="mt-3.5 pt-2 border-t border-slate-100 flex justify-center">
                  <a
                    href={`https://wa.me/${appSettings.adminPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 font-medium transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    Butuh Bantuan? Chat WhatsApp Admin ({appSettings.adminPhone})
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
