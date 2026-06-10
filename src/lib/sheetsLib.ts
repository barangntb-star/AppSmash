export interface Court {
  id: string;
  name: string;
  description: string;
  pricePerHour: number;
  imageUrl: string;
}

export interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string; // Format: YYYY-MM-DD
  startTime: string; // Format: HH:MM
  endTime: string; // Format: HH:MM
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: 'Menunggu Pembayaran' | 'Lunas';
  createdAt: string;
}

const DATABASE_FILE_NAME = "Database Penyewaan Lapangan Bulu Tangkis";

// Finds our database spreadsheet in user's Drive. If not found, creates and initializes a new one.
export const findOrCreateSpreadsheet = async (accessToken: string): Promise<string> => {
  try {
    // 1. Search for existing file
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(DATABASE_FILE_NAME)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      const errorMsg = await searchRes.text();
      throw new Error(`Failed to search Drive: ${errorMsg}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      console.log("Database found:", searchData.files[0].id);
      return searchData.files[0].id;
    }

    // 2. Not found, create a new spreadsheet
    console.log("Database not found. Creating new Google Spreadsheet...");
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: DATABASE_FILE_NAME,
        },
        sheets: [
          {
            properties: { title: 'Courts' },
          },
          {
            properties: { title: 'Bookings' },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errorMsg = await createRes.text();
      throw new Error(`Failed to create spreadsheet: ${errorMsg}`);
    }

    const newSheet = await createRes.json();
    const spreadsheetId = newSheet.spreadsheetId;
    console.log("Successfully created spreadsheet with ID:", spreadsheetId);

    // 3. Populate default Courts rows
    const courtsRange = 'Courts!A1:E3';
    const courtsValues = [
      ["Court ID", "Name", "Description", "Price Per Hour (IDR)", "Image URL"],
      ["CT001", "Lapangan A Reguler", "Lantai karpet vinyl berkualitas premium berstandar nasional, peredam kejut nyaman, pencahayaan LED terang bebas silau.", 60000, "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=600"],
      ["CT002", "Lapangan B Reguler", "Lantai papan kayu parket tebal standar latihan, nyaman untuk permainan single maupun double dengan sirkulasi udara baik.", 50000, "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=600"]
    ];

    const courtsUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${courtsRange}?valueInputOption=USER_ENTERED`;
    await fetch(courtsUpdateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: courtsValues }),
    });

    // 4. Populate default Bookings headers and some seed rows for today/tomorrow to look active
    const bookingsRange = 'Bookings!A1:L3';
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Create tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const bookingsValues = [
      ["Booking ID", "Court ID", "Court Name", "Customer Name", "Customer Phone", "Booking Date", "Start Time", "End Time", "Total Price (IDR)", "Payment Method", "Payment Status", "Created At"],
      ["BK100234", "CT001", "Lapangan A Reguler", "Ahmad Syarif", "081234567890", todayStr, "16:00", "18:00", 120000, "QRIS", "Lunas", new Date().toISOString()],
      ["BK100235", "CT002", "Lapangan B Reguler", "Budi Santoso", "087766554433", tomorrowStr, "19:00", "21:00", 100000, "Transfer Bank", "Lunas", new Date().toISOString()]
    ];

    const bookingsUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${bookingsRange}?valueInputOption=USER_ENTERED`;
    await fetch(bookingsUpdateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: bookingsValues }),
    });

    return spreadsheetId;
  } catch (err) {
    console.error("Error in findOrCreateSpreadsheet:", err);
    throw err;
  }
};

// Reads court configurations from spreadsheet
export const readCourts = async (accessToken: string, spreadsheetId: string): Promise<Court[]> => {
  const range = 'Courts!A2:E100'; // Exclude headers, read up to row 100
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to read courts: ${await res.text()}`);
  }

  const data = await res.json();
  const rows = data.values || [];
  
  return rows.map((row: any) => ({
    id: row[0] || "",
    name: row[1] || "",
    description: row[2] || "",
    pricePerHour: Number(row[3]) || 0,
    imageUrl: row[4] || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=600",
  })).filter((c: Court) => c.id !== "");
};

// Reads booking entries from spreadsheet
export const readBookings = async (accessToken: string, spreadsheetId: string): Promise<Booking[]> => {
  const range = 'Bookings!A2:L1000'; // Exclude headers, read up to row 1000
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to read bookings: ${await res.text()}`);
  }

  const data = await res.json();
  const rows = data.values || [];

  return rows.map((row: any) => ({
    id: row[0] || "",
    courtId: row[1] || "",
    courtName: row[2] || "",
    customerName: row[3] || "",
    customerPhone: row[4] || "",
    bookingDate: row[5] || "",
    startTime: row[6] || "",
    endTime: row[7] || "",
    totalPrice: Number(row[8]) || 0,
    paymentMethod: row[9] || "",
    paymentStatus: row[10] || "Menunggu Pembayaran",
    createdAt: row[11] || "",
  })).filter((b: Booking) => b.id !== "");
};

// Appends a new booking row to the spreadsheet
export const addBooking = async (accessToken: string, spreadsheetId: string, booking: Booking): Promise<boolean> => {
  // We'll append to 'Bookings!A:L'
  const range = 'Bookings!A:L';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const values = [
    [
      booking.id,
      booking.courtId,
      booking.courtName,
      booking.customerName,
      booking.customerPhone,
      booking.bookingDate,
      booking.startTime,
      booking.endTime,
      booking.totalPrice,
      booking.paymentMethod,
      booking.paymentStatus,
      booking.createdAt
    ]
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    throw new Error(`Failed to add booking: ${await res.text()}`);
  }

  return true;
};

// Updates status of a booking to "Lunas" or "Menunggu Pembayaran"
export const updateBookingStatus = async (
  accessToken: string,
  spreadsheetId: string,
  bookingId: string,
  status: 'Menunggu Pembayaran' | 'Lunas'
): Promise<boolean> => {
  // First, find which row the booking lies on
  const range = 'Bookings!A1:A1000'; // Read booking IDs to match
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch bookings list for update: ${await res.text()}`);
  }

  const data = await res.json();
  const rows = data.values || [];
  
  // Row 1 is headers (index 0). Index in rows array perfectly maps to (index + 1) index in Sheet
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === bookingId) {
      rowIndex = i + 1; // 1-indexed for sheets
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Booking ID ${bookingId} not found in the database.`);
  }

  // Column K corresponds to Payment Status (index 11, which is column K since A=1, B=2, ..., K=11)
  const cellRange = `Bookings!K${rowIndex}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${cellRange}?valueInputOption=USER_ENTERED`;
  
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [[status]] }),
  });

  if (!updateRes.ok) {
    throw new Error(`Failed to update cell: ${await updateRes.text()}`);
  }

  return true;
};
