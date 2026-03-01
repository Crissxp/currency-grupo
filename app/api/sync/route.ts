import { appendToSheet, clearSheet } from '@/lib/googleSheets';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { action, withdrawals, oroBanco } = await request.json();

    if (action === 'sync') {
      // Limpiar toda la hoja
      await clearSheet();

      // fila especial que guardará los valores de oroBanco en JSON
      const bankRow = ['__bank__', JSON.stringify(oroBanco || {})];
      await appendToSheet([bankRow]);

      // fila de encabezados para los retiros (para lectura humana)
      const header = ['fecha', 'nombre', 'oro', 'tasa', 'usd', 'estado'];
      await appendToSheet([header]);

      if (withdrawals && withdrawals.length > 0) {
        const rows = withdrawals.map((w: any) => [
          w.fecha,
          w.nombre,
          w.oro,
          // store tasa as string to prevent Sheets from auto-rounding
          String(w.tasa),
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
