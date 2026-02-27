import { getAllWithdrawals } from '@/lib/googleSheets';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await getAllWithdrawals();

    let oroBanco: Record<string, number> = {
      alan: 0,
      carlitos: 0,
      criss: 0,
      foquita: 0,
      tommy: 0,
    };
    let dataRows: any[][] = [];

    if (rows.length && rows[0][0] === '__bank__') {
      try {
        oroBanco = JSON.parse(rows[0][1] || '{}');
      } catch {}
      // saltamos la fila de bank y la de encabezados
      dataRows = rows.slice(2);
    } else {
      // si no hay fila de banco usamos lo restante sin primera fila de encabezados
      dataRows = rows.slice(1);
    }

    const data = (dataRows || []).map((r) => ({
      fecha: r[0] || null,
      nombre: r[1] || null,
      oro: r[2] ? Number(r[2]) : 0,
      tasa: r[3] ? Number(r[3]) : 0,
      usd: r[4] ? Number(r[4]) : 0,
      estado: r[5] || null,
    }));

    return NextResponse.json({ success: true, data, oroBanco });
  } catch (error) {
    console.error('Error loading sheet:', error);
    return NextResponse.json({ success: false, message: 'Error loading sheet' }, { status: 500 });
  }
}
