import { appendToSheet, clearSheet } from '@/lib/googleSheets';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { action, withdrawals } = await request.json();

    if (action === 'sync') {
      // Limpiar sheet y agregar todos los retiros
      await clearSheet();

      if (withdrawals.length > 0) {
        const rows = withdrawals.map((w: any) => [
          w.fecha,
          w.nombre,
          w.oro,
          w.tasa,
          w.usd,
          w.estado,
        ]);
        await appendToSheet(rows);
      }

      return NextResponse.json({ success: true, message: 'Datos sincronizados' });
    }

    return NextResponse.json(
      { success: false, message: 'Acción no válida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error al sincronizar' },
      { status: 500 }
    );
  }
}
