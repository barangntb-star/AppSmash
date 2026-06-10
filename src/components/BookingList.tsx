import { useState, useMemo } from 'react';
import { Search, Filter, RefreshCw, CheckCircle, Clock, ExternalLink, Calendar, Receipt } from 'lucide-react';
import { Booking } from '../lib/sheetsLib';

interface BookingListProps {
  bookings: Booking[];
  onPayNow: (booking: Booking) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  spreadsheetUrl: string | null;
}

export default function BookingList({
  bookings,
  onPayNow,
  onRefresh,
  isRefreshing,
  spreadsheetUrl
}: BookingListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Lunas' | 'Menunggu Pembayaran'>('Semua');

  // Search and filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = 
        b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customerPhone.includes(searchTerm) ||
        b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.courtName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'Semua' || 
        b.paymentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  // Sort bookings based on date and time (newest created or booking date first)
  const sortedBookings = useMemo(() => {
    // Return newest bookings first
    return [...filteredBookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [filteredBookings]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4">
      
      {/* List Header control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">Daftar Reservasi Lapangan</h3>
          <p className="text-xs text-slate-400 mt-1">Daftar transaksi yang tersimpan secara real-time di Spreadsheet Anda.</p>
        </div>
        
        <div className="flex items-center gap-2.5">
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-slate-150 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Buka Google Sheets
            </a>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
            title="Sinkronisasi spreadsheet sekarang"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inputs layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search Input */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, No. WA, ID Pemesanan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:border-emerald-500 outline-none transition-all font-medium"
          />
        </div>

        {/* Status Filter */}
        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1">
          {(['Semua', 'Lunas', 'Menunggu Pembayaran'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                statusFilter === filter
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {filter === 'Menunggu Pembayaran' ? 'Pending' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings rows results */}
      {sortedBookings.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-150 rounded-2xl bg-slate-50/30">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
          <h4 className="text-sm font-bold text-slate-700">Tidak Ada Reservasi</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {searchTerm || statusFilter !== 'Semua'
              ? 'Tidak ada pesanan pencocokan kunci pencarian atau filter status Anda.'
              : 'Belum ada transaksi penyewaan yang terdaftar di spreadsheet saat ini.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
          {sortedBookings.map((booking) => (
            <div key={booking.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-1 last:pb-1">
              {/* Profile info left block */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {booking.id}
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">{booking.customerName}</span>
                </div>
                
                {/* Court and details block */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 block"></span>
                    {booking.courtName}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {booking.bookingDate} • {booking.startTime} - {booking.endTime}
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    WhatsApp: <span className="font-mono font-semibold text-slate-650">{booking.customerPhone}</span>
                  </div>
                </div>
              </div>

              {/* Pricing, status and pay action right block */}
              <div className="flex items-center justify-between sm:justify-end gap-5">
                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">TOTAL BIAYA</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">Rp {booking.totalPrice.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  {booking.paymentStatus === 'Lunas' ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 border border-emerald-100 rounded-xl">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Lunas
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 border border-amber-100 rounded-xl">
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                        Pending
                      </div>
                      <button
                        type="button"
                        onClick={() => onPayNow(booking)}
                        className="bg-emerald-605 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs shadow-xs hover:shadow-md transition-all active:scale-95"
                      >
                        Bayar VA/QRIS
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
