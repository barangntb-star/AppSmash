import React, { useState, useEffect, useRef } from 'react';
import { 
  getAppSettings, 
  saveAppSettings, 
  AppSettings 
} from '../lib/firebaseLib';
import { 
  Building, 
  CreditCard, 
  Phone, 
  QrCode, 
  UploadCloud, 
  Download, 
  Save, 
  CheckCircle, 
  AlertCircle,
  FileCode,
  Image as ImageIcon
} from 'lucide-react';

interface AppSettingsTabProps {
  onSettingsSaved?: (settings: AppSettings) => void;
}

export default function AppSettingsTab({ onSettingsSaved }: AppSettingsTabProps) {
  const [bankName, setBankName] = useState('BCA');
  const [accountNumber, setAccountNumber] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [qrisDataUrl, setQrisDataUrl] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current settings from Firestore on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const data = await getAppSettings();
        if (data) {
          setBankName(data.bankName || 'BCA');
          setAccountNumber(data.accountNumber || '');
          setAdminPhone(data.adminPhone || '');
          setQrisDataUrl(data.qrisDataUrl || '');
        }
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        setErrorMessage('Gagal memuat pengaturan: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    if (!bankName.trim() || !accountNumber.trim() || !adminPhone.trim()) {
      setErrorMessage('Semua bidang wajib diisi kecuali gambar QRIS.');
      setIsSaving(false);
      return;
    }

    try {
      const updatedSettings: AppSettings = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        adminPhone: adminPhone.trim(),
        qrisDataUrl: qrisDataUrl
      };

      await saveAppSettings(updatedSettings);
      setSaveSuccess(true);
      if (onSettingsSaved) {
        onSettingsSaved(updatedSettings);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Drag and drop handlers for file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa berkas gambar (PNG, JPG, JPEG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setQrisDataUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadQris = () => {
    if (!qrisDataUrl) {
      alert('Sediakan gambar QRIS terlebih dahulu dengan mengunggahnya pada kolom di bawah.');
      return;
    }
    const link = document.createElement('a');
    link.href = qrisDataUrl;
    link.download = 'QRIS_Fazada_Badminton.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-150 shadow-subtle text-center py-16 animate-pulse">
        <Building className="w-10 h-10 text-slate-300 animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-600">Memuat data pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Settings Form Column */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-base leading-tight">Pengaturan Informasi Pembayaran & Kontak</h3>
            <p className="text-xs text-slate-400 mt-0.5">Kelola rekening bank penerima nominal sewa dan kontak admin helpdesk.</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-5 bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>Pengaturan berhasil disimpan ke cloud database dan diperbarui pada halaman reservasi!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Nama Bank */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Nama Bank Tujuan</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input 
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Contoh: BCA / Mandiri / BNI"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white outline-none pl-10 pr-4 py-3 rounded-xl transition-all text-xs font-semibold uppercase text-slate-800"
                />
              </div>
              <p className="text-[10px] text-slate-400">Gunakan singkatan bank yang jelas agar mudah dipahami pelanggan.</p>
            </div>

            {/* Nomor Rekening */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Nomor Rekening Bank</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input 
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Masukkan No. Rekening penerima sewa"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white outline-none pl-10 pr-4 py-3 rounded-xl transition-all text-xs font-mono text-slate-800 font-bold"
                />
              </div>
              <p className="text-[10px] text-slate-400">Hanya angka atau pembatas strip. Dipakai pada mode Virtual Account.</p>
            </div>

          </div>

          {/* No HP Admin */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">Nomor HP Admin (WhatsApp)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input 
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="Contoh: 08123456789 atau 628123456789"
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white outline-none pl-10 pr-4 py-3 rounded-xl transition-all text-xs font-mono text-slate-800 font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Pelanggan dapat melakukan konfirmasi slip pembayaran atau mengajukan pertanyaan langsung ke nomor ini melaui chat Whatsapp.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50 disabled:cursor-wait"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </form>
      </div>

      {/* QRIS Upload & Download Zone Column */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base leading-tight">Barcode QRIS</h3>
              <p className="text-xs text-slate-400 mt-0.5">Unggah gambar barcode QRIS statis outlet Anda.</p>
            </div>
          </div>

          {/* QRIS Preview or Placeholder Area */}
          <div className="border border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden min-h-[220px]">
            {qrisDataUrl ? (
              <div className="text-center">
                <img 
                  src={qrisDataUrl} 
                  alt="QRIS Current Config" 
                  className="w-40 h-40 object-contain mx-auto bg-white p-2.5 rounded-xl border border-slate-150 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setQrisDataUrl('')}
                  className="mt-3.5 text-[10px] text-rose-600 font-bold hover:underline"
                >
                  Hapus & Unggah Ulang
                </button>
              </div>
            ) : (
              <div className="text-center text-slate-400 px-4">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-[11px] font-semibold text-slate-650">Unggah Barcode QRIS</p>
                <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                  Klien dapat memindai barcode ini di portal kasir untuk pembayaran instan non-tunai.
                </p>
              </div>
            )}
          </div>

          {/* File drag-and-drop / selector zone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`mt-4 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-50/30' 
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/45'
            }`}
          >
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <p className="text-[10px] font-bold text-slate-700">Tarik berkas atau klik untuk mengunggah gambar</p>
            <p className="text-[8px] text-slate-400 mt-1">Format: PNG, JPG, JPEG (Maks. 2MB)</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadQris}
            disabled={!qrisDataUrl}
            className="w-full py-3 bg-indigo-50 border border-indigo-150 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Barcode QRIS
          </button>
          <p className="text-[9px] text-slate-400 text-center leading-normal">
            Gunakan tombol "Download" di atas untuk memeriksa hasil unggahan barcode siap pakai.
          </p>
        </div>

      </div>

    </div>
  );
}
