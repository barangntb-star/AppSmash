import React, { useState, useMemo, FormEvent } from 'react';
import { Calendar as CalendarIcon, Clock, User, Phone, Check, CreditCard, AlertCircle, QrCode, X } from 'lucide-react';
import { Court, Booking, addBooking } from '../lib/sheetsLib';

interface CourtScheduleProps {
  courts: Court[];
  bookings: Booking[];
  selectedCourtId: string;
  onCourtChange: (id: string) => void;
  accessToken: string;
  spreadsheetId: string;
  onBookingAdded: (newBooking: Booking) => void;
}

// Dynamic pricing calculation helper
export const getPriceForHourNum = (hour: number): number => {
  // Rp. 30.000 / jam untuk jam 08.00 - 16.00 (hour starting from 8 up to 15)
  if (hour >= 8 && hour < 16) {
    return 30000;
  }
  // Rp. 40.000 / jam untuk jam 05.00 - 23.00 (outside 08.00 - 16.00)
  return 40000;
};

export const calculateDurationPrice = (startHourVal: number, duration: number): number => {
  let total = 0;
  for (let d = 0; d < duration; d++) {
    total += getPriceForHourNum(startHourVal + d);
  }
  return total;
};

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const startNum = i + 5; // 05:00 to 23:00
  const endNum = startNum + 1;
  const formatNum = (n: number) => String(n).padStart(2, '0') + ':00';
  return {
    start: formatNum(startNum),
    end: formatNum(endNum),
    startVal: startNum,
    endVal: endNum,
  };
});

export default function CourtSchedule({
  courts,
  bookings,
  selectedCourtId,
  onCourtChange,
  accessToken,
  spreadsheetId,
  onBookingAdded
}: CourtScheduleProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // State for Booking Drawer/Form
  const [bookingSlot, setBookingSlot] = useState<{ start: string; end: string; startVal: number } | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [durationHours, setDurationHours] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showCourtQr, setShowCourtQr] = useState(false);

  const activeCourt = useMemo(() => {
    return courts.find(c => c.id === selectedCourtId) || courts[0];
  }, [courts, selectedCourtId]);

  // Read bookings specifically for selected court and date
  const activeBookings = useMemo(() => {
    return bookings.filter(b => b.courtId === selectedCourtId && b.bookingDate === selectedDate);
  }, [bookings, selectedCourtId, selectedDate]);

  // Determine slot occupancy status
  const hourlySlotsWithStatus = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const currentHour = today.getHours();

    return HOURS.map(slot => {
      // Check if this slot overlaps with any active booking
      // A booking overlaps if: booking.startTime < slot.end AND booking.endTime > slot.start
      const occupier = activeBookings.find(b => {
        // Simple string time comparison e.g., "09:00" < "10:00"
        return b.startTime < slot.end && b.endTime > slot.start;
      });

      const isPast = (selectedDate < todayStr) || (selectedDate === todayStr && slot.startVal <= currentHour);

      return {
        ...slot,
        isOccupied: !!occupier,
        isPast,
        occupierName: occupier ? occupier.customerName : null,
        paymentStatus: occupier ? occupier.paymentStatus : null,
      };
    });
  }, [activeBookings, selectedDate]);

  // Calculate booking end options based on starting slot and limits
  const endOptions = useMemo(() => {
    if (!bookingSlot) return [];
    const options = [];
    const maxDuration = 3; // Max 3 hours booking limit
    
    for (let d = 1; d <= maxDuration; d++) {
      const endVal = bookingSlot.startVal + d;
      if (endVal > 22) break; // Maximum 22:00 close hour
      
      const timeStr = String(endVal).padStart(2, '0') + ':00';
      // Check if this duration would overlap an existing booking
      const overlaps = activeBookings.some(b => {
        return b.startTime < timeStr && b.endTime > bookingSlot.start;
      });
      
      if (overlaps && d > 1) {
        // If 2+ hours overlaps, stop proposing higher durations
        break;
      }
      options.push({ hours: d, label: `${d} Jam (s.d ${timeStr})` });
    }
    return options;
  }, [bookingSlot, activeBookings]);

  // Handle slot selection click
  const handleSlotClick = (slot: typeof HOURS[0] & { isPast?: boolean }, isOccupied: boolean) => {
    if (isOccupied || slot.isPast) return;
    setBookingSlot(slot);
    setDurationHours(1);
    setCustName('');
    setCustPhone('');
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSlot || !activeCourt) return;
    if (!custName.trim() || !custPhone.trim()) {
      alert("Harap lengkapi nama dan nomor WhatsApp Anda.");
      return;
    }

    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const currentHour = today.getHours();
    
    if (selectedDate < todayStr || (selectedDate === todayStr && bookingSlot.startVal <= currentHour)) {
      alert("Maaf, pemesanan sewa tidak dapat dilakukan untuk waktu yang telah lewat.");
      return;
    }

    setIsLoading(true);
    try {
      const startHour = bookingSlot.start;
      const endHourVal = bookingSlot.startVal + durationHours;
      const endHourStr = String(endHourVal).padStart(2, '0') + ':00';
      
      // Calculate Total Pricing dynamically
      const totalPrice = calculateDurationPrice(bookingSlot.startVal, durationHours);

      // Generate a unique Booking ID
      const bookingId = "BK" + Math.floor(100000 + Math.random() * 900000);

      const newBooking: Booking = {
        id: bookingId,
        courtId: activeCourt.id,
        courtName: activeCourt.name,
        customerName: custName.trim(),
        customerPhone: custPhone.trim(),
        bookingDate: selectedDate,
        startTime: startHour,
        endTime: endHourStr,
        totalPrice: totalPrice,
        paymentMethod: "QRIS", // Default method
        paymentStatus: "Menunggu Pembayaran",
        createdAt: new Date().toISOString(),
      };

      // Append record in Google Spreadsheet via Sheets API
      await addBooking(accessToken, spreadsheetId, newBooking);

      onBookingAdded(newBooking);
      setBookingSlot(null); // Clear form
    } catch (err: any) {
      console.error(err);
      alert(`Gagal membuat booking ke Google Sheets: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Google Charts/QRServer QR code for the specific court selection
  const courtQrUrl = useMemo(() => {
    // Standard payload structure indicating selecting this court ID
    const qrData = `court-id:${selectedCourtId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
  }, [selectedCourtId]);

  if (courts.length === 0 || !activeCourt) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-xs flex flex-col items-center justify-center text-center w-full">
        <AlertCircle className="w-8 h-8 text-slate-400 animate-pulse mb-3" />
        <h4 className="text-sm font-semibold text-slate-700">Menyiapkan Jadwal Lapangan...</h4>
        <p className="text-xs text-slate-400 mt-1">Sistem sedang mendownload data sinkronisasi dari Google Sheets.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left panel: Court Switcher, Date picker, & print QR option */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-5 h-fit">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pilih Lapangan</label>
          <div className="space-y-2">
            {courts.map((court) => (
              <button
                key={court.id}
                onClick={() => onCourtChange(court.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  selectedCourtId === court.id
                    ? 'border-emerald-600 bg-emerald-50/30 text-emerald-950 font-semibold shadow-xs'
                    : 'border-slate-150 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-sm">{court.name}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 space-y-0.5">
                    <span className="block font-bold text-emerald-700">Rp 30.000 <span className="text-[10px] text-slate-400 font-normal">/ jam (08:00 - 16:00)</span></span>
                    <span className="block font-bold text-emerald-700">Rp 40.000 <span className="text-[10px] text-slate-400 font-normal">/ jam (Lega / Sore / Malam)</span></span>
                  </div>
                </div>
                {selectedCourtId === court.id && (
                  <span className="bg-emerald-600 text-white p-1 rounded-full text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Date Selection */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tanggal Bermain</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3.5 top-3 w-4 h-4 text-emerald-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Court QR Code Display */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => setShowCourtQr(!showCourtQr)}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            {showCourtQr ? "Sembunyikan Barcode/QR" : "Tampilkan Barcode/QR Lapangan"}
          </button>

          {showCourtQr && (
            <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 animate-fadeIn text-center">
              <p className="text-[11px] font-semibold text-slate-600 mb-2">QR Code {activeCourt.name}</p>
              <div className="bg-white p-1.5 w-32 h-32 rounded-lg mx-auto shadow-xs border border-slate-150">
                <img 
                  src={courtQrUrl} 
                  alt="Court QR Code" 
                  className="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-2.5 px-1 leading-relaxed">
                Arahkan panel pemindai webcam dari device lain ke kode QR di atas untuk membuka jadwal lapangan ini secara langsung.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Center panel: Real-time Schedule Grid */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-secondary-50">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{activeCourt.id} SCHEDULE</span>
            <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{activeCourt.name}</h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-405 block">Ketersediaan Slot</span>
            <span className="text-xs font-semibold text-emerald-700 font-mono">
              {hourlySlotsWithStatus.filter(s => !s.isOccupied).length} / {hourlySlotsWithStatus.length} Jam Longgar
            </span>
          </div>
        </div>

        {/* Timetable schedule grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 flex-1 max-h-[500px] overflow-y-auto pr-1">
          {hourlySlotsWithStatus.map((slot) => {
            const isDisabled = slot.isOccupied || slot.isPast;
            const bgClass = slot.isOccupied
              ? 'bg-rose-50/70 border-rose-100/80 text-rose-900 cursor-not-allowed'
              : slot.isPast
                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/20 shadow-xs cursor-pointer';

            return (
              <button
                key={slot.start}
                disabled={isDisabled}
                onClick={() => handleSlotClick(slot, slot.isOccupied)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${bgClass}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    slot.isOccupied
                      ? 'bg-rose-100 text-rose-700'
                      : slot.isPast
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono text-slate-900">
                      {slot.start} - {slot.end}
                      <span className="ml-1.5 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-100">
                        Rp {getPriceForHourNum(slot.startVal).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {slot.isOccupied
                        ? `Dipesan o/ ${slot.occupierName}`
                        : slot.isPast
                          ? 'Selesai / Waktu Lewat'
                          : 'Klik untuk Booking'}
                    </div>
                  </div>
                </div>

                <div>
                  {slot.isOccupied ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      slot.paymentStatus === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {slot.paymentStatus === 'Lunas' ? 'Lunas' : 'Belum Bayar'}
                    </span>
                  ) : slot.isPast ? (
                    <span className="text-[10px] font-semibold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-md">
                      Lewat
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      Tersedia
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Legend */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex gap-4 text-[11px] text-slate-505 font-medium justify-center lg:justify-start">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-300"></span>
            Tersedia
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-300"></span>
            Dipesan
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-200"></span>
            Selesai / Lewat
          </div>
        </div>
      </div>

      {/* Online Booking Dialog (Renders beneath if slot selected) */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col">
            
            {/* Form Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
              <div>
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-widest">FORMULIR PESANAN</span>
                <h4 className="font-bold text-white text-base mt-0.5">{activeCourt.name}</h4>
              </div>
              <button 
                type="button"
                onClick={() => setBookingSlot(null)}
                className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleBookSubmit} className="p-5 space-y-4">
              
              {/* Timing detail summary box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-slate-700 text-xs flex justify-between tracking-wide">
                <div>
                  <span className="text-slate-400 block mb-0.5">TANGGAL</span>
                  <span className="font-bold font-mono">{selectedDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block mb-0.5">WAKTU</span>
                  <span className="font-bold font-mono">{bookingSlot.start} s.d {String(bookingSlot.startVal + durationHours).padStart(2, '0')}:00</span>
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Nama Lengkap Penyewa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Syihabuddin"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl focus:border-emerald-500 text-slate-800 text-xs transition-all font-medium"
                />
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  Nomor WhatsApp (WhatsApp Aktif)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081234567890"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl focus:border-emerald-500 text-slate-800 text-xs transition-all font-mono"
                />
              </div>

              {/* Duration selection dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Durasi Sewa Lapangan
                </label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl focus:border-emerald-500 text-slate-800 text-xs transition-all font-medium"
                >
                  {endOptions.map((opt) => (
                    <option key={opt.hours} value={opt.hours}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Real-time pricing overview */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 flex items-center justify-between mt-6">
                <div>
                  <span className="text-emerald-800 text-xs font-semibold block">Total Biaya Sewa</span>
                  <span className="text-[11px] text-emerald-600 font-mono">Berdasarkan tarif jam sewa terpilih ({durationHours} Jam)</span>
                </div>
                <div className="text-right font-extrabold text-emerald-700 text-lg">
                  Rp {calculateDurationPrice(bookingSlot.startVal, durationHours).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Action actions */}
              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setBookingSlot(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-colors"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-emerald-605 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Kirim Pesanan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
