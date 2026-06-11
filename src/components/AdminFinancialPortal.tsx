import React, { useState, useMemo, FormEvent } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  Briefcase, 
  Download, 
  BadgeCheck, 
  Loader2 
} from 'lucide-react';
import { Booking, FinancialTransaction } from '../lib/sheetsLib';

interface AdminFinancialPortalProps {
  bookings: Booking[];
  transactions: FinancialTransaction[];
  accessToken?: string | null;
  spreadsheetId?: string | null;
  onTransactionAdded: (newTx: FinancialTransaction) => void | Promise<void>;
  onRefreshAll: () => Promise<void>;
}

export default function AdminFinancialPortal({
  bookings,
  transactions,
  accessToken,
  spreadsheetId,
  onTransactionAdded,
  onRefreshAll
}: AdminFinancialPortalProps) {
  // Local state for ledger search & filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Semua' | 'Masuk' | 'Keluar'>('Semua');
  const [categoryFilter, setCategoryFilter] = useState('Semua');

  // Local state for manual transaction form submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState<'Masuk' | 'Keluar'>('Keluar');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Shuttlecock');
  const [txDescription, setTxDescription] = useState('');

  // 1. Compile the Unified Cash Ledger list combining actual bookings + manual logs
  const unifiedLedger = useMemo(() => {
    // A. Parse Paid Bookings as automatic "Uang Masuk"
    const bookingLogs = bookings
      .filter(b => b.paymentStatus === 'Lunas')
      .map(b => ({
        id: b.id,
        date: b.bookingDate,
        type: 'Masuk' as const,
        amount: b.totalPrice,
        category: 'Sewa Lapangan',
        description: `Sewa ${b.courtName} o/ ${b.customerName} (${b.startTime}-${b.endTime})`,
        createdAt: b.createdAt
      }));

    // B. Map custom manual cash logs
    const customLogs = transactions.map(t => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      createdAt: t.createdAt
    }));

    // Combine and sort by date descending, then by createdAt descending
    const merged = [...bookingLogs, ...customLogs];
    merged.sort((a, b) => {
      // Primary sort: Date
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      // Secondary sort: Created timestamp
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return merged;
  }, [bookings, transactions]);

  // 2. Compute Financial aggregations
  const financialTotals = useMemo(() => {
    let bookingIncome = bookings
      .filter(b => b.paymentStatus === 'Lunas')
      .reduce((sum, b) => sum + b.totalPrice, 0);

    let manualInflow = transactions
      .filter(t => t.type === 'Masuk')
      .reduce((sum, t) => sum + t.amount, 0);

    let manualOutflow = transactions
      .filter(t => t.type === 'Keluar')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = bookingIncome + manualInflow;
    const totalExpense = manualOutflow;
    const netProfit = totalIncome - totalExpense;

    return {
      bookingIncome,
      manualInflow,
      totalIncome,
      totalExpense,
      netProfit
    };
  }, [bookings, transactions]);

  // Filter Categories uniquely based on items in merged ledger
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    unifiedLedger.forEach(item => categories.add(item.category));
    return Array.from(categories);
  }, [unifiedLedger]);

  // Filtered rows for displaying in Table ledger
  const filteredLedger = useMemo(() => {
    return unifiedLedger.filter(item => {
      const matchesSearch = 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'Semua' || item.type === typeFilter;
      const matchesCategory = categoryFilter === 'Semua' || item.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [unifiedLedger, searchTerm, typeFilter, categoryFilter]);

  // Handle Form Submission of manual transactions
  const handleSubmitTx = async (e: FormEvent) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) {
      alert("Silakan masukkan nilai jumlah uang yang valid!");
      return;
    }
    if (!txDescription.trim()) {
      alert("Silakan tuliskan deskripsi atau keterangan transaksi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newTxId = 'TX' + Math.floor(1000 + Math.random() * 9000);
      const newTx: FinancialTransaction = {
        id: newTxId,
        date: txDate,
        type: txType,
        amount: Number(txAmount),
        category: txCategory,
        description: txDescription.trim(),
        createdAt: new Date().toISOString()
      };

      await onTransactionAdded(newTx);
      
      // Reset input fields
      setTxAmount('');
      setTxDescription('');
      alert(`Transaksi ${txType === 'Masuk' ? 'Pemasukan' : 'Pengeluaran'} berhasil dicatat di sistem!`);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal mencatat transaksi: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper code for custom transaction presets
  const categoriesPresets = [
    "Shuttlecock",
    "Kantin",
    "Kebersihan",
    "Listrik",
    "Air / PAM",
    "Perbaikan Fasilitas",
    "Peralatan & Net",
    "Keamanan",
    "Lain-lain"
  ];

  const formatIDR = (val: number) => {
    return 'Rp ' + val.toLocaleString('id-ID');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Metrics Card Ribbons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Rent Income (Sewa Lapangan) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Omset Sewa Lap.</span>
            <strong className="text-lg font-black text-slate-800 font-mono block mt-0.5">
              {formatIDR(financialTotals.bookingIncome)}
            </strong>
            <span className="text-[10px] text-emerald-600 font-semibold block">Dari booking Lunas</span>
          </div>
        </div>

        {/* Total General Inflows (Total Pemasukan) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Total Pemasukan</span>
            <strong className="text-lg font-black text-slate-800 font-mono block mt-0.5">
              {formatIDR(financialTotals.totalIncome)}
            </strong>
            <span className="text-[10px] text-slate-500 font-medium block">Sewa + pemasukan toko</span>
          </div>
        </div>

        {/* Total General Outflows (Total Pengeluaran) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Total Pengeluaran</span>
            <strong className="text-lg font-black text-rose-700 font-mono block mt-0.5">
              {formatIDR(financialTotals.totalExpense)}
            </strong>
            <span className="text-[10px] text-slate-500 font-medium block">Operasional & Pembelian</span>
          </div>
        </div>

        {/* Net Profit Balance (Slado Bersih) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl border border-slate-800 text-white shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Sisa Saldo Kas</span>
            <strong className={`text-lg font-black font-mono block mt-0.5 ${financialTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatIDR(financialTotals.netProfit)}
            </strong>
            <span className="text-[10px] text-slate-350 font-medium block">Inflow dikurangi pengeluaran</span>
          </div>
        </div>

      </div>

      {/* 2. Visual Balance Comparison Progress Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span>Rasio Keuangan (Pemasukan vs Pengeluaran)</span>
          <span className="font-mono text-emerald-700">Net: {formatIDR(financialTotals.netProfit)}</span>
        </div>
        {/* Dynamic Proportion Calculator */}
        {(() => {
          const total = financialTotals.totalIncome + financialTotals.totalExpense;
          const incomePct = total > 0 ? (financialTotals.totalIncome / total) * 100 : 100;
          const expensePct = total > 0 ? (financialTotals.totalExpense / total) * 100 : 0;
          return (
            <div className="space-y-1.5Packed">
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${incomePct}%` }} 
                  className="bg-emerald-500 h-full" 
                  title={`Pemasukan: ${incomePct.toFixed(1)}%`}
                ></div>
                <div 
                  style={{ width: `${expensePct}%` }} 
                  className="bg-rose-500 h-full" 
                  title={`Pengeluaran: ${expensePct.toFixed(1)}%`}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Pemasukan ({incomePct.toFixed(1)}%)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Pengeluaran ({expensePct.toFixed(1)}%)
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 3. Record New Manual Transaction Panel-Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-slate-800 text-sm">Catat Mutasi Keuangan Baru</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4 font-normal">
              Gunakan formulir ini untuk menambahkan transaksi di luar rental lapangan, seperti sisa token listrik, pengeluaran kok lapangan, atau omset minuman kantin.
            </p>

            <form onSubmit={handleSubmitTx} className="space-y-4">
              
              {/* Type toggle switch (Pemasukan / Pengeluaran) */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">Tipe Mutasi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTxType('Masuk'); setTxCategory('Kantin'); }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center ${
                      txType === 'Masuk'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-extrabold'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Uang Masuk (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTxType('Keluar'); setTxCategory('Shuttlecock'); }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center ${
                      txType === 'Keluar'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 font-extrabold'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Uang Keluar (-)
                  </button>
                </div>
              </div>

              {/* Amount Input (Rupiah) */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">Jumlah Uang (Rupiah)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">Rp</span>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="Contoh: 150000"
                    required
                    min="1"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-500 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Date selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">Tanggal Transaksi</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-slate-500 font-medium"
                  />
                </div>
              </div>

              {/* Category selections */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">Kategori</label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-slate-500 font-semibold"
                >
                  {categoriesPresets.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description explanation */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">Deskripsi / Keterangan</label>
                <textarea
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Tuliskan keterangan detail pengeluaran atau pemasukan ini..."
                  required
                  rows={2}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
                ></textarea>
              </div>

              {/* Form trigger action */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-850 active:scale-98 transition-all disabled:opacity-55 disabled:cursor-wait mt-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Merekam di Google Sheets...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-4.5 h-4.5" />
                    Simpan Catatan Mutasi
                  </>
                )}
              </button>

            </form>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between text-[11px] text-slate-400">
            <span>Sinkronisasi Google Sheets</span>
            <span className="text-emerald-600 font-bold">Aktif & Persisten</span>
          </div>
        </div>

        {/* 4. Complete Cash Ledger History Log Table */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-4 flex-1">
            
            {/* Header info bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Alur & Arus Kas Keuangan</h3>
                <p className="text-[11px] text-slate-400 font-medium">Buku kas terpadu (Sewa Lapangan + Lain-Lain)</p>
              </div>
              
              {/* Dynamic spreadsheet sync feedback */}
              <button
                onClick={onRefreshAll}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold font-sans flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
              >
                Refresh Data Kas
              </button>
            </div>

            {/* Filter ledger bar layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* Search filter input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari transaksi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                />
              </div>

              {/* Inflow vs Outflow toggle select */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50/50">
                <Filter className="w-3 h-3 text-slate-400 ml-1 shrinkage" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full border-0 bg-transparent text-[11px] text-slate-600 font-bold focus:ring-0 focus:outline-none"
                >
                  <option value="Semua">Semua Aliran</option>
                  <option value="Masuk">Masuk (+)</option>
                  <option value="Keluar">Keluar (-)</option>
                </select>
              </div>

              {/* Categorization select filter */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50/50">
                <FileText className="w-3 h-3 text-slate-400 ml-1 shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full border-0 bg-transparent text-[11px] text-slate-600 font-bold focus:ring-0 focus:outline-none"
                >
                  <option value="Semua">Semua Kategori</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Ledger List list view with scroll limits */}
            <div className="overflow-y-auto max-h-[360px] pr-1 space-y-2.5">
              {filteredLedger.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                  <Briefcase className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-[12px] font-bold text-slate-500">Tidak ada transaksi ditemukan</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Silakan sesuaikan filter pencarian atau rekam transaksi baru.</p>
                </div>
              ) : (
                filteredLedger.map((row) => (
                  <div 
                    key={row.id}
                    className="p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        row.type === 'Masuk' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-rose-50 text-rose-600'
                      }`}>
                        {row.type === 'Masuk' ? <ArrowUpRight className="w-4.5 h-4.5" /> : <ArrowDownLeft className="w-4.5 h-4.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] bg-slate-100 text-slate-500 font-bold rounded-md px-1.5 py-0.5">
                            {row.id}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            {row.date}
                          </span>
                          <span className={`text-[9.5px] font-bold rounded-full px-2 py-0.5 ${
                            row.category === 'Sewa Lapangan'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.type === 'Masuk'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-bold mt-1 line-clamp-1 leading-normal">
                          {row.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-xs font-black font-mono block ${
                        row.type === 'Masuk' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {row.type === 'Masuk' ? '+' : '-'} {formatIDR(row.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Menampilkan <strong>{filteredLedger.length}</strong> dari total {unifiedLedger.length} baris ledger</span>
            <span className="italic font-mono text-[10px]">Tabel kas ditarik dari Google Sheets</span>
          </div>

        </div>

      </div>

    </div>
  );
}
