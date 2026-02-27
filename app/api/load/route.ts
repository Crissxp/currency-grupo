import { getAllWithdrawals } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await getAllWithdrawals();
    // rows: array of arrays [fecha,nombre,oro,tasa,usd,estado]
    const data = (rows || []).map((r) => ({
      fecha: r[0] || null,
      nombre: r[1] || null,
      oro: r[2] ? Number(r[2]) : 0,
      tasa: r[3] ? Number(r[3]) : 0,
      usd: r[4] ? Number(r[4]) : 0,
      estado: r[5] || null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error loading sheet:', error);
    return NextResponse.json({ success: false, message: 'Error loading sheet' }, { status: 500 });
  }
}
