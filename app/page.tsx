'use client';

import { useEffect, useMemo, useState, useRef } from 'react';

type PlayerId = string;

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
  fecha?: string | null;
  estado?: WithdrawalStatus;
  actor?: string;
};

type BankHistoryEntry = {
  id: string;
  playerId: PlayerId;
  nombre: string;
  delta: number;
  tipo: 'ajuste' | 'suma' | 'resta' | 'retiro';
  fecha: string;
  balance: number;
  actor?: string;
};

type AppUser = {
  username: string;
  password: string;
  nombre?: string;
  permissions?: {
    manageUsers?: boolean;
    manageMembers?: boolean;
    modifyBank?: boolean;
    retirar?: boolean;
    sync?: boolean;
  };
};

const DEFAULT_PLAYERS: Player[] = [
  { id: 'alan', nombre: 'Alan' },
  { id: 'carlitos', nombre: 'Carlitos' },
  { id: 'criss', nombre: 'Criss' },
  { id: 'foquita', nombre: 'Foquita' },
  { id: 'tommy', nombre: 'Tommy' },
];

export default function HomePage() {
  const [members, setMembers] = useState<Player[]>(DEFAULT_PLAYERS);
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
  const [bankHistory, setBankHistory] = useState<BankHistoryEntry[]>([]);
  const [historialTab, setHistorialTab] = useState<'retiros' | 'banco'>('retiros');
  const [yaCargoDelSheet, setYaCargoDelSheet] = useState(false);
  const pendingSyncRef = useRef<{
    withdrawals: Withdrawal[];
    oroBanco: Record<PlayerId, number>;
    members: Player[];
    bankHistory?: BankHistoryEntry[];
  } | null>(null);

  // Autenticación simple (usuarios locales)
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // asegurar usuario admin por defecto si no existen usuarios
  useEffect(() => {
    if (!users || users.length === 0) {
      const defaultAdmin: AppUser = {
        username: 'admin',
        password: 'admin',
        nombre: 'Administrador',
        permissions: {
          manageUsers: true,
          manageMembers: true,
          modifyBank: true,
          retirar: true,
          sync: true,
        },
      };
      const crissUser: AppUser = {
        username: 'Crissxp',
        password: 'Criss154',
        nombre: 'Crissxp',
        permissions: {
          manageUsers: true,
          manageMembers: true,
          modifyBank: true,
          retirar: true,
          sync: true,
        },
      };
      setUsers([defaultAdmin, crissUser]);
    }
  }, []);

  // restaurar sesión si hay usuario guardado en localStorage
  useEffect(() => {
    const s = localStorage.getItem('currency-grupo-currentUser');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && parsed.username && users && users.length > 0) {
          const found = users.find((u) => u.username === parsed.username);
          if (found) setCurrentUser(found);
        }
      } catch {}
    }
  }, [users]);

  // Modal de miembros
  const [modalMiembrosAbierto, setModalMiembrosAbierto] = useState(false);
  const [miembroEnEdicion, setMiembroEnEdicion] = useState<Player | null>(null);
  const [nuevoMiembroNombre, setNuevoMiembroNombre] = useState('');

  // Modal para modificar oro
  const [modalModificarOroAbierto, setModalModificarOroAbierto] = useState(false);
  const [jugadorEnModificacion, setJugadorEnModificacion] = useState<Player | null>(null);
  const [cantidadTemporal, setCantidadTemporal] = useState<number>(0);

  // Modal para sumar/restar oro
  const [modalSumaRestaAbierto, setModalSumaRestaAbierto] = useState(false);
  const [jugadorSumaResta, setJugadorSumaResta] = useState<Player | null>(null);
  const [tipoOperacion, setTipoOperacion] = useState<'suma' | 'resta'>('suma');
  const [cantidadSumaResta, setCantidadSumaResta] = useState<number>(0);

  // Cargar desde localStorage al montar
  useEffect(() => {
    const guardado = localStorage.getItem('currency-grupo-data');
    if (guardado) {
      try {
        const datos = JSON.parse(guardado);
        if (datos.members) {
          setMembers(datos.members);
        }
        setWithdrawals(datos.withdrawals || []);
        setOroBanco(datos.oroBanco || {
          alan: 0,
          carlitos: 0,
          criss: 0,
          foquita: 0,
          tommy: 0,
        });
        setTasaOroUsd(datos.tasaOroUsd || 0.03);
        setBankHistory(datos.bankHistory || []);
          // cargar usuarios y sesión
          if (datos.users) {
            setUsers(datos.users);
          }
          if (datos.currentUser) {
            // buscar usuario por username
            const u = (datos.currentUser.username && datos.currentUser.username) ? datos.currentUser.username : null;
            if (u) {
              const found = (datos.users || []).find((x: any) => x.username === u);
              if (found) setCurrentUser(found);
            }
          }
        const ultima = localStorage.getItem('currency-grupo-ultima-sync');
        if (ultima) setUltimaSincronizacion(ultima);
      } catch (e) {
        console.error('Error cargando datos:', e);
      }
    }
  }, []);

  // cargar datos una sola vez al montar el componente
  useEffect(() => {
    if (!yaCargoDelSheet) {
      loadFromSheet();
      setYaCargoDelSheet(true);
    }
  }, [yaCargoDelSheet]);

  // Guardar en localStorage cada vez que cambian los datos principales
  useEffect(() => {
    localStorage.setItem('currency-grupo-data', JSON.stringify({
      withdrawals,
      oroBanco,
      tasaOroUsd,
      bankHistory,
      members,
      users,
      currentUser,
    }));
  }, [withdrawals, oroBanco, tasaOroUsd, bankHistory, members, users, currentUser]);

  // Sincronizar con Google Sheets
  const sincronizarConSheet = async (
    currentWithdrawals: Withdrawal[] = withdrawals,
    currentBank: Record<PlayerId, number> = oroBanco,
    currentMembers: Player[] = members,
    showAlert = true
  ) => {
    setSincronizando(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          withdrawals: currentWithdrawals,
          oroBanco: currentBank,
          members: currentMembers,
          users,
          bankHistory,
        }),
      });

      if (response.ok) {
        const ahora = new Date().toLocaleString('es-MX');
        setUltimaSincronizacion(ahora);
        localStorage.setItem('currency-grupo-ultima-sync', ahora);
        if (showAlert) alert('✅ Datos sincronizados con Google Sheets');
      } else {
        if (showAlert) alert('❌ Error al sincronizar');
      }
    } catch (error) {
      console.error('Error sincronizando:', error);
      if (showAlert) alert('❌ No se pudo conectar al servidor');
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
        // si la hoja contiene una lista de miembros guardada, úsala
        if (json.members && Array.isArray(json.members)) {
          try {
            const sheetMembers = json.members as Player[];
            setMembers(sheetMembers);
            // asegurar retirosDraft y oroBanco para cada miembro
            setRetirosDraft((prevDraft) => {
              const next = { ...prevDraft } as Record<PlayerId, number>;
              sheetMembers.forEach((m) => {
                if (!(m.id in next)) next[m.id] = 0;
              });
              return next;
            });
            setOroBanco((prev) => {
              const next = { ...prev } as Record<PlayerId, number>;
              sheetMembers.forEach((m) => {
                if (!(m.id in next)) next[m.id] = 0;
              });
              return next;
            });
          } catch {}
        }
        // cargar usuarios si vienen desde el sheet
        if (json.users && Array.isArray(json.users)) {
          try {
            setUsers(json.users);
          } catch {}
        }

        // cargar historial del banco si viene
        if (json.bankHistory && Array.isArray(json.bankHistory)) {
          try {
            setBankHistory(json.bankHistory);
          } catch {}
        }
        if (json.oroBanco) {
          // sincronizamos el estado del banco con lo remoto
          const bank = json.oroBanco as Record<string, number>;

          setOroBanco((prev) => ({ ...prev, ...bank }));

          // Añadir miembros ausentes basados en las claves de oroBanco (ej: 'panchito')
          setMembers((prevMembers) => {
            const missing = Object.keys(bank).filter((id) => !prevMembers.some((m) => m.id === id));
            if (missing.length === 0) return prevMembers;
            const newPlayers: Player[] = missing.map((id) => ({
              id,
              nombre: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            }));

            // aseguramos retirosDraft para los nuevos jugadores
            setRetirosDraft((prevDraft) => {
              const next = { ...prevDraft } as Record<PlayerId, number>;
              newPlayers.forEach((p) => {
                if (!(p.id in next)) next[p.id] = 0;
              });
              return next;
            });

            return [...prevMembers, ...newPlayers];
          });
        }

        // detectar nombres que vienen en la hoja y que no están en `members`
        const rawRows = (json.data || []).filter((r: any) => r && r.fecha && r.nombre);
        const namesInSheet = Array.from(new Set(rawRows.map((r: any) => r.nombre))) as string[];
        const missingNames = namesInSheet.filter((n: string) => !members.some((m) => m.nombre === n));

        // crear jugadores faltantes y actualizar estados locales para incluirlos
        let membersForLookup: Player[] = members;
        if (missingNames.length > 0) {
          const newPlayers: Player[] = missingNames.map((name) => {
            const id = name.toLowerCase().replace(/\s+/g, '_');
            return { id, nombre: name };
          });
          const updatedMembers = [...members, ...newPlayers];
          setMembers(updatedMembers);
          membersForLookup = updatedMembers;

          setOroBanco((prev) => {
            const next = { ...prev } as Record<PlayerId, number>;
            newPlayers.forEach((p) => {
              if (!(p.id in next)) next[p.id] = 0;
            });
            return next;
          });

          setRetirosDraft((prev) => {
            const next = { ...prev } as Record<PlayerId, number>;
            newPlayers.forEach((p) => {
              if (!(p.id in next)) next[p.id] = 0;
            });
            return next;
          });
        }

        // convertir a Withdrawal usando la lista actualizada de miembros (si hubo nuevos, los añadimos arriba)
        const sheetData: Withdrawal[] = rawRows.map((r: any) => {
          const nombre: string = r.nombre;
          const found = membersForLookup.find((p) => p.nombre === nombre);
          const id = (found && found.id) || nombre.toLowerCase().replace(/\s+/g, '_');

          return {
            id: r.fecha + nombre,
            playerId: id as PlayerId,
            nombre,
            oro: r.oro,
            tasa:
              r.tasa !== undefined && r.tasa !== null
                ? (typeof r.tasa === 'number' ? r.tasa : parseFloat(r.tasa))
                : tasaOroUsd,
            usd: r.usd,
            fecha: r.fecha,
            estado: r.estado || 'pendiente',
          } as Withdrawal;
        });
        // solo actualizamos si hay diferencias reales para no borrar cambios
        setWithdrawals((prev) => {
          const prevStr = JSON.stringify(prev);
          const newStr = JSON.stringify(sheetData);
          return prevStr === newStr ? prev : sheetData;
        });
        // actualizar localStorage inmediatamente con los datos cargados del sheet
        try {
          const bankObj = (json.oroBanco && typeof json.oroBanco === 'object') ? json.oroBanco as Record<string, number> : {};
          const membersFromRow = Array.isArray(json.members) ? (json.members as Player[]) : null;
          // construir lista final de members para almacenar localmente
          const mergedMembers: Player[] = [];

          // empezar con membersFromRow si existe, sino con los miembros actuales
          if (membersFromRow) {
            membersFromRow.forEach((m) => mergedMembers.push(m));
          } else {
            members.forEach((m) => mergedMembers.push(m));
          }

          // añadir claves del bank si faltan
          Object.keys(bankObj).forEach((id) => {
            if (!mergedMembers.some((mm) => mm.id === id)) {
              mergedMembers.push({ id, nombre: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) });
            }
          });

          // añadir nombres detectados en filas si faltan
          namesInSheet.forEach((name) => {
            if (!mergedMembers.some((mm) => mm.nombre === name)) {
              mergedMembers.push({ id: name.toLowerCase().replace(/\s+/g, '_'), nombre: name });
            }
          });

          localStorage.setItem('currency-grupo-data', JSON.stringify({
            withdrawals: sheetData,
            oroBanco: bankObj,
            tasaOroUsd,
            members: mergedMembers,
          }));
        } catch (e) {
          console.error('Error writing sheet data to localStorage', e);
        }
      }
    } catch (e) {
      console.error('load from sheet failed', e);
    }
  };

    

  // Fijo: nombre de la unidad
  const unidadLabel = 'oro';

  // --- Autenticación: funciones ---
  const handleLogin = (username: string, password: string) => {
    const found = users.find((u) => u.username === username && u.password === password);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('currency-grupo-currentUser', JSON.stringify({ username: found.username }));
      setLoginOpen(false);
      setLoginUser('');
      setLoginPass('');
      return true;
    }
    alert('Usuario o contraseña incorrectos');
    return false;
  };

  const handleCreateUser = (user: AppUser) => {
    if (users.some((u) => u.username === user.username)) {
      alert('El nombre de usuario ya existe');
      return;
    }
    setUsers((prev) => {
      const next = [user, ...prev];
      void sincronizarConSheet(undefined, undefined, undefined, false);
      return next;
    });
  };

  const handleSaveUser = (user: AppUser) => {
    setUsers((prev) => prev.map((u) => (u.username === user.username ? user : u)));
    if (currentUser && currentUser.username === user.username) {
      setCurrentUser(user);
      localStorage.setItem('currency-grupo-currentUser', JSON.stringify({ username: user.username }));
    }
    void sincronizarConSheet(undefined, undefined, undefined, false);
  };

  const handleDeleteUser = (username: string) => {
    if (!window.confirm(`Eliminar usuario ${username}?`)) return;
    setUsers((prev) => prev.filter((u) => u.username !== username));
    if (currentUser && currentUser.username === username) {
      setCurrentUser(null);
      localStorage.removeItem('currency-grupo-currentUser');
    }
    void sincronizarConSheet(undefined, undefined, undefined, false);
  };

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
    > = {};

    // Inicializar con todos los miembros
    members.forEach((member) => {
      base[member.id] = { usdPendiente: 0, tienePendiente: false };
    });

    withdrawals.forEach((w) => {
      if (w.estado === 'pendiente' && w.playerId && base[w.playerId]) {
        base[w.playerId].usdPendiente += w.usd;
        base[w.playerId].tienePendiente = true;
      }
    });

    return base;
  }, [withdrawals, members]);

  const totalUsdPendiente = useMemo(
    () =>
      withdrawals
        .filter((w) => w.estado === 'pendiente')
        .reduce((acc, w) => acc + w.usd, 0),
    [withdrawals]
  );

  const cambiarOroManual = (playerId: PlayerId, valor: number) => {
    const limpio = isNaN(valor) ? 0 : Math.max(0, Math.floor(valor));
    const nuevoBanco = { ...oroBanco, [playerId]: limpio };
    setOroBanco(nuevoBanco);
    // mark pending state so save sends the latest values
    pendingSyncRef.current = { withdrawals, oroBanco: nuevoBanco, members };
  };

  const abrirModalModificarOro = (player: Player) => {
    setJugadorEnModificacion(player);
    setCantidadTemporal(oroBanco[player.id] || 0);
    setModalModificarOroAbierto(true);
  };

  const cerrarModalModificarOro = () => {
    setModalModificarOroAbierto(false);
    setJugadorEnModificacion(null);
    setCantidadTemporal(0);
  };

  const agregarOro = () => {
    if (jugadorEnModificacion) {
      const nuevaCantidad = cantidadTemporal + 1;
      cambiarOroManual(jugadorEnModificacion.id, nuevaCantidad);
      setCantidadTemporal(nuevaCantidad);
    }
  };

  const quitarOro = () => {
    if (jugadorEnModificacion) {
      const nuevaCantidad = Math.max(0, cantidadTemporal - 1);
      cambiarOroManual(jugadorEnModificacion.id, nuevaCantidad);
      setCantidadTemporal(nuevaCantidad);
    }
  };

  const confirmarModificacionOro = () => {
    if (jugadorEnModificacion) {
      const limpio = isNaN(cantidadTemporal) ? 0 : Math.max(0, Math.floor(cantidadTemporal));
      const previo = oroBanco[jugadorEnModificacion.id] ?? 0;
      const delta = limpio - previo;
      cambiarOroManual(jugadorEnModificacion.id, limpio);
      if (delta !== 0) {
        const entry: BankHistoryEntry = {
          id: crypto.randomUUID(),
          playerId: jugadorEnModificacion.id,
          nombre: jugadorEnModificacion.nombre,
          delta,
          tipo: 'ajuste',
          fecha: new Date().toISOString(),
          balance: limpio,
          actor: currentUser?.username || undefined,
        };
        setBankHistory((prev) => [entry, ...prev]);
      }
      cerrarModalModificarOro();
    }
  };

  const abrirModalSumaResta = (player: Player, operacion: 'suma' | 'resta') => {
    setJugadorSumaResta(player);
    setTipoOperacion(operacion);
    setCantidadSumaResta(0);
    setModalSumaRestaAbierto(true);
  };

  const cerrarModalSumaResta = () => {
    setModalSumaRestaAbierto(false);
    setJugadorSumaResta(null);
    setCantidadSumaResta(0);
  };

  const confirmarSumaResta = () => {
    if (jugadorSumaResta && cantidadSumaResta > 0) {
      const cantidadLimpia = Math.max(0, Math.floor(cantidadSumaResta));
      const valorActual = oroBanco[jugadorSumaResta.id] || 0;
      let nuevoValor = valorActual;

      if (tipoOperacion === 'suma') {
        nuevoValor = valorActual + cantidadLimpia;
      } else {
        nuevoValor = Math.max(0, valorActual - cantidadLimpia);
      }

      cambiarOroManual(jugadorSumaResta.id, nuevoValor);
      const delta = nuevoValor - valorActual;
      if (delta !== 0) {
        const entry: BankHistoryEntry = {
          id: crypto.randomUUID(),
          playerId: jugadorSumaResta.id,
          nombre: jugadorSumaResta.nombre,
          delta,
          tipo: tipoOperacion === 'suma' ? 'suma' : 'resta',
          fecha: new Date().toISOString(),
          balance: nuevoValor,
          actor: currentUser?.username || undefined,
        };
        setBankHistory((prev) => [entry, ...prev]);
      }
      cerrarModalSumaResta();
    }
  };

  const abrirModalRetiro = () => {
    setModalAbierto(true);
    setModalTasa(tasaOroUsd);
    
    // Inicializar retirosDraft con todos los miembros
    const nuevoRetirosDraft: Record<PlayerId, number> = {};
    members.forEach((member) => {
      nuevoRetirosDraft[member.id] = 0;
    });
    setRetirosDraft(nuevoRetirosDraft);
    
    // Asegurar que oroBanco tenga todos los miembros inicializados en 0
    setOroBanco((prev) => {
      const nuevoOroBanco = { ...prev };
      members.forEach((member) => {
        if (!(member.id in nuevoOroBanco)) {
          nuevoOroBanco[member.id] = 0;
        }
      });
      return nuevoOroBanco;
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
    const tasaAplicada = modalTasa !== null && modalTasa !== undefined ? modalTasa : tasaOroUsd;

    const hayAlgo = members.some((p) => retirosDraft[p.id] > 0);
    if (!hayAlgo) {
      alert('Pon al menos un retiro mayor a 0.');
      return;
    }

    for (const p of members) {
      const cant = retirosDraft[p.id];
      const disponible = oroBanco[p.id] ?? 0;
      if (cant > disponible) {
        alert(
          `No hay suficiente ${unidadLabel} en el banco para ${p.nombre}. Disponible: ${disponible}, pedido: ${cant}`
        );
        return;
      }
    }

    const ahora = new Date().toISOString();
    const nuevos: Withdrawal[] = [];
    const nuevoOroBanco: Record<PlayerId, number> = { ...oroBanco };

    for (const p of members) {
      const cant = retirosDraft[p.id];
      if (cant <= 0) continue;

      const usd = cant * tasaAplicada;
      const saldoActual = nuevoOroBanco[p.id] ?? 0;
      nuevoOroBanco[p.id] = saldoActual - cant;

      nuevos.push({
        id: crypto.randomUUID(),
        playerId: p.id,
        nombre: p.nombre,
        oro: cant,
        tasa: tasaAplicada,
        usd,
        fecha: ahora,
        estado: 'pendiente',
        actor: currentUser?.username || undefined,
      });
      // registrar en historial del banco la resta por retiro
      const histEntry: BankHistoryEntry = {
        id: crypto.randomUUID(),
        playerId: p.id,
        nombre: p.nombre,
        delta: -cant,
        tipo: 'retiro',
        fecha: ahora,
        balance: nuevoOroBanco[p.id],
        actor: currentUser?.username || undefined,
      };
      setBankHistory((prev) => [histEntry, ...prev]);
    }

    // aplicar cambios locales
    setOroBanco(nuevoOroBanco);
    setTasaOroUsd(tasaAplicada);
    const nuevosState = [...nuevos, ...withdrawals];
    setWithdrawals(nuevosState);
    // marcar pending para que el botón Guardar use esta versión si se presiona inmediatamente
    pendingSyncRef.current = { withdrawals: nuevosState, oroBanco: nuevoOroBanco, members };
    cerrarModalRetiro();
  };

  const cambiarEstadoBalance = (
    playerId: PlayerId,
    nuevoEstado: 'Pagado' | 'Pendiente'
  ) => {
    const estadoInterno: WithdrawalStatus =
      nuevoEstado === 'Pagado' ? 'pagado' : 'pendiente';

    const nuevos = withdrawals.map((w) =>
      w.playerId === playerId ? { ...w, estado: estadoInterno } : w
    );
    setWithdrawals(nuevos);
    pendingSyncRef.current = { withdrawals: nuevos, oroBanco, members };
  };

  const cambiarEstadoHistorial = (id: string, estado: WithdrawalStatus) => {
    const nuevos = withdrawals.map((w) => (w.id === id ? { ...w, estado } : w));
    setWithdrawals(nuevos);
    pendingSyncRef.current = { withdrawals: nuevos, oroBanco, members };
  };

  // Funciones para manejar miembros
  const abrirModalMiembros = () => {
    setModalMiembrosAbierto(true);
    setMiembroEnEdicion(null);
    setNuevoMiembroNombre('');
  };

  const cerrarModalMiembros = () => {
    setModalMiembrosAbierto(false);
    setMiembroEnEdicion(null);
    setNuevoMiembroNombre('');
  };

  const agregarMiembro = () => {
    if (!nuevoMiembroNombre.trim()) {
      alert('Por favor ingresa un nombre para el miembro');
      return;
    }

    const nombreExistente = members.some(
      (m) => m.nombre.toLowerCase() === nuevoMiembroNombre.toLowerCase()
    );
    if (nombreExistente) {
      alert('Este miembro ya existe');
      return;
    }

    const nuevoId = nuevoMiembroNombre.toLowerCase().replace(/\s+/g, '_');
    const nuevoMiembro: Player = { id: nuevoId, nombre: nuevoMiembroNombre };
    
    // Actualizar todo de una vez para evitar inconsistencias
    setMembers((prevMembers) => [...prevMembers, nuevoMiembro]);
    setOroBanco((prev) => ({
      ...prev,
      [nuevoId]: 0,
    }));
    setRetirosDraft((prev) => ({
      ...prev,
      [nuevoId]: 0,
    }));

    setNuevoMiembroNombre('');
  };

  const editarMiembro = (memberActual: Player) => {
    setMiembroEnEdicion(memberActual);
    setNuevoMiembroNombre(memberActual.nombre);
  };

  const guardarEdicionMiembro = () => {
    if (!nuevoMiembroNombre.trim()) {
      alert('Por favor ingresa un nombre para el miembro');
      return;
    }

    if (miembroEnEdicion) {
      const nombreExistente = members.some(
        (m) =>
          m.nombre.toLowerCase() === nuevoMiembroNombre.toLowerCase() &&
          m.id !== miembroEnEdicion.id
      );
      if (nombreExistente) {
        alert('Este nombre ya existe en otro miembro');
        return;
      }

      setMembers(
        members.map((m) =>
          m.id === miembroEnEdicion.id ? { ...m, nombre: nuevoMiembroNombre } : m
        )
      );

      setMiembroEnEdicion(null);
      setNuevoMiembroNombre('');
    }
  };

  const eliminarMiembro = (memberId: PlayerId) => {
    if (!currentUser?.permissions?.manageMembers) {
      alert('No tienes permiso para eliminar miembros');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este miembro?')) {
      setMembers(members.filter((m) => m.id !== memberId));

      // Eliminar del banco de oro
      setOroBanco((prev) => {
        const newBanco = { ...prev };
        delete newBanco[memberId];
        return newBanco;
      });

      // Eliminar del estado de retiros draft
      setRetirosDraft((prev) => {
        const newDraft = { ...prev };
        delete newDraft[memberId];
        return newDraft;
      });
    }
  };

  const handleGuardar = async () => {
    const toSend = pendingSyncRef.current
      ? { withdrawals: pendingSyncRef.current.withdrawals, oro: pendingSyncRef.current.oroBanco, members: pendingSyncRef.current.members }
      : { withdrawals, oro: oroBanco, members };

    await sincronizarConSheet(toSend.withdrawals, toSend.oro, toSend.members, true);
    // limpiar pending al terminar
    pendingSyncRef.current = null;
  };

  const limpiarHistorial = () => {
    if (!currentUser?.permissions?.manageUsers) {
      alert('Solo administradores pueden limpiar el historial');
      return;
    }
    if (window.confirm('¿Estás seguro de que quieres limpiar el historial completo?')) {
      setWithdrawals([]);
      pendingSyncRef.current = { withdrawals: [], oroBanco, members };
    }
  };

  const limpiarHistorialBanco = () => {
    if (!currentUser?.permissions?.manageUsers) {
      alert('Solo administradores pueden limpiar el historial del banco');
      return;
    }
    if (window.confirm('¿Limpiar historial de operaciones del banco?')) {
      setBankHistory([]);
    }
  };

  const formatearFecha = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  };

  const formatearNumero = (n: number | null | undefined, decimales = 2) => {
    if (n == null || isNaN(n)) return '';
    return n.toLocaleString('es-MX', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  };

  if (!currentUser) {
    return (
      <main className="page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#04050a 0%, #071021 100%)' }}>
        <div style={{ width: '520px', padding: '40px 56px 40px 36px', borderRadius: '14px', background: 'linear-gradient(180deg,#071021 0%, #081127 100%)', boxShadow: '0 12px 40px rgba(2,6,23,0.8)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.03)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: '20px' }}>Iniciar sesión</h2>
          <p className="caption" style={{ marginTop: 0, marginBottom: 18, color: '#9ca3af' }}>Ingresa tu usuario y contraseña para continuar.</p>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Usuario</div>
            <input value={loginUser} onChange={(e)=>setLoginUser(e.target.value)} style={{ width: '100%', marginTop: '0', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', color: '#e5e7eb', outline: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }} />
          </label>
          <label style={{ display: 'block', marginBottom: '18px' }}>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Contraseña</div>
            <input type="password" value={loginPass} onChange={(e)=>setLoginPass(e.target.value)} style={{ width: '100%', marginTop: '0', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', color: '#e5e7eb', outline: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }} />
          </label>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingRight: 20 }}>
            <button
              onClick={() => { setLoginUser(''); setLoginPass(''); }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: '#e5e7eb', cursor: 'pointer' }}
            >
              Limpiar
            </button>
            <button
              className="btn-primary"
              onClick={() => handleLogin(loginUser, loginPass)}
              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#fb923c', color: '#071019', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(251,146,60,0.18)', transition: 'transform 0.12s ease' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 30px rgba(251,146,60,0.22)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(251,146,60,0.18)'; }}
            >
              Entrar
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="layout">
        <header className="hero" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '20px', padding: '32px 48px' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h1 style={{ margin: 0 }}>El Gordo supplier</h1>
            <p style={{ margin: '6px 0 0 0' }}>Control de {unidadLabel}, retiros y balance del grupo.</p>
          </div>

          <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentUser ? (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 120 }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>Usuario</span>
                    <strong style={{ fontSize: '13px', color: '#e5e7eb' }}>{currentUser.nombre || currentUser.username}</strong>
                  </div>
                  <button
                    onClick={() => setMenuOpen((s) => !s)}
                    aria-label="Abrir menú"
                    style={{
                      width: 42,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: '#06080b',
                      color: '#e5e7eb',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect y="1" width="18" height="2" rx="1" fill="currentColor" />
                      <rect y="6" width="18" height="2" rx="1" fill="currentColor" />
                      <rect y="11" width="18" height="2" rx="1" fill="currentColor" />
                    </svg>
                  </button>
                </div>

                {menuOpen && (
                  <div onMouseLeave={() => setMenuOpen(false)} style={{ position: 'absolute', right: 12, top: 52, width: 240, background: 'linear-gradient(180deg,#071021 0%, #081127 100%)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, boxShadow: '0 14px 48px rgba(2,6,23,0.85)', zIndex: 40 }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Sesión</div>
                      <div style={{ fontWeight: 700, color: '#e5e7eb', marginTop: 4 }}>{currentUser.nombre || currentUser.username}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentUser.permissions?.manageUsers && (
                        <button onClick={() => { setManageUsersOpen(true); setMenuOpen(false); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: '#e5e7eb', cursor: 'pointer', fontWeight: 600 }} onMouseOver={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.02)'}} onMouseOut={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}>Administrar usuarios</button>
                      )}
                      <button onClick={() => { setCurrentUser(null); localStorage.removeItem('currency-grupo-currentUser'); setMenuOpen(false); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }} onMouseOver={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(239,68,68,0.06)'}} onMouseOut={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='transparent'}}>Cerrar sesión</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setLoginOpen(true)} className="btn-primary">Iniciar sesión</button>
            )}
          </div>
        </header>

        <section className="top-controls" style={{ display: 'none' }}>
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
                <div style={{ textAlign: 'right', minWidth: '200px' }}>
                <button
                  onClick={handleGuardar}
                  disabled={sincronizando || !(currentUser?.permissions?.sync)}
                  className="btn-primary"
                  style={{ marginBottom: '8px' }}
                >
                  {sincronizando ? '⏳ Guardando...' : '💾 Guardar cambios'}
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
              <div style={{ display: 'flex', gap: '12px' }}>
                {currentUser?.permissions?.manageMembers ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={abrirModalMiembros}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  >
                    👥 Miembros
                  </button>
                ) : (
                  <button type="button" disabled style={{ padding: '8px 16px', borderRadius: '6px', opacity: 0.5 }}>Miembros</button>
                )}
                {currentUser?.permissions?.retirar ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={abrirModalRetiro}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  >
                    Retirar
                  </button>
                ) : (
                  <button type="button" disabled style={{ padding: '8px 16px', borderRadius: '6px', opacity: 0.5 }}>Retirar</button>
                )}
              </div>
            </div>
            <div className="panel-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th style={{ width: '100%' }}></th>
                    <th></th>
                    <th>{unidadLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td style={{ width: '100%' }}></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => abrirModalSumaResta(p, 'resta')}
                            disabled={!currentUser?.permissions?.modifyBank}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #ef4444',
                              backgroundColor: currentUser?.permissions?.modifyBank ? '#ef4444' : '#6b7280',
                              color: 'white',
                              cursor: currentUser?.permissions?.modifyBank ? 'pointer' : 'not-allowed',
                              fontSize: '14px',
                              fontWeight: '700',
                              transition: 'all 0.2s ease',
                              minWidth: '32px',
                              textAlign: 'center',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                              e.currentTarget.style.borderColor = '#dc2626';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#ef4444';
                              e.currentTarget.style.borderColor = '#ef4444';
                            }}
                          >
                            −
                          </button>
                          <span style={{ fontWeight: '600', minWidth: '60px', textAlign: 'center', fontSize: '18px' }}>
                            {oroBanco[p.id] ?? 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirModalSumaResta(p, 'suma')}
                            disabled={!currentUser?.permissions?.modifyBank}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #22c55e',
                              backgroundColor: currentUser?.permissions?.modifyBank ? '#22c55e' : '#6b7280',
                              color: 'white',
                              cursor: currentUser?.permissions?.modifyBank ? 'pointer' : 'not-allowed',
                              fontSize: '14px',
                              fontWeight: '700',
                              transition: 'all 0.2s ease',
                              minWidth: '32px',
                              textAlign: 'center',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#16a34a';
                              e.currentTarget.style.borderColor = '#16a34a';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#22c55e';
                              e.currentTarget.style.borderColor = '#22c55e';
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>
                        <span className="badge">{unidadLabel}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td colSpan={2}>Total {unidadLabel} en banco</td>
                    <td style={{ fontSize: '18px', fontWeight: '700', textAlign: 'center' }}>
                      <span>{totalOroBanco}</span>
                    </td>
                    <td style={{ fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>
                      <span className="badge">{unidadLabel}</span>
                    </td>
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
                  {members.map((p) => {
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
                    <td colSpan={2}>Total</td>
                    <td style={{ fontSize: '18px', fontWeight: '700', textAlign: 'center' }}>
                      <span>{formatearNumero(totalUsdPendiente)}</span>
                    </td>
                    <td style={{ fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>
                      <span className="badge">{simboloUsd}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        {/* Botón Guardar Cambios */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', gap: '12px' }}>
          {ultimaSincronizacion && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#9ca3af' }}>
              Última: {ultimaSincronizacion}
            </div>
          )}
          <button
            onClick={handleGuardar}
            disabled={sincronizando || !(currentUser?.permissions?.sync)}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {sincronizando ? '⏳ Guardando...' : '💾 Guardar cambios'}
          </button>
        </div>

        {/* Historial (pestañas) */}
        <section className="panel panel-history">
          <div className="panel-header history" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setHistorialTab('retiros')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: historialTab === 'retiros' ? '1px solid #374151' : '1px solid transparent',
                  backgroundColor: historialTab === 'retiros' ? '#0b1220' : 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Retiros
              </button>
              <button
                type="button"
                onClick={() => setHistorialTab('banco')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: historialTab === 'banco' ? '1px solid #374151' : '1px solid transparent',
                  backgroundColor: historialTab === 'banco' ? '#0b1220' : 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Banco
              </button>
            </div>
            <div>
              {historialTab === 'retiros' && withdrawals.length > 0 && currentUser?.permissions?.manageUsers && (
                <button onClick={limpiarHistorial} className="btn-clear-history">Limpiar historial</button>
              )}
              {historialTab === 'banco' && bankHistory.length > 0 && currentUser?.permissions?.manageUsers && (
                <button onClick={limpiarHistorialBanco} className="btn-clear-history">Limpiar historial banco</button>
              )}
              {((historialTab === 'retiros' && withdrawals.length > 0) || (historialTab === 'banco' && bankHistory.length > 0)) && !currentUser?.permissions?.manageUsers && (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Solo administradores pueden limpiar historiales</span>
              )}
            </div>
          </div>
          <div className="panel-body">
            {historialTab === 'retiros' ? (
              (withdrawals.length === 0 ? (
                <p className="caption">Todavía no hay retiros.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th>{unidadLabel}</th>
                      <th>Tasa</th>
                      <th>Monto ({simboloUsd})</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td>{formatearFecha(w.fecha)}</td>
                        <td>{w.nombre}</td>
                        <td style={{ fontSize: 12, color: '#9ca3af' }}>{w.actor || '-'}</td>
                        <td>{w.oro}</td>
                        <td>{formatearNumero(w.tasa, 3)}</td>
                        <td>{formatearNumero(w.usd)}</td>
                        <td>
                          <select
                            value={w.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                            onChange={(e) =>
                              cambiarEstadoHistorial(
                                w.id,
                                e.target.value === 'Pagado' ? 'pagado' : 'pendiente'
                              )
                            }
                          >
                            <option value="Pagado">Pagado</option>
                            <option value="Pendiente">Pendiente</option>
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {(currentUser?.permissions?.manageMembers || currentUser?.permissions?.modifyBank) ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentUser?.permissions?.manageMembers && !currentUser?.permissions?.modifyBank) {
                                  alert('No tienes permiso para eliminar retiros');
                                  return;
                                }
                                if (window.confirm('¿Estás seguro de que deseas eliminar este retiro?')) {
                                  setWithdrawals(withdrawals.filter((item) => item.id !== w.id));
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
                              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; }}
                            >
                              ✕
                            </button>
                          ) : (
                            <button disabled style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', backgroundColor: '#6b7280', color: 'white', fontSize: '12px', fontWeight: '600', opacity: 0.6 }}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))
            ) : (
              (bankHistory.length === 0 ? (
                <p className="caption">No hay operaciones en el banco aún.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th>Tipo</th>
                      <th>Cambio ({unidadLabel})</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankHistory.map((h) => (
                      <tr key={h.id}>
                        <td>{formatearFecha(h.fecha)}</td>
                        <td>{h.nombre}</td>
                        <td style={{ fontSize: 12, color: '#9ca3af' }}>{h.actor || '-'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{h.tipo}</td>
                        <td style={{ color: h.delta < 0 ? '#ef4444' : '#22c55e' }}>{h.delta}</td>
                        <td>{h.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))
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
                  step="any"
                  value={modalTasa ?? tasaOroUsd}
                  onChange={(e) => {
                    const valor = parseFloat(e.target.value || '0');
                    setModalTasa(isNaN(valor) ? 0 : valor);
                  }}
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
                  {members.map((p) => {
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
                            value={cant === 0 ? '' : cant}
                            onChange={(e) =>
                              cambiarDraftJugador(
                                p.id,
                                parseFloat(e.target.value || '0')
                              )
                            }
                            placeholder="0"
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

        {/* Modal de gestión de miembros */}
        {modalMiembrosAbierto && (
          <div className="modal-backdrop" onClick={cerrarModalMiembros}>
            <div
              className="modal modal-large"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Gestionar Miembros</h3>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '10px', fontWeight: '600' }}>
                  {miembroEnEdicion ? 'Editar Miembro' : 'Agregar Nuevo Miembro'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nombre del miembro"
                    value={nuevoMiembroNombre}
                    onChange={(e) => setNuevoMiembroNombre(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        if (miembroEnEdicion) {
                          guardarEdicionMiembro();
                        } else {
                          agregarMiembro();
                        }
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #374151',
                      fontSize: '14px',
                      color: '#e5e7eb',
                      backgroundColor: '#020617',
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={
                      miembroEnEdicion ? guardarEdicionMiembro : agregarMiembro
                    }
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    {miembroEnEdicion ? 'Guardar' : 'Agregar'}
                  </button>
                  {miembroEnEdicion && (
                    <button
                      type="button"
                      onClick={() => {
                        setMiembroEnEdicion(null);
                        setNuevoMiembroNombre('');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #374151',
                        backgroundColor: '#0b1120',
                        color: '#e5e7eb',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '10px', fontWeight: '600' }}>
                  Miembros Actuales
                </label>
                {members.length === 0 ? (
                  <p className="caption">No hay miembros.</p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {members.map((member) => (
                      <div
                        key={member.id}
                        style={{
                          padding: '12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid #374151',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <p style={{ margin: '0', fontWeight: '600', color: '#e5e7eb', fontSize: '14px' }}>
                            {member.nombre}
                          </p>
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              fontSize: '12px',
                              color: '#9ca3af',
                            }}
                          >
                            {oroBanco[member.id] || 0} {unidadLabel}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => editarMiembro(member)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#2563eb';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#3b82f6';
                            }}
                          >
                            ✎ Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarMiembro(member.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#ef4444';
                            }}
                          >
                            ✕ Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={cerrarModalMiembros}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para modificar oro */}
        {modalModificarOroAbierto && jugadorEnModificacion && (
          <div className="modal-backdrop" onClick={cerrarModalModificarOro}>
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Modificar {unidadLabel} - {jugadorEnModificacion.nombre}</h3>
              <p className="caption">
                Usa los botones para agregar o quitar {unidadLabel}, o ingresa la cantidad directamente.
              </p>

              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px' }}>
                  Cantidad de {unidadLabel}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={quitarOro}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #ef4444',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: '700',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.borderColor = '#dc2626';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                      e.currentTarget.style.borderColor = '#ef4444';
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={cantidadTemporal}
                    onChange={(e) => setCantidadTemporal(parseFloat(e.target.value || '0'))}
                    style={{
                      width: '100px',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #f97316',
                      backgroundColor: '#020617',
                      color: '#e5e7eb',
                      fontSize: '18px',
                      fontWeight: '700',
                      textAlign: 'center',
                    }}
                  />
                  <button
                    type="button"
                    onClick={agregarOro}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #22c55e',
                      backgroundColor: '#22c55e',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: '700',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#16a34a';
                      e.currentTarget.style.borderColor = '#16a34a';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#22c55e';
                      e.currentTarget.style.borderColor = '#22c55e';
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={cerrarModalModificarOro}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmarModificacionOro}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para sumar/restar oro */}
        {modalSumaRestaAbierto && jugadorSumaResta && (
          <div className="modal-backdrop" onClick={cerrarModalSumaResta}>
            <div
              className="modal"
              style={{ maxWidth: '300px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>
                {tipoOperacion === 'suma' ? 'Agregar' : 'Restar'} {unidadLabel} - {jugadorSumaResta.nombre}
              </h3>
              <p className="caption">
                {tipoOperacion === 'suma' 
                  ? `Ingresa la cantidad de ${unidadLabel} a agregar` 
                  : `Ingresa la cantidad de ${unidadLabel} a restar`}
              </p>

              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: '#9ca3af', fontWeight: '600' }}>
                  Cantidad
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={cantidadSumaResta === 0 ? '' : cantidadSumaResta}
                  onChange={(e) => setCantidadSumaResta(parseFloat(e.target.value || '0'))}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #374151',
                    backgroundColor: '#020617',
                    color: '#e5e7eb',
                    fontSize: '16px',
                    fontWeight: '600',
                    textAlign: 'center',
                  }}
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={cerrarModalSumaResta}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmarSumaResta}
                  style={{
                    backgroundColor: tipoOperacion === 'suma' ? '#22c55e' : '#ef4444',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = tipoOperacion === 'suma' ? '#16a34a' : '#dc2626';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = tipoOperacion === 'suma' ? '#22c55e' : '#ef4444';
                  }}
                >
                  {tipoOperacion === 'suma' ? 'Agregar' : 'Restar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Login */}
        {loginOpen && (
          <div className="modal-backdrop" onClick={() => setLoginOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
              <h3>Iniciar sesión</h3>
              <label>Usuario</label>
              <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
              <label>Contraseña</label>
              <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
              <div className="modal-actions">
                <button onClick={() => setLoginOpen(false)}>Cancelar</button>
                <button className="btn-primary" onClick={() => handleLogin(loginUser, loginPass)}>Entrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Administrar usuarios (solo para admins) */}
        {manageUsersOpen && currentUser?.permissions?.manageUsers && (
          <div className="modal-backdrop" onClick={() => setManageUsersOpen(false)}>
            <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
              <h3>Administrar Usuarios</h3>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>Usuarios</label>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {users.map((u) => (
                      <div key={u.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', border: '1px solid #374151', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{u.nombre || u.username}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{u.username}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditingUser(u)} className="btn-primary">Editar</button>
                          <button onClick={() => handleDeleteUser(u.username)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px' }}>Eliminar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ width: '420px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</label>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <input placeholder="Usuario (id)" value={editingUser?.username || ''} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), username: e.target.value }))} disabled={!!editingUser?.username} />
                    <input placeholder="Nombre" value={editingUser?.nombre || ''} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), nombre: e.target.value }))} />
                    <input placeholder="Contraseña" value={editingUser?.password || ''} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), password: e.target.value }))} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <label><input type="checkbox" checked={!!editingUser?.permissions?.manageUsers} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), permissions: { ...(prev?.permissions || {}), manageUsers: e.target.checked } }))} /> Administrar usuarios</label>
                      <label><input type="checkbox" checked={!!editingUser?.permissions?.manageMembers} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), permissions: { ...(prev?.permissions || {}), manageMembers: e.target.checked } }))} /> Gestionar miembros</label>
                      <label><input type="checkbox" checked={!!editingUser?.permissions?.modifyBank} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), permissions: { ...(prev?.permissions || {}), modifyBank: e.target.checked } }))} /> Modificar banco</label>
                      <label><input type="checkbox" checked={!!editingUser?.permissions?.retirar} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), permissions: { ...(prev?.permissions || {}), retirar: e.target.checked } }))} /> Retirar</label>
                      <label><input type="checkbox" checked={!!editingUser?.permissions?.sync} onChange={(e) => setEditingUser((prev) => ({ ...(prev || { username: '', password: '', permissions: {} }), permissions: { ...(prev?.permissions || {}), sync: e.target.checked } }))} /> Sincronizar</label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setEditingUser({ username: '', password: '', nombre: '', permissions: {} }); }} className="btn-primary">Nuevo</button>
                      <button onClick={() => {
                        if (!editingUser) return;
                        if (!editingUser.username || !editingUser.password) { alert('Usuario y contraseña requeridos'); return; }
                        if (users.some((u) => u.username === editingUser.username)) {
                          handleSaveUser(editingUser);
                        } else {
                          handleCreateUser(editingUser);
                        }
                        setEditingUser(null);
                      }} className="btn-primary">Guardar</button>
                      <button onClick={() => setEditingUser(null)}>Cancelar</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => setManageUsersOpen(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}