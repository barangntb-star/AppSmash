import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  query,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Booking, FinancialTransaction } from './sheetsLib';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Standardized Operation Type enum
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Standardized Firestore Error Info interface
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Unified Firestore error handler
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 0. Validate Connection to Firestore on startup
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Firestore client is offline.");
    } else {
      console.log("Firestore connection test: connected or handles permissions (expected behavior).");
    }
  }
}
testConnection();

const provider = new GoogleAuthProvider();
// Request Google Sheet and Drive file scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // We have a user but no cached token (browser refresh)
        // Since Firebase doesn't persist the provider OAuth access token across sessions automatically,
        // the client will trigger signInWithPopup if direct API calls fail or request log-in.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Log in via Google popup and fetch full access token
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token dari Google Auth. Pastikan iFrame diijinkan.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// --- Firestore Helpers ---

// 1. Spreadsheet Config helpers
export const saveSpreadsheetId = async (spreadsheetId: string, ownerEmail: string, ownerUserId: string) => {
  try {
    await setDoc(doc(db, 'configs', 'sheets'), {
      spreadsheetId,
      ownerEmail,
      ownerUserId,
      updatedAt: new Date().toISOString()
    });
    console.log("Successfully saved spreadsheet ID to Firestore:", spreadsheetId);
  } catch (error) {
    console.error("Failed to save spreadsheetId to Firestore:", error);
  }
};

export const getSavedSpreadsheetId = async (): Promise<string | null> => {
  try {
    const sDoc = await getDoc(doc(db, 'configs', 'sheets'));
    if (sDoc.exists()) {
      return sDoc.data().spreadsheetId || null;
    }
  } catch (error) {
    console.error("Failed to fetch spreadsheetId from Firestore:", error);
  }
  return null;
};

// 2. Bookings helpers
export const getFirestoreBookings = async (): Promise<Booking[]> => {
  try {
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const s = await getDocs(q);
    const bookingsList: Booking[] = [];
    s.forEach((d) => {
      bookingsList.push(d.data() as Booking);
    });
    return bookingsList;
  } catch (error) {
    console.error("Failed to fetch bookings from Firestore:", error);
    return [];
  }
};

export const saveFirestoreBooking = async (booking: Booking): Promise<void> => {
  try {
    await setDoc(doc(db, 'bookings', booking.id), booking);
    console.log("Successfully saved booking to Firestore:", booking.id);
  } catch (error) {
    console.error("Failed to save booking to Firestore:", error);
    throw error;
  }
};

export const updateFirestoreBookingStatus = async (
  bookingId: string,
  paymentStatus: 'Menunggu Pembayaran' | 'Lunas'
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { paymentStatus });
    console.log("Successfully updated booking payment status in Firestore:", bookingId);
  } catch (error) {
    console.error("Failed to update booking status in Firestore:", error);
    throw error;
  }
};

export const updateFirestoreBookingSynced = async (
  bookingId: string,
  synced: boolean
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { synced });
    console.log("Successfully updated booking sync status in Firestore:", bookingId);
  } catch (error) {
    console.error("Failed to update booking sync status in Firestore:", error);
    throw error;
  }
};

// 3. Transactions helpers
export const getFirestoreTransactions = async (): Promise<FinancialTransaction[]> => {
  try {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const s = await getDocs(q);
    const txList: FinancialTransaction[] = [];
    s.forEach((d) => {
      txList.push(d.data() as FinancialTransaction);
    });
    return txList;
  } catch (error) {
    console.error("Failed to fetch transactions from Firestore:", error);
    return [];
  }
};

export const saveFirestoreTransaction = async (tx: FinancialTransaction): Promise<void> => {
  try {
    await setDoc(doc(db, 'transactions', tx.id), tx);
    console.log("Successfully saved transaction to Firestore:", tx.id);
  } catch (error) {
    console.error("Failed to save transaction to Firestore:", error);
    throw error;
  }
};

export const updateFirestoreTransactionSynced = async (
  txId: string,
  synced: boolean
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'transactions', txId), { synced });
    console.log("Successfully updated transaction sync status in Firestore:", txId);
  } catch (error) {
    console.error("Failed to update transaction sync status in Firestore:", error);
    throw error;
  }
};


