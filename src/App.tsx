import { useEffect, useState, useTransition } from 'react';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken,
  getSavedSpreadsheetId,
  saveSpreadsheetId,
  getFirestoreBookings,
  saveFirestoreBooking,
  updateFirestoreBookingStatus,
  getFirestoreTransactions,
  saveFirestoreTransaction,
  updateFirestoreBookingSynced,
  updateFirestoreTransactionSynced,
  auth,
  subscribeFirestoreBookings,
  subscribeFirestoreTransactions,
  getAppSettings,
  AppSettings
} from './lib/firebaseLib';
import { 
  findOrCreateSpreadsheet, 
  addBooking,
  addTransaction,
  Court, 
  Booking,
  FinancialTransaction,
  readBookings,
  updateBookingStatus,
  readTransactions
} from './lib/sheetsLib';
import CourtSchedule from './components/CourtSchedule';
import BookingList from './components/BookingList';
import PaymentModal from './components/PaymentModal';
import QrScannerModal from './components/QrScannerModal';
import PrintableBarcodes from './components/PrintableBarcodes';
import AdminFinancialPortal from './components/AdminFinancialPortal';
import AppSettingsTab from './components/AppSettingsTab';
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
  Clock,
  Settings
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string; isDomainError: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Database Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
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

  const defaultCourts: Court[] = [
    {
      id: "CT001",
      name: "Lapangan 1",
      description: "Lantai karpet vinyl berkualitas premium berstandar nasional, peredam kejut nyaman, pencahayaan LED terang bebas silau.",
      pricePerHour: 30000,
      imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=600"
    },
    {
      id: "CT002",
      name: "Lapangan 2",
      description: "Lantai papan kayu parket tebal standar latihan, nyaman untuk permainan single maupun double dengan sirkulasi udara baik.",
      pricePerHour: 30000,
      imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=600"
    }
  ];

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

  // Background Google Sheets sync runner (prevents duplicates and syncs payments matching Firestore)
  const syncDatabaseDraftsToSheets = async (activeToken: string, activeSheetId: string) => {
    try {
      console.log("Starting background Google Sheets sync...");
      // 1. Fetch live bookings from Firestore (which may contain fresh guest bookings)
      const firestoreBookings = await getFirestoreBookings();
      
      // Load current bookings from Google Sheets to inspect and avoid duplicate rows
      const sheetBookings = await readBookings(activeToken, activeSheetId).catch(() => []);
      const sheetBookingIds = new Set(sheetBookings.map(b => b.id));

      for (const booking of firestoreBookings) {
        try {
          if (!sheetBookingIds.has(booking.id)) {
            // New booking from guest, append it!
            await addBooking(activeToken, activeSheetId, booking);
          } else {
            // Booking already in sheet, verify if paymentStatus needs an update
            const sheetBooking = sheetBookings.find(sb => sb.id === booking.id);
            if (sheetBooking && sheetBooking.paymentStatus !== booking.paymentStatus) {
              await updateBookingStatus(activeToken, activeSheetId, booking.id, booking.paymentStatus);
            }
          }

          if (!booking.synced) {
            await updateFirestoreBookingSynced(booking.id, true);
            // Update local state
            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, synced: true } : b));
          }
        } catch (err) {
          console.error("Gagal sinkronisasi booking ke Google Sheets:", booking.id, err);
        }
      }

      // 2. Fetch live transactions from Firestore
      const firestoreTx = await getFirestoreTransactions();
      const sheetTx = await readTransactions(activeToken, activeSheetId).catch(() => []);
      const sheetTxIds = new Set(sheetTx.map(t => t.id));

      for (const tx of firestoreTx) {
        try {
          if (!sheetTxIds.has(tx.id)) {
            await addTransaction(activeToken, activeSheetId, tx);
          }
          if (!tx.synced) {
            await updateFirestoreTransactionSynced(tx.id, true);
            // Update local state
            setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, synced: true } : t));
          }
        } catch (err) {
          console.error("Gagal sinkronisasi transaksi ke Google Sheets:", tx.id, err);
        }
      }
      console.log("Background synchronization completed successfully!");
    } catch (error) {
      console.error("Error in sheets sync:", error);
    }
  };

  // Initialize Auth listeners (Guest has no needsAuth block)
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        setNeedsAuth(false);
        setAuthError(null);
      },
      () => {
        setNeedsAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Load configurations and listen to bookings in real-time
  useEffect(() => {
    setCourts(defaultCourts);
    setSelectedCourtId(defaultCourts[0].id);

    const loadSpreadsheetConfig = async () => {
      setIsDbLoading(true);
      setDbError(null);
      try {
        const [savedSheetId, savedSettings] = await Promise.all([
          getSavedSpreadsheetId(),
          getAppSettings()
        ]);
        if (savedSheetId) {
          setSpreadsheetId(savedSheetId);
        }
        if (savedSettings) {
          setAppSettings(savedSettings);
        }
      } catch (err) {
        console.error("Gagal memuat konfigurasi dasar:", err);
      } finally {
        setIsDbLoading(false);
      }
    };

    loadSpreadsheetConfig();

    // Subscribe to bookings collection in real-time
    const unsubscribeBookings = subscribeFirestoreBookings(
      (realtimeBookings) => {
        setBookings(realtimeBookings);
      },
      (err) => {
        console.error("Gagal sinkronisasi data online bookings:", err);
      }
    );

    return () => {
      unsubscribeBookings();
    };
  }, []);

  // When token is fetched, initialize Google Sheets database and trigger sync
  useEffect(() => {
    if (!token) return;

    let unsubscribeTransactions: (() => void) | null = null;

    const setupOwnerSession = async () => {
      setIsDbLoading(true);
      setDbError(null);
      try {
        // Find or create sheet ID via Drive
        const sheetId = await findOrCreateSpreadsheet(token);
        
        // Save spreadsheet ID to Firestore so we remember it
        if (user?.email && user?.uid) {
          await saveSpreadsheetId(sheetId, user.email, user.uid);
        }
        setSpreadsheetId(sheetId);

        // Real-time listener for financial transactions
        unsubscribeTransactions = subscribeFirestoreTransactions(
          (realtimeTransactions) => {
            setTransactions(realtimeTransactions);
          },
          (err) => {
            console.error("Gagal sinkronisasi transaksi online:", err);
          }
        );

        // Run background synchronization of draft entries
        await syncDatabaseDraftsToSheets(token, sheetId);
      } catch (err: any) {
        console.error("Gagal sinkronisasi sesi Pemilik:", err);
        if (err.message && (err.message.includes("401") || err.message.includes("auth"))) {
          setDbError("Sesi Google Anda kedaluwarsa. Silakan keluar dan masuk kembali.");
        } else {
          setDbError(`Gagal sinkronisasi Google Sheets: ${err.message || err}`);
        }
      } finally {
        setIsDbLoading(false);
      }
    };

    setupOwnerSession();

    return () => {
      if (unsubscribeTransactions) {
        unsubscribeTransactions();
      }
    };
  }, [token, user]);

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
    if (window.confirm("Apakah Anda yakin ingin keluar dari akun Admin?")) {
      await logout();
      setUser(null);
      setToken(null);
      // Keep spreadsheet ID in state, but clear admin-only data
      setTransactions([]);
      setActiveTab('scheduler');
    }
  };

  // Re-sync on button click or refresh trigger
  const refreshData = async () => {
    setIsDbLoading(true);
    try {
      const [firestoreBookings, firestoreTransactions] = await Promise.all([
        getFirestoreBookings(),
        token ? getFirestoreTransactions() : Promise.resolve([])
      ]);
      setBookings(firestoreBookings);
      if (token) {
        setTransactions(firestoreTransactions);
        if (spreadsheetId) {
          await syncDatabaseDraftsToSheets(token, spreadsheetId);
        }
      }
    } catch (err: any) {
      console.error("Failed to refresh data:", err);
      alert(`Gagal syncing: ${err.message}`);
    } finally {
      setIsDbLoading(false);
    }
  };

  // Called when a new booking is submitted (either by guest or admin)
  const handleBookingAdded = async (newBooking: Booking) => {
    try {
      // 1. Save to Firestore first
      await saveFirestoreBooking(newBooking);
      setBookings(prev => [newBooking, ...prev]);
      
      // 2. Prompt instant payment gateway!
      setPayBooking(newBooking);

      // 3. If sheets is configured and active, save to Sheet too
      if (token && spreadsheetId) {
        try {
          await addBooking(token, spreadsheetId, newBooking);
          await updateFirestoreBookingSynced(newBooking.id, true);
          setBookings(prev => prev.map(b => b.id === newBooking.id ? { ...b, synced: true } : b));
        } catch (sheetErr) {
          console.error("GSheets deferred sync:", sheetErr);
        }
      }
    } catch (error: any) {
      console.error("Failed to add booking:", error);
      alert("Gagal menyimpan pesanan ke database: " + error.message);
    }
  };

  // Called when transaction added manually in Admin financial portal
  const handleTransactionAdded = async (newTx: FinancialTransaction) => {
    try {
      // 1. Save to Firestore first
      await saveFirestoreTransaction(newTx);
      setTransactions(prev => [newTx, ...prev]);

      // 2. If sheets is configured and active, save to Sheet too
      if (token && spreadsheetId) {
        try {
          await addTransaction(token, spreadsheetId, newTx);
          await updateFirestoreTransactionSynced(newTx.id, true);
          setTransactions(prev => prev.map(t => t.id === newTx.id ? { ...t, synced: true } : t));
        } catch (sheetErr) {
          console.error("GSheets transaction deferred sync:", sheetErr);
        }
      }
    } catch (error: any) {
      console.error("Failed to save transaction:", error);
      alert("Gagal mencatat mutasi kas: " + error.message);
    }
  };

  // Called when payment completes successfully
  const handlePaymentCompleted = async (bookingId: string) => {
    try {
      setBookings(prev => 
        prev.map(b => b.id === bookingId ? { ...b, paymentStatus: 'Lunas' } : b)
      );
      // Update paymentStatus in Firestore
      await updateFirestoreBookingStatus(bookingId, 'Lunas');

      // Sync status to sheet too if connected
      const updatedBooking = bookings.find(b => b.id === bookingId);
      if (updatedBooking && token && spreadsheetId) {
        try {
          await syncDatabaseDraftsToSheets(token, spreadsheetId);
        } catch (err) {
          console.error("Sheets update deferred:", err);
        }
      }
    } catch (err: any) {
      console.error("Failed to settle payment:", err);
    }
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
      
      {/* 1. Main Application Area */}
      <div className="pb-16 font-sans">
        
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-700">
                      Mode Penyewa Aktif
                    </div>
                    <button
                      onClick={() => {
                        alert("Terima kasih anda telah menggunakan Fazada Badminton");
                        setIsScanned(false);
                        window.location.href = window.location.origin + window.location.pathname;
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Keluar dari Portal Penyewa"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar
                    </button>
                  </div>
                ) : user ? (
                  <>
                    {user?.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName} 
                        className="w-8 h-8 rounded-full border border-slate-200" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs capitalize">
                        {user?.displayName ? user.displayName[0] : 'U'}
                      </div>
                    )}
                    <div className="hidden md:block text-left font-sans">
                      <span className="text-xs font-semibold text-slate-700 block leading-none">{user?.displayName}</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">{user?.email}</span>
                    </div>
                    
                    <button
                      onClick={handleLogout}
                      className="p-1.5 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                      title="Keluar Admin"
                    >
                      <LogOut className="w-4.5 h-4.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-xl flex items-center gap-1.5 transition-all outline-none cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Login Admin
                  </button>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* Tab Navigation Subheader (Only shown for Owner-Admin) */}
        {user && !isScanned && (
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

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`h-full px-1 text-xs font-bold relative transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'settings' ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-850'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Pengaturan
                  {activeTab === 'settings' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full animate-fade-in"></div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Core Body Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
          
          {authError && (
            <div className="bg-rose-50 text-rose-800 text-xs px-4 py-3.5 border border-rose-100 rounded-xl flex items-start gap-3 md:gap-4 font-medium animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div>
                  <p className="font-extrabold text-slate-850">Gagal Otorisasi / Login Admin</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-bold">Kode Error: {authError.code}</p>
                </div>
                <p className="text-slate-600 leading-relaxed font-sans text-xs">
                  {authError.code === 'auth/popup-closed-by-user' || authError.message.includes('popup-closed-by-user') || authError.message.includes('popup') ? (
                    <span>
                      Jendela popup login Google ditutup atau diblokir. Karena keterbatasan kebijakan keamanan browser saat memuat aplikasi di dalam iFrame AI Studio, 
                      proses autograb popup Google mungkin dibatasi. Silakan klik tombol <strong>"Buka di Tab Baru"</strong> di bawah ini untuk masuk sebagai Admin secara lancar.
                    </span>
                  ) : authError.isDomainError ? (
                    <span>
                      Domain situs ini belum ditambahkan ke daftar Authorized Domains di modul Google Auth Firebase Console Anda. 
                      Harap daftarkan domain ini di setelan Firebase Authentication agar login berfungsi.
                    </span>
                  ) : (
                    <span>Detail Error: {authError.message}</span>
                  )}
                </p>
                
                <div className="flex flex-wrap gap-2 pt-1 font-bold">
                  <a
                    href={window.location.origin + window.location.pathname}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer text-[11px]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Buka Aplikasi di Tab Baru
                  </a>
                  <button
                    onClick={() => {
                      setAuthError(null);
                      handleLogin();
                    }}
                    className="px-3 py-2 bg-white border border-rose-200 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors inline-block cursor-pointer text-[11px]"
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={() => setAuthError(null)}
                    className="px-3 py-2 bg-transparent text-slate-450 hover:text-slate-650 transition-colors inline-block cursor-pointer text-[11px]"
                  >
                    Tutup Pesan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Database Sync Progress and Info header */}
          {user && !isScanned && isDbLoading && (
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

          {user && !isScanned && !isDbLoading && !dbError && spreadsheetUrl && (
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

          {activeTab === 'scheduler' && (
            <>
              {/* Scheduler & Booking Form Section */}
              <section id="scheduler-section" className="scroll-mt-24">
                <CourtSchedule
                  courts={courts}
                  bookings={bookings}
                  selectedCourtId={selectedCourtId}
                  onCourtChange={setSelectedCourtId}
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
                  spreadsheetUrl={user ? spreadsheetUrl : null}
                />
              </section>
            </>
          )}

          {user && activeTab === 'barcodes' && (
            <section className="animate-fade-in">
              <PrintableBarcodes courts={courts} />
            </section>
          )}

          {user && activeTab === 'admin' && (
            <section className="animate-fade-in">
              <AdminFinancialPortal
                bookings={bookings}
                transactions={transactions}
                accessToken={token || ""}
                spreadsheetId={spreadsheetId || ""}
                onTransactionAdded={handleTransactionAdded}
                onRefreshAll={refreshData}
              />
            </section>
          )}

          {user && activeTab === 'settings' && (
            <section className="animate-fade-in">
              <AppSettingsTab onSettingsSaved={(settings) => setAppSettings(settings)} />
            </section>
          )}

        </main>
        
        {/* Footer information */}
        <footer className="max-w-7xl mx-auto px-4 text-center mt-12 text-[11px] text-slate-400 leading-normal mb-8">
          <p className="font-medium">Fazada Badminton Booking Engine • Terintegrasi Cloud Firestore & Google Sheets untuk Cadangan Data.</p>
          <p className="mt-1">Hak Cipta © {new Date().getFullYear()}. Semua Hak Dilindungi.</p>
        </footer>

      </div>

      {/* 2. Global Scanner and Payment Modals */}
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
        appSettings={appSettings}
      />

    </div>
  );
}

const DATABASE_FILE_NAME = "Database Penyewaan Lapangan Bulu Tangkis";
