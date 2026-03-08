import { getAllWithdrawals } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';

export async function GET() {
  // Ensure runtime is server-only and does not rely on client-only APIs
  try {
    const rows = await getAllWithdrawals();

    let oroBanco: Record<string, number> = {
      alan: 0,
      carlitos: 0,
      criss: 0,
      foquita: 0,
      tommy: 0,
    };
    let membersFromSheet: any[] | null = null;
    let usersFromSheet: any[] | null = null;
    let bankHistoryFromSheet: any[] | null = null;
    let dataRows: any[][] = [];

    // parse top rows searching for special markers in order
    let idx = 0;
    if (rows[idx] && rows[idx][0] === '__bank__') {
      try {
        oroBanco = JSON.parse(rows[idx][1] || '{}');
      } catch {}
      idx++;
    }
    if (rows[idx] && rows[idx][0] === '__members__') {
      try {
        membersFromSheet = JSON.parse(rows[idx][1] || '[]');
      } catch {}
      idx++;
    }
    if (rows[idx] && rows[idx][0] === '__users__') {
      try {
        usersFromSheet = JSON.parse(rows[idx][1] || '[]');
      } catch {}
      idx++;
    }
    if (rows[idx] && rows[idx][0] === '__bank_history__') {
      try {
        bankHistoryFromSheet = JSON.parse(rows[idx][1] || '[]');
      } catch {}
      idx++;
    }

    // now expect header row (fecha, nombre, ...)
    // skip header if present
    if (rows[idx] && Array.isArray(rows[idx]) && rows[idx][0] === 'fecha') {
      idx++;
    }

    dataRows = rows.slice(idx);

    const data = (dataRows || []).map((r) => ({
      fecha: r[0] || null,
      nombre: r[1] || null,
      oro: r[2] ? Number(r[2]) : 0,
      tasa: r[3] ? Number(r[3]) : 0,
      usd: r[4] ? Number(r[4]) : 0,
      estado: r[5] || null,
    }));

    return NextResponse.json({ success: true, data, oroBanco, members: membersFromSheet, users: usersFromSheet, bankHistory: bankHistoryFromSheet });
  } catch (error) {
    console.error('Error loading sheet:', error);
    return NextResponse.json({ success: false, message: 'Error loading sheet' }, { status: 500 });
  }
}
