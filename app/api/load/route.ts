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
    let membersFromSheet: any[] | null = null;
    let dataRows: any[][] = [];

    if (rows.length && rows[0][0] === '__bank__') {
      try {
        oroBanco = JSON.parse(rows[0][1] || '{}');
      } catch {}
      // puede haber una fila de miembros justo después del bank
      if (rows[1] && rows[1][0] === '__members__') {
        try {
          membersFromSheet = JSON.parse(rows[1][1] || '[]');
        } catch {}
        // saltamos bank + members + encabezados
        dataRows = rows.slice(3);
      } else {
        // saltamos bank + encabezados
        dataRows = rows.slice(2);
      }
    } else {
      // si no hay fila de banco usamos lo restante sin primera fila de encabezados
      // si la primer fila es __members__, procesarla
      if (rows[0] && rows[0][0] === '__members__') {
        try {
          membersFromSheet = JSON.parse(rows[0][1] || '[]');
        } catch {}
        dataRows = rows.slice(2);
      } else {
        dataRows = rows.slice(1);
      }
    }

    const data = (dataRows || []).map((r) => ({
      fecha: r[0] || null,
      nombre: r[1] || null,
      oro: r[2] ? Number(r[2]) : 0,
      tasa: r[3] ? Number(r[3]) : 0,
      usd: r[4] ? Number(r[4]) : 0,
      estado: r[5] || null,
    }));

    return NextResponse.json({ success: true, data, oroBanco, members: membersFromSheet });
  } catch (error) {
    console.error('Error loading sheet:', error);
    return NextResponse.json({ success: false, message: 'Error loading sheet' }, { status: 500 });
  }
}
