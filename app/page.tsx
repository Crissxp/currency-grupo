'use client';

import { useEffect, useMemo, useState } from 'react';

type PlayerId = 'alan' | 'carlitos' | 'criss' | 'foquita' | 'tommy';

type Player = {
  id: PlayerId;
  nombre: string;
};

type WithdrawalStatus = 'pendiente' | 'pagado';

type Withdrawal = {
  id: string;
  playerId: PlayerId;
  nombre: string;
  oro: number;
  tasa: number;
  usd: number;
  fecha: string; // ISO
  estado: WithdrawalStatus;
};

const PLAYERS: Player[] = [
  { id: 'alan', nombre: 'Alan' },
  { id: 'carlitos', nombre: 'Carlitos' },
  { id: 'criss', nombre: 'Criss' },
  { id: 'foquita', nombre: 'Foquita' },
  { id: 'tommy', nombre: 'Tommy' },
];

export default function HomePage() {
  const [oroBanco, setOroBanco] = useState<Record<PlayerId, number>>({
    alan: 0,
    carlitos: 0,
    criss: 0,
    foquita: 0,
    tommy: 0,
  });

  const [tasaOroUsd, setTasaOroUsd] = useState<number>(0.03);
  const [simboloUsd, setSimboloUsd] = useState<string>('USD');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string | null>(null);

  // Cargar desde localStorage al montar
  useEffect(() => {
    const guardado = localStorage.getItem('currency-grupo-data');
    if (guardado) {
      try {
        const datos = JSON.parse(guardado);
        setWithdrawals(datos.withdrawals || []);
        setOroBanco(datos.oroBanco || {
          alan: 0,
          carlitos: 0,
          criss: 0,
          foquita: 0,
          tommy: 0,
        });
        setTasaOroUsd(datos.tasaOroUsd || 0.03);
        const ultima = localStorage.getItem('currency-grupo-ultima-sync');
        if (ultima) setUltimaSincronizacion(ultima);
      } catch (e) {
        console.error('Error cargando datos:', e);
      }
    }
  }, []);

  // cada cierto intervalo revisa si hay cambios en la hoja
  useEffect(() => {
    // primera carga inmediata
    loadFromSheet();
    const id = setInterval(() => {
      loadFromSheet();
    }, 30_000); // 30 segundos
    return () => clearInterval(id);
  }, []);

  // Guardar en localStorage cada vez que cambian los withdrawals
  useEffect(() => {
    localStorage.setItem('currency-grupo-data', JSON.stringify({
      withdrawals,
      oroBanco,
      tasaOroUsd,
    }));
  }, [withdrawals, oroBanco, tasaOroUsd]);

  // Sincronizar con Google Sheets
  const sincronizarConSheet = async () => {
    setSincronizando(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          withdrawals,
          oroBanco,
        }),
      });

      if (response.ok) {
        const ahora = new Date().toLocaleString('es-MX');
        setUltimaSincronizacion(ahora);
        localStorage.setItem('currency-grupo-ultima-sync', ahora);
        alert('✅ Datos sincronizados con Google Sheets');
      } else {
        alert('❌ Error al sincronizar');
      }
    } catch (error) {
      console.error('Error sincronizando:', error);
      alert('❌ No se pudo conectar al servidor');
    } finally {
      setSincronizando(false);
    }
  };

  // Cargar los withdrawals desde Google Sheets
  const loadFromSheet = async () => {
    try {
      const res = await fetch('/api/load');
      const json = await res.json();
      if (json.success) {
        if (json.oroBanco) {
          // sincronizamos el estado del banco con lo remoto
          setOroBanco((prev) => ({ ...prev, ...json.oroBanco }));
        }
        // convertir a Withdrawal si es necesario
        const sheetData: Withdrawal[] = (json.data || []).map((r: any) => ({
          id: r.fecha + r.nombre,
          playerId: PLAYERS.find((p) => p.nombre === r.nombre)?.id as PlayerId,
          nombre: r.nombre,
          oro: r.oro,
          tasa: r.tasa || tasaOroUsd,
          usd: r.usd,
          fecha: r.fecha,
          estado: r.estado || 'pendiente',
        }));
        setWithdrawals(sheetData);
      }
    } catch (e) {
      console.error('load from sheet failed', e);
    }
  };

    

  // Fijo: nombre de la unidad
  const unidadLabel = 'oro';

  // Modal de retiro múltiple
  const [modalAbierto, setModalAbierto] = useState(false);
  const [retirosDraft, setRetirosDraft] = useState<Record<PlayerId, number>>({
    alan: 0,
    carlitos: 0,
    criss: 0,
    foquita: 0,
    tommy: 0,
  });
  const [modalTasa, setModalTasa] = useState<number | null>(null);

  const totalOroBanco = useMemo(
    () => Object.values(oroBanco).reduce((acc, v) => acc + v, 0),
    [oroBanco]
  );

  const balancesPorJugador = useMemo(() => {
    const base: Record<
      PlayerId,
      { usdPendiente: number; tienePendiente: boolean }
    > = {
      alan: { usdPendiente: 0, tienePendiente: false },
      carlitos: { usdPendiente: 0, tienePendiente: false },
      criss: { usdPendiente: 0, tienePendiente: false },
      foquita: { usdPendiente: 0, tienePendiente: false },
      tommy: { usdPendiente: 0, tienePendiente: false },
    };

    withdrawals.forEach((w) => {
      if (w.estado === 'pendiente') {
        base[w.playerId].usdPendiente += w.usd;
        base[w.playerId].tienePendiente = true;
      }
    });

    return base;
  }, [withdrawals]);

  const totalUsdPendiente = useMemo(
    () =>
      withdrawals
        .filter((w) => w.estado === 'pendiente')
        .reduce((acc, w) => acc + w.usd, 0),
    [withdrawals]
  );

  const cambiarOroManual = (playerId: PlayerId, valor: number) => {
    const limpio = isNaN(valor) ? 0 : Math.max(0, Math.floor(valor));
    setOroBanco((prev) => ({
      ...prev,
      [playerId]: limpio,
    }));
  };

  const abrirModalRetiro = () => {
    setModalAbierto(true);
    setModalTasa(tasaOroUsd);
    setRetirosDraft({
      alan: 0,
      carlitos: 0,
      criss: 0,
      foquita: 0,
      tommy: 0,
    });
  };

  const cerrarModalRetiro = () => {
    setModalAbierto(false);
  };

  const cambiarDraftJugador = (playerId: PlayerId, valor: number) => {
    const limpio = isNaN(valor) ? 0 : Math.max(0, Math.floor(valor));
    setRetirosDraft((prev) => ({
      ...prev,
      [playerId]: limpio,
    }));
  };

  const confirmarRetiro = () => {
    const tasaAplicada = modalTasa ?? tasaOroUsd;

    const hayAlgo = PLAYERS.some((p) => retirosDraft[p.id] > 0);
    if (!hayAlgo) {
      alert('Pon al menos un retiro mayor a 0.');
      return;
    }

    for (const p of PLAYERS) {
      const cant = retirosDraft[p.id];
      if (cant > oroBanco[p.id]) {
        alert(
          `No hay suficiente ${unidadLabel} en el banco para ${p.nombre}. Disponible: ${oroBanco[p.id]}, pedido: ${cant}`
        );
        return;
      }
    }

    const ahora = new Date().toISOString();
    const nuevos: Withdrawal[] = [];
    const nuevoOroBanco: Record<PlayerId, number> = { ...oroBanco };

    for (const p of PLAYERS) {
      const cant = retirosDraft[p.id];
      if (cant <= 0) continue;

      const usd = cant * tasaAplicada;
      nuevoOroBanco[p.id] = nuevoOroBanco[p.id] - cant;

      nuevos.push({
        id: crypto.randomUUID(),
        playerId: p.id,
        nombre: p.nombre,
        oro: cant,
        tasa: tasaAplicada,
        usd,
        fecha: ahora,
        estado: 'pendiente',
      });
    }

    setOroBanco(nuevoOroBanco);
    setTasaOroUsd(tasaAplicada);
    setWithdrawals((prev) => [...nuevos, ...prev]);
    cerrarModalRetiro();
  };

  const cambiarEstadoBalance = (
    playerId: PlayerId,
    nuevoEstado: 'Pagado' | 'Pendiente'
  ) => {
    const estadoInterno: WithdrawalStatus =
      nuevoEstado === 'Pagado' ? 'pagado' : 'pendiente';

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.playerId === playerId ? { ...w, estado: estadoInterno } : w
      )
    );
  };

  const cambiarEstadoHistorial = (id: string, estado: WithdrawalStatus) => {
    setWithdrawals((prev) =>
      prev.map((w) => (w.id === id ? { ...w, estado } : w))
    );
  };

  const limpiarHistorial = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar el historial completo?')) {
      setWithdrawals([]);
    }
  };

  const formatearFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatearNumero = (n: number, decimales = 2) =>
    n.toLocaleString('es-MX', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });

  // Sincronizar automáticamente cada 5 minutos
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (withdrawals.length > 0) {
        sincronizarConSheet();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(intervalo);
  }, [withdrawals]);

  return (
    <main className="page">
      <div className="layout">
        <header className="hero">
          <h1>El Gordo supplier</h1>
          <p>Control de {unidadLabel}, retiros y balance del grupo.</p>
        </header>

        <section className="top-controls">
          <div className="control-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
              <div>
                <p className="caption">
                  Ratio actual:{' '}
                  <strong>
                    1 {unidadLabel} = {formatearNumero(tasaOroUsd, 3)} {simboloUsd}
                  </strong>
                </p>

               

                <label>
                  Moneda
                  <div className="input-row">
                    
                   USD
                    
                    
                  </div>
                </label>

                <p className="caption">
                  Total {unidadLabel} en banco: <strong>{totalOroBanco}</strong>
                </p>
                <p className="caption">
                  Total pendiente:{' '}
                  <strong>
                    {formatearNumero(totalUsdPendiente)} {simboloUsd}
                  </strong>
                </p>
              </div>
              <div style={{ textAlign: 'right', minWidth: '140px' }}>
                <button
                  onClick={sincronizarConSheet}
                  disabled={sincronizando}
                  className="btn-sync"
                  title="Sincronizar datos con Google Sheets"
                >
                  {sincronizando ? '⏳ Sincronizando...' : '☁️ Sincronizar'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/load');
                      const json = await res.json();
                      console.log('remote rows', json);
                      alert('Datos remotos en consola');
                    } catch (e) {
                      console.error(e);
                      alert('Error cargando datos remotos');
                    }
                  }}
                  className="btn-sync"
                  style={{ marginLeft: '8px' }}
                >
                  📝 Ver remotos
                </button>
                {ultimaSincronizacion && (
                  <p className="caption" style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af' }}>
                    Última: {ultimaSincronizacion}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="panels">
          {/* Banco */}
          <section className="panel">
            <div className="panel-header banco panel-header-flex">
              <h2>Banco</h2>
              <button
                type="button"
                className="btn-primary"
                onClick={abrirModalRetiro}
              >
                Retirar
              </button>
            </div>
            <div className="panel-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>{unidadLabel}</th>
                    <th></th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAYERS.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>
                        <input
                          className="input-oro"
                          type="number"
                          min={0}
                          step={1}
                          value={oroBanco[p.id]}
                          onChange={(e) =>
                            cambiarOroManual(
                              p.id,
                              parseFloat(e.target.value || '0')
                            )
                          }
                        />
                      </td>
                      <td>
                        <span className="badge">{unidadLabel}</span>
                      </td>
                      <td>{oroBanco[p.id]}</td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td colSpan={3}>Total {unidadLabel} en banco</td>
                    <td>{totalOroBanco}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Balance */}
          <section className="panel">
            <div className="panel-header balance">
              <h2>Balance</h2>
            </div>
            <div className="panel-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Monto</th>
                    <th>Moneda</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAYERS.map((p) => {
                    const data = balancesPorJugador[p.id];
                    const usdPendiente = data.usdPendiente;
                    const tienePendiente = data.tienePendiente;
                    const estadoTexto = tienePendiente ? 'Pendiente' : 'Pagado';

                    return (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>{formatearNumero(usdPendiente)}</td>
                        <td>{simboloUsd}</td>
                        <td>
                          <select
                            value={estadoTexto}
                            onChange={(e) =>
                              cambiarEstadoBalance(
                                p.id,
                                e.target.value as 'Pagado' | 'Pendiente'
                              )
                            }
                          >
                            <option value="Pagado">Pagado</option>
                            <option value="Pendiente">Pendiente</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="fila-total">
                    <td>Total</td>
                    <td>{formatearNumero(totalUsdPendiente)}</td>
                    <td>{simboloUsd}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        {/* Historial */}
        <section className="panel panel-history">
          <div className="panel-header history">
            <h2>Historial de retiros</h2>
            {withdrawals.length > 0 && (
              <button onClick={limpiarHistorial} className="btn-clear-history">
                Limpiar historial
              </button>
            )}
          </div>
          <div className="panel-body">
            {withdrawals.length === 0 ? (
              <p className="caption">Todavía no hay retiros.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th>{unidadLabel}</th>
                    <th>Tasa</th>
                    <th>Monto ({simboloUsd})</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td>{formatearFecha(w.fecha)}</td>
                      <td>{w.nombre}</td>
                      <td>{w.oro}</td>
                      <td>{formatearNumero(w.tasa, 3)}</td>
                      <td>{formatearNumero(w.usd)}</td>
                      <td>
                        <select
                          value={w.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                          onChange={(e) =>
                            cambiarEstadoHistorial(
                              w.id,
                              e.target.value === 'Pagado'
                                ? 'pagado'
                                : 'pendiente'
                            )
                          }
                        >
                          <option value="Pagado">Pagado</option>
                          <option value="Pendiente">Pendiente</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Modal de retiro múltiple */}
        {modalAbierto && (
          <div className="modal-backdrop" onClick={cerrarModalRetiro}>
            <div
              className="modal modal-large"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Retirar {unidadLabel}</h3>
              <p className="caption">
                Define cuánto {unidadLabel} retira cada persona. El ratio solo se
                aplica y se guarda cuando confirmas.
              </p>

              <label>
                Ratio (1 {unidadLabel} = ? {simboloUsd})
                <input
                  type="number"
                  step={0.01}
                  value={modalTasa ?? tasaOroUsd}
                  onChange={(e) =>
                    setModalTasa(parseFloat(e.target.value || '0'))
                  }
                />
              </label>

              <table className="table modal-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Disponible</th>
                    <th>{unidadLabel} a retirar</th>
                    <th>Monto estimado ({simboloUsd})</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAYERS.map((p) => {
                    const cant = retirosDraft[p.id] || 0;
                    const disponible = oroBanco[p.id] || 0;
                    const tasa = modalTasa ?? tasaOroUsd;
                    const usd = cant * tasa;

                    return (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>{disponible}</td>
                        <td>
                          <input
                            className="input-oro"
                            type="number"
                            min={0}
                            step={1}
                            value={cant}
                            onChange={(e) =>
                              cambiarDraftJugador(
                                p.id,
                                parseFloat(e.target.value || '0')
                              )
                            }
                          />
                        </td>
                        <td>{formatearNumero(usd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="modal-actions">
                <button type="button" onClick={cerrarModalRetiro}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmarRetiro}
                >
                  Confirmar retiros
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}