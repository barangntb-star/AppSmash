import { useEffect, useState, useTransition } from 'react';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from './lib/firebaseLib';
import { 
  findOrCreateSpreadsheet, 
  readCourts, 
  readBookings, 
  readTransactions,
  Court, 
  Booking,
  FinancialTransaction
} from './lib/sheetsLib';
import CourtSchedule from './components/CourtSchedule';
import BookingList from './components/BookingList';
import PaymentModal from './components/PaymentModal';
import QrScannerModal from './components/QrScannerModal';
import PrintableBarcodes from './components/PrintableBarcodes';
import AdminFinancialPortal from './components/AdminFinancialPortal';
import { 
  Database, 
  LogOut, 
  QrCode, 
  Sparkles, 
  Info, 
  AlertCircle, 
  Flame, 
  Instagram, 
  TrendingUp, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string; isDomainError: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Database Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // App core state
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>('CT001');
  const [activeTab, setActiveTab] = useState<'scheduler' | 'barcodes' | 'admin'>('scheduler');
  const [isScanned, setIsScanned] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('scanned') === 'true';
  });

  // Synchronise deep-linking QR barcodes parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const courtIdParam = params.get('courtId');
    const isScannedParam = params.get('scanned') === 'true';
    if (isScannedParam) {
      setIsScanned(true);
      setActiveTab('scheduler');
    }
    if (courtIdParam) {
      setSelectedCourtId(courtIdParam);
      setActiveTab('scheduler');
      // Scroll to scheduler section
      setTimeout(() => {
        const schedBlock = document.getElementById('scheduler-section');
        if (schedBlock) {
          schedBlock.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, []);

  // Modals visibility state
  const [payBooking, setPayBooking] = useState<Booking | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Initialize Auth listeners
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        setNeedsAuth(false);
        setAuthError(null);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // When token is fetched, initialize Google Sheets database
  useEffect(() => {
    if (!token) return;

    const setupDatabaseAndFetchData = async () => {
      setIsDbLoading(true);
      setDbError(null);
      try {
        // Find or create the database in the user's Drive
        const sheetId = await findOrCreateSpreadsheet(token);
        setSpreadsheetId(sheetId);

        // Fetch courts, bookings and transactions in parallel
        const [fetchedCourts, fetchedBookings, fetchedTransactions] = await Promise.all([
          readCourts(token, sheetId),
          readBookings(token, sheetId),
          readTransactions(token, sheetId)
        ]);

        // Capped to at most 2 courts (Lapangan A & B)
        const cappedCourts = fetchedCourts.slice(0, 2);
        setCourts(cappedCourts);
        setBookings(fetchedBookings);
        setTransactions(fetchedTransactions);
        if (cappedCourts.length > 0) {
          setSelectedCourtId(cappedCourts[0].id);
        }
      } catch (err: any) {
        console.error("Database setup error:", err);
        // If error suggests token expired, let user re-auth
        if (err.message && (err.message.includes("401") || err.message.includes("auth"))) {
          setDbError("Sesi Google Anda kedaluwarsa. Silakan keluar dan masuk kembali.");
        } else {
          setDbError(`Gagal sinkronisasi Google Sheets: ${err.message || err}`);
        }
      } finally {
        setIsDbLoading(false);
      }
    };

    setupDatabaseAndFetchData();
  }, [token]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setDbError(null);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const errMsg = err.message || String(err);
      const isDomainError = errMsg.includes("auth/unauthorized-domain") || errMsg.includes("unauthorized-domain");
      setAuthError({
        code: isDomainError ? 'auth/unauthorized-domain' : 'auth/error',
        message: errMsg,
        isDomainError
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      await logout();
      setUser(null);
      setToken(null);
      setSpreadsheetId(null);
      setCourts([]);
      setBookings([]);
      setTransactions([]);
      setNeedsAuth(true);
    }
  };

  const refreshData = async () => {
    if (!token || !spreadsheetId) return;
    setIsDbLoading(true);
    try {
      const [fetchedCourts, fetchedBookings, fetchedTransactions] = await Promise.all([
        readCourts(token, spreadsheetId),
        readBookings(token, spreadsheetId),
        readTransactions(token, spreadsheetId)
      ]);
      // Capped to at most 2 courts (Lapangan A & B)
      setCourts(fetchedCourts.slice(0, 2));
      setBookings(fetchedBookings);
      setTransactions(fetchedTransactions);
    } catch (err: any) {
      console.error("Failed to refresh data:", err);
      alert(`Gagal syncing: ${err.message}`);
    } finally {
      setIsDbLoading(false);
    }
  };

  // Called when a new booking is submitted
  const handleBookingAdded = (newBooking: Booking) => {
    setBookings(prev => [newBooking, ...prev]);
    // Prompt instant payment gateway!
    setPayBooking(newBooking);
  };

  // Called when payment completes successfully
  const handlePaymentCompleted = (bookingId: string) => {
    setBookings(prev => 
      prev.map(b => b.id === bookingId ? { ...b, paymentStatus: 'Lunas' } : b)
    );
  };

  // Called when scanner successfully decodes a court ID
  const handleScannerSuccess = (courtId: string) => {
    setSelectedCourtId(courtId);
    setIsScannerOpen(false);
    
    // Quick auto-scroll to the schedule section for focus
    const schedBlock = document.getElementById('scheduler-section');
    if (schedBlock) {
      schedBlock.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const spreadsheetUrl = spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` 
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 font-sans selection:bg-emerald-200">
      
      {/* 1. Login State Screen */}
      {needsAuth ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden bg-slate-900 text-white">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center opacity-15 mix-blend-overlay"></div>
          
          <div className="w-full max-w-md bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-2xl relative z-10 flex flex-col text-center">
            
            {/* Visual Badminton Badge */}
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-emerald-500/20 shadow-lg">
              <Flame className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">Fazada Badminton</h1>
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mt-1">Portal Sewa Lapangan Online</p>
            
            <p className="text-slate-350 text-xs leading-relaxed mt-4 mb-6">
              Aplikasi ini terhubung langsung dengan Google Drive Anda. Jadwal lapangan, ketersediaan, dan data reservasi disimpan dengan aman dalam Spreadsheet personal yang bisa Anda akses kapan saja.
            </p>

            {/* Google Sign in Button */}
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button w-full flex items-center justify-center p-3.5 bg-white text-slate-900 rounded-xl hover:bg-slate-100 transition-all font-bold text-sm shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              <div className="gsi-material-button-content-wrapper flex items-center justify-center gap-3">
                <div className="gsi-material-button-icon w-5 h-5 flex items-center justify-center">
                  <svg version="1.1" xmlns="http://www.w3.org/2050/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span className="text-slate-800 text-xs font-semibold">Integrasikan dengan Google Sheets</span>
              </div>
            </button>

            {/* Auth Error Guidance Banner */}
            {authError && (
              <div className="mt-5 p-4 bg-slate-800/80 border border-white/10 rounded-xl text-left text-xs text-slate-200">
                <div className="flex items-start gap-2.5 text-rose-450 font-bold mb-1.5">
                  <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-rose-450" />
                  <span>{authError.isDomainError ? "Firebase Unauthorized Domain" : "Gagal Masuk"}</span>
                </div>
                {authError.isDomainError ? (
                  <div className="space-y-2 mt-1">
                    <p className="text-slate-350 leading-relaxed text-[11px]">
                      Domain aplikasi Anda belum didaftarkan di Authorized Domains konsol Firebase Anda. Silakan ikuti langkah mudah berikut:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-350 text-[10.5px]">
                      <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline font-medium">Konsol Firebase</a></li>
                      <li>Masuk ke menu <strong className="text-white">Build &gt; Authentication &gt; Settings &gt; Authorized Domains</strong></li>
                      <li>Tambahkan domain-domain berikut ini:</li>
                    </ol>
                    <div className="bg-slate-950 border border-white/5 p-2.5 rounded font-mono text-[10px] text-emerald-400 select-all space-y-1 break-all">
                      <div>ais-dev-p5timo3idklox5nvlx6avl-865534130610.asia-southeast1.run.app</div>
                      <div>ais-pre-p5timo3idklox5nvlx6avl-865534130610.asia-southeast1.run.app</div>
                      <div>localhost</div>
                    </div>
                    <p className="text-[10px] text-slate-450 italic mt-1.5 font-medium">Setelah ditambahkan, silakan klik tombol masuk kembali.</p>
                  </div>
                ) : (
                  <p className="text-slate-350 leading-relaxed text-[11px]">{authError.message}</p>
                )}
              </div>
            )}

            {/* Security disclaimer */}
            <div className="flex items-center gap-1.5 justify-center mt-6 text-[10px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Aman privat. Menggunakan Google OAuth resmi.</span>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Main Authenticated Application Area */
        <div className="pb-16">
          
          {/* Header & Navbar */}
          <header className="sticky top-0 bg-white border-b border-slate-100 z-30 shadow-subtle">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
              
              {/* Brand Logo */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
                  F
                </div>
                <div>
                  <h1 className="font-extrabold text-slate-800 text-sm tracking-tight leading-tighter">Fazada Badminton</h1>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block leading-none">Reservasi Portal</span>
                </div>
              </div>

              {/* Action buttons & user profile */}
              <div className="flex items-center gap-4">
                
                {/* Float Barcode Scanner button */}
                {!isScanned && (
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-100 transition-all shadow-xs"
                  >
                    <QrCode className="w-4 h-4" />
                    <span className="hidden sm:inline">Scan QR Lapangan</span>
                  </button>
                )}

                {/* Account card and logout */}
                <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
                  {isScanned ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-700">
                      Mode Penyewa Aktif
                    </div>
                  ) : (
                    <>
                      {user?.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName} 
                          className="w-8 h-8 rounded-full border border-slate-200 referrerPolicy='no-referrer'" 
                        />
                      ) : (
                        <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs capitalize">
                          {user?.displayName ? user.displayName[0] : 'U'}
                        </div>
                      )}
                      <div className="hidden md:block text-left">
                        <span className="text-xs font-semibold text-slate-700 block leading-none">{user?.displayName}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">{user?.email}</span>
                      </div>
                      
                      <button
                        onClick={handleLogout}
                        className="p-1.5 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                        title="Sign Out"
                      >
                        <LogOut className="w-4.5 h-4.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          </header>

          {/* Tab Navigation Subheader */}
          {!isScanned && (
            <div className="bg-white border-b border-slate-100 sticky top-18 z-20 shadow-xs print:hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-6 h-13 items-center">
                  <button
                    onClick={() => setActiveTab('scheduler')}
                    className={`h-full px-1 text-xs font-bold relative transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'scheduler' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Jadwal & Booking Lapangan
                    {activeTab === 'scheduler' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full animate-fade-in"></div>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('barcodes')}
                    className={`h-full px-1 text-xs font-bold relative transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'barcodes' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    Cetak QR / Barcode Lapangan
                    {activeTab === 'barcodes' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full animate-fade-in"></div>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`h-full px-1 text-xs font-bold relative transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'admin' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Portal Admin Keuangan
                    {activeTab === 'admin' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full animate-fade-in"></div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Core Body Container */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
            
            {/* Database Sync Progress and Info header */}
            {!isScanned && isDbLoading && (
              <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-3.5 font-medium animate-pulse shadow-xs">
                <Database className="w-4.5 h-4.5 text-emerald-600 animate-spin" />
                <span>Sedang menyinkronkan data ketersediaan lapangan real-time dari Google Spreadsheet Anda...</span>
              </div>
            )}

            {dbError && (
              <div className="bg-rose-50 text-rose-800 text-xs px-4 py-3 border border-rose-100 rounded-xl flex items-center gap-3 font-medium">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-semibold">{dbError}</p>
                  <button 
                    onClick={refreshData}
                    className="underline text-rose-750 font-bold hover:text-rose-900 block mt-1"
                  >
                    Coba Hubungkan Ulang Spreadsheet Database
                  </button>
                </div>
              </div>
            )}

            {!isScanned && !isDbLoading && !dbError && spreadsheetUrl && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 text-xs text-slate-600 font-medium leading-relaxed">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-300"></span>
                  <span>Database Aktif: <strong className="text-slate-800">"{DATABASE_FILE_NAME}"</strong> di Google Drive Anda.</span>
                </div>
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-650 hover:text-emerald-805 flex items-center gap-1 hover:underline underline-offset-2 shrink-0 text-emerald-600"
                >
                  Lihat / Edit Langsung Baris Spreadsheet di Browser
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Quick overview of court badges removed per user instruction to clean court info details */}

            {activeTab === 'scheduler' && (
              <>
                {/* Scheduler & Booking Form Section */}
                <section id="scheduler-section" className="scroll-mt-24">
                  <CourtSchedule
                    courts={courts}
                    bookings={bookings}
                    selectedCourtId={selectedCourtId}
                    onCourtChange={setSelectedCourtId}
                    accessToken={token || ""}
                    spreadsheetId={spreadsheetId || ""}
                    onBookingAdded={handleBookingAdded}
                  />
                </section>

                {/* Ledger list section */}
                <section className="scroll-mt-24">
                  <BookingList
                    bookings={bookings}
                    onPayNow={setPayBooking}
                    onRefresh={refreshData}
                    isRefreshing={isDbLoading}
                    spreadsheetUrl={spreadsheetUrl}
                  />
                </section>
              </>
            )}

            {activeTab === 'barcodes' && (
              <section className="animate-fade-in">
                <PrintableBarcodes courts={courts} />
              </section>
            )}

            {activeTab === 'admin' && (
              <section className="animate-fade-in">
                <AdminFinancialPortal
                  bookings={bookings}
                  transactions={transactions}
                  accessToken={token || ""}
                  spreadsheetId={spreadsheetId || ""}
                  onTransactionAdded={(newTx) => setTransactions(prev => [newTx, ...prev])}
                  onRefreshAll={refreshData}
                />
              </section>
            )}

          </main>
          
          {/* Footer information */}
          <footer className="max-w-7xl mx-auto px-4 text-center mt-12 text-[11px] text-slate-400 leading-normal">
            <p className="font-medium">Fazada Badminton Booking Engine • Dikembangkan secara terintegrasi dengan Google Workspace Sheets.</p>
            <p className="mt-1">Hak Cipta © {new Date().getFullYear()}. Semua Hak Dilindungi.</p>
          </footer>

        </div>
      )}

      {/* 3. Global Scanner and Payment Modals */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScannerSuccess}
        courts={courts}
      />

      <PaymentModal
        isOpen={!!payBooking}
        onClose={() => setPayBooking(null)}
        booking={payBooking}
        accessToken={token || ""}
        spreadsheetId={spreadsheetId || ""}
        onPaymentCompleted={handlePaymentCompleted}
      />

    </div>
  );
}

const DATABASE_FILE_NAME = "Database Penyewaan Lapangan Bulu Tangkis";
