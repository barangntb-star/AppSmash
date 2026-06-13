import React, { useState, useMemo } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Search, 
  MapPin, 
  Phone, 
  User, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle,
  Users,
  Hash
} from 'lucide-react';
import { Member } from '../lib/firebaseLib';

interface MemberManagementTabProps {
  members: Member[];
  onAddMember: (member: Member) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}

export default function MemberManagementTab({
  members,
  onAddMember,
  onDeleteMember
}: MemberManagementTabProps) {
  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter members based on search term (name, phone, or address)
  const filteredMembers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.address.toLowerCase().includes(q)
    );
  }, [members, searchTerm]);

  // Handle addition of new member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/[^0-9]/g, ''); // normalize phone
    const cleanAddress = address.trim();

    if (!cleanName || !cleanPhone || !cleanAddress) {
      setErrorMessage("Harap lengkapi semua isian formulir.");
      return;
    }

    if (cleanPhone.length < 8) {
      setErrorMessage("Nomor handphone tidak valid.");
      return;
    }

    // Check if phone number is already registered
    const isAlreadyMember = members.some(m => m.phone.replace(/[^0-9]/g, '') === cleanPhone);
    if (isAlreadyMember) {
      setErrorMessage(`Nomor HP ${phone} sudah terdaftar sebagai member.`);
      return;
    }

    setIsSaving(true);
    try {
      const memberId = "MB" + Math.floor(100000 + Math.random() * 900000);
      
      const newMember: Member = {
        id: memberId,
        name: cleanName,
        phone: phone.trim(),
        address: cleanAddress,
        createdAt: new Date().toISOString()
      };

      await onAddMember(newMember);

      // Reset form on success
      setName('');
      setPhone('');
      setAddress('');
      setSuccessMessage(`Berhasil mendaftarkan member: ${cleanName}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Gagal menyimpan member: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleted member confirmation
  const handleDeleteMember = async (id: string) => {
    try {
      await onDeleteMember(id);
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal menghapus member: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Column 1: Add new member form */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs h-fit space-y-4">
        <div>
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">ADMINISTRASI KEMEMBERAN</span>
          <h3 className="font-extrabold text-slate-800 text-lg">Daftar Member Baru</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Member terdaftar akan otomatis diberi diskon khusus sebesar <strong>Rp 10.000 per jam</strong> saat melakukan booking lapangan.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 text-rose-800 text-xs px-3.5 py-2.5 rounded-xl border border-rose-100 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl border border-emerald-100 flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleAddMember} className="space-y-4">
          {/* Member Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              Nama Lengkap Member
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Budi Santoso"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl focus:border-emerald-500 text-slate-800 text-xs transition-all font-medium"
            />
          </div>

          {/* Member Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              Nomor HP (WhatsApp)
            </label>
            <input
              type="tel"
              required
              placeholder="Contoh: 081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl focus:border-emerald-500 text-slate-800 text-xs transition-all font-mono"
            />
          </div>

          {/* Member Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Alamat Domisili
            </label>
            <textarea
              required
              rows={3}
              placeholder="Contoh: Jl. Diponegoro No. 12, Praya"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl focus:border-emerald-500 text-slate-800 text-xs transition-all font-medium resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Simpan & Daftarkan Member
              </>
            )}
          </button>
        </form>
      </div>

      {/* Column 2 & 3: Member list directories */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4 flex flex-col">
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Direktori Member Aktif ({members.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Kelola seluruh pelanggan setia Fazada Badminton.</p>
          </div>

          {/* Search box */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, No. HP, alamat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 outline-none pl-9 pr-4 py-2 rounded-xl text-xs focus:border-emerald-500 transition-all font-medium text-slate-700"
            />
          </div>
        </div>

        {/* Directory Listings */}
        <div className="flex-1 max-h-[500px] overflow-y-auto space-y-2.5 pr-1">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-405 border border-dashed border-slate-150 rounded-2xl">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
              <p className="text-xs font-semibold text-slate-500">Tidak ada data member ditemukan</p>
              <p className="text-[10px] text-slate-400 mt-1">Gunakan formulir disamping untuk mendaftarkan member setia Anda.</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div 
                key={member.id} 
                className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-sm">
                      {member.id}
                    </span>
                    <h4 className="font-bold text-slate-850 text-sm capitalize">{member.name}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-slate-500 text-[11px] font-medium leading-relaxed">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1 capitalize">{member.address}</span>
                    </div>
                  </div>
                </div>

                {/* Right actions: delete members */}
                <div className="shrink-0 flex items-center justify-end">
                  {deleteConfirmId === member.id ? (
                    <div className="flex items-center gap-1.5 animate-fade-in font-bold">
                      <span className="text-[10px] text-rose-600">Hapus member?</span>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] cursor-pointer"
                      >
                        Ya
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(member.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Hapus Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
