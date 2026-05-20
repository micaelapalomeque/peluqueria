import { useState, useEffect } from "react"
import api from "../api"
import { TEMA } from "../theme"
import Swal from "sweetalert2"

function formatPeso(valor) {
  return `$${Number(valor).toLocaleString("es-AR")}`
}

function formatFecha(fecha) {
  if (!fecha) return ""
  return new Date(fecha).toLocaleDateString("es-AR", { day:"numeric", month:"short", year:"numeric" })
}

const METODOS_PAGO    = ["efectivo", "transferencia"]
const PAGOS_POR_PAG   = 20

// ─── Modal Nuevo Cobro ───────────────────────────────────────────────────────
function ModalNuevoCobro({ onCerrar, onCobrado }) {
  const [clientes,        setClientes]        = useState([])
  const [balances,        setBalances]        = useState({})
  const [busqueda,        setBusqueda]        = useState("")
  const [clienteSelec,    setClienteSelec]    = useState(null)
  const [deudas,          setDeudas]          = useState([])
  const [cargando,        setCargando]        = useState(false)
  const [tipoCobro,       setTipoCobro]       = useState(null)
  const [deudaSelec,      setDeudaSelec]      = useState(null)
  const [montoCobro,      setMontoCobro]      = useState("")
  const [montoEntregado,  setMontoEntregado]  = useState("")
  const [metodo,          setMetodo]          = useState("")
  const [procesando,      setProcesando]      = useState(false)
  const [error,           setError]           = useState(null)

  useEffect(() => {
    Promise.all([
      api.get("/clientes/"),
      api.get("/clientes/balance/todos"),
    ]).then(([clientesRes, balanceRes]) => {
      setClientes(clientesRes.data.filter(c => c.activo))
      setBalances(balanceRes.data)
    })
  }, [])

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.celular.includes(busqueda)
  )

  function seleccionarCliente(cliente) {
    setClienteSelec(cliente)
    setBusqueda(cliente.nombre)
    setTipoCobro(null)
    setDeudaSelec(null)
    setMontoCobro("")
    setMontoEntregado("")
    setMetodo("")
    setError(null)
    setCargando(true)
    api.get(`/deudas/cliente/${cliente.id}?solo_pendientes=true`)
      .then(res => setDeudas(res.data))
      .catch(console.error)
      .finally(() => setCargando(false))
  }

  const saldoCliente    = balances[clienteSelec?.id] ?? 0
  const montoSugerido   = tipoCobro === "deuda" && deudaSelec
    ? Number(deudaSelec.saldo_pendiente)
    : tipoCobro === "cuenta" ? Math.max(0, saldoCliente) : 0
  const montoCobroNum      = montoCobro !== "" ? Number(montoCobro) : montoSugerido
  const montoEntregadoNum  = montoEntregado !== "" ? Number(montoEntregado) : null
  const coincide           = montoEntregadoNum !== null && montoEntregadoNum >= montoCobroNum

  async function registrarPago() {
    if (!metodo)        return setError("Seleccioná un método de pago")
    if (!montoCobroNum) return setError("Ingresá un monto válido")
    if (!coincide)      return setError("El monto entregado debe ser igual o mayor al monto a cobrar")
    setProcesando(true)
    setError(null)
    try {
      if (tipoCobro === "deuda") {
        await api.post(`/deudas/${deudaSelec.deuda_id}/pagar`, {
          monto:       montoCobroNum,
          metodo_pago: metodo,
        })
      } else {
        await api.post("/pagos/", {
          cliente_id:  clienteSelec.id,
          monto:       montoCobroNum,
          metodo_pago: metodo,
          tipo_pago:   "total",
          estado_pago: "pagado",
          descripcion: `Abono a cuenta — ${clienteSelec.nombre}`,
        })
      }
      await Swal.fire({
        title: "¡Cobro registrado!",
        text:  `${formatPeso(montoCobroNum)} para ${clienteSelec.nombre}`,
        icon:  "success", background:"#1e1e1e", color:"#f0f0f0",
        confirmButtonColor: TEMA.primario,
      })
      onCobrado()
      onCerrar()
    } catch(e) {
      setError(e.response?.data?.detail || "Error al registrar el cobro")
    } finally { setProcesando(false) }
  }

  return (
    <div onClick={onCerrar}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"12px", padding:"1.5rem", width:"500px", maxHeight:"90vh", overflowY:"auto" }}>

        {/* Encabezado */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <p style={{ fontSize:"15px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>Nuevo cobro</p>
          <span onClick={onCerrar} style={{ color: TEMA.textoTerciario, cursor:"pointer", fontSize:"18px" }}>✕</span>
        </div>

        {/* Paso 1 — Cliente */}
        <div style={{ background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"8px", padding:"12px", marginBottom:"12px" }}>
          <p style={{ fontSize:"12px", fontWeight:500, color: TEMA.textoSecundario, margin:"0 0 8px" }}>1. Cliente</p>
          <input value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setClienteSelec(null) }}
            placeholder="Buscá por nombre o celular..."
            style={{ width:"100%", padding:"8px 12px", background:"#2a2a2a", border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"13px", boxSizing:"border-box", marginBottom:"6px" }}
          />
          {busqueda && !clienteSelec && clientesFiltrados.length > 0 && (
            <div style={{ border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"6px", overflow:"hidden", maxHeight:"160px", overflowY:"auto" }}>
              {clientesFiltrados.map(c => (
                <div key={c.id} onClick={() => seleccionarCliente(c)}
                  style={{ padding:"8px 12px", cursor:"pointer", display:"flex", justifyContent:"space-between", borderBottom:`0.5px solid ${TEMA.bordeSuave}` }}
                  onMouseEnter={e => e.currentTarget.style.background = TEMA.superficie}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <p style={{ fontSize:"13px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>{c.nombre}</p>
                    <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:0 }}>{c.celular}</p>
                  </div>
                  {balances[c.id] > 0 && (
                    <span style={{ fontSize:"12px", fontWeight:500, color:"#f0b429" }}>{formatPeso(balances[c.id])}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {clienteSelec && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}>
              <span style={{ fontSize:"13px", color: TEMA.textoPrimario, fontWeight:500 }}>{clienteSelec.nombre}</span>
              <span style={{ fontSize:"12px", fontWeight:500, color: saldoCliente > 0 ? "#f0b429" : saldoCliente < 0 ? "#66aaff" : "#44cc44" }}>
                {saldoCliente > 0 ? formatPeso(saldoCliente) : saldoCliente < 0 ? `${formatPeso(Math.abs(saldoCliente))} a favor` : "Al día"}
              </span>
            </div>
          )}
        </div>

        {/* Paso 2 — Tipo de cobro */}
        {clienteSelec && (
          <div style={{ background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"8px", padding:"12px", marginBottom:"12px" }}>
            <p style={{ fontSize:"12px", fontWeight:500, color: TEMA.textoSecundario, margin:"0 0 8px" }}>2. ¿Qué cobrás?</p>
            <div style={{ display:"flex", gap:"8px", marginBottom: tipoCobro ? "10px" : 0 }}>
              <button onClick={() => { setTipoCobro("deuda"); setDeudaSelec(null); setMontoCobro(""); setMontoEntregado("") }}
                style={{ flex:1, padding:"8px", borderRadius:"6px", fontSize:"12px", cursor:"pointer",
                  border:     tipoCobro === "deuda" ? `0.5px solid ${TEMA.primario}` : `0.5px solid ${TEMA.borde}`,
                  background: tipoCobro === "deuda" ? TEMA.primarioBg : "#2a2a2a",
                  color:      tipoCobro === "deuda" ? TEMA.primarioHover : TEMA.textoSecundario,
                }}>📋 Deuda de turno</button>
              <button onClick={() => { setTipoCobro("cuenta"); setDeudaSelec(null); setMontoCobro(""); setMontoEntregado("") }}
                style={{ flex:1, padding:"8px", borderRadius:"6px", fontSize:"12px", cursor:"pointer",
                  border:     tipoCobro === "cuenta" ? `0.5px solid ${TEMA.primario}` : `0.5px solid ${TEMA.borde}`,
                  background: tipoCobro === "cuenta" ? TEMA.primarioBg : "#2a2a2a",
                  color:      tipoCobro === "cuenta" ? TEMA.primarioHover : TEMA.textoSecundario,
                }}>💰 Abono a cuenta</button>
            </div>

            {tipoCobro === "deuda" && (
              cargando ? <p style={{ fontSize:"12px", color: TEMA.textoSecundario }}>Cargando...</p> :
              deudas.length === 0 ? <p style={{ fontSize:"12px", color: TEMA.textoTerciario, textAlign:"center", padding:"8px" }}>Sin deudas pendientes</p> :
              <div style={{ border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"6px", overflow:"hidden" }}>
                {deudas.map((d, i) => (
                  <div key={d.deuda_id} onClick={() => { setDeudaSelec(d); setMontoCobro(String(d.saldo_pendiente)); setMontoEntregado("") }}
                    style={{ padding:"8px 12px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center",
                      borderBottom: i < deudas.length - 1 ? `0.5px solid ${TEMA.bordeSuave}` : "none",
                      background: deudaSelec?.deuda_id === d.deuda_id ? TEMA.primarioBg : "transparent",
                      outline: deudaSelec?.deuda_id === d.deuda_id ? `0.5px solid ${TEMA.primario}` : "none",
                    }}>
                    <div>
                      <p style={{ fontSize:"12px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>Turno #{d.turno_id}</p>
                      <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:0 }}>{d.estado}</p>
                    </div>
                    <span style={{ fontSize:"13px", fontWeight:500, color:"#f0b429" }}>{formatPeso(d.saldo_pendiente)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paso 3 — Monto y método */}
        {clienteSelec && tipoCobro && (tipoCobro === "cuenta" || deudaSelec) && (
          <div style={{ background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"8px", padding:"12px", marginBottom:"12px" }}>
            <p style={{ fontSize:"12px", fontWeight:500, color: TEMA.textoSecundario, margin:"0 0 10px" }}>3. Monto y método</p>

            <div style={{ marginBottom:"10px" }}>
              <label style={{ fontSize:"11px", color: TEMA.textoTerciario, display:"block", marginBottom:"4px" }}>Monto a cobrar</label>
              <input value={montoCobro} onChange={e => setMontoCobro(e.target.value.replace(/\D/g, ""))}
                placeholder={formatPeso(montoSugerido)} inputMode="numeric"
                style={{ width:"100%", padding:"8px 12px", background:"#2a2a2a", border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"13px", boxSizing:"border-box" }} />
            </div>

            <div style={{ marginBottom:"10px" }}>
              <label style={{ fontSize:"11px", color: TEMA.textoTerciario, display:"block", marginBottom:"4px" }}>Monto entregado</label>
              <input value={montoEntregado} onChange={e => setMontoEntregado(e.target.value.replace(/\D/g, ""))}
                placeholder={`${formatPeso(montoCobroNum)} (exacto)`} inputMode="numeric"
                style={{ width:"100%", padding:"8px 12px", background:"#2a2a2a",
                  border:`0.5px solid ${montoEntregadoNum !== null ? (coincide ? "#1a5a1a" : "#5a1a1a") : TEMA.borde}`,
                  borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"13px", boxSizing:"border-box" }} />
              {montoEntregadoNum !== null && coincide && montoEntregadoNum > montoCobroNum && (
                <p style={{ fontSize:"11px", color:"#66aaff", margin:"4px 0 0" }}>
                  Vuelto: {formatPeso(montoEntregadoNum - montoCobroNum)}
                </p>
              )}
            </div>

            <div style={{ marginBottom:"10px" }}>
              <label style={{ fontSize:"11px", color: TEMA.textoTerciario, display:"block", marginBottom:"4px" }}>Método de pago</label>
              <div style={{ display:"flex", gap:"8px" }}>
                {METODOS_PAGO.map(m => (
                  <button key={m} onClick={() => setMetodo(m)}
                    style={{ flex:1, padding:"7px", borderRadius:"6px", fontSize:"12px", cursor:"pointer", textTransform:"capitalize",
                      border:     metodo === m ? `0.5px solid ${TEMA.primario}` : `0.5px solid ${TEMA.borde}`,
                      background: metodo === m ? TEMA.primarioBg : "#2a2a2a",
                      color:      metodo === m ? TEMA.primarioHover : TEMA.textoSecundario,
                    }}>{m}</button>
                ))}
              </div>
            </div>

            {error && <p style={{ fontSize:"12px", color: TEMA.primarioHover, margin:"0 0 10px" }}>{error}</p>}

            <button onClick={registrarPago} disabled={procesando || !coincide || !metodo}
              style={{ width:"100%", padding:"10px", borderRadius:"6px", background: TEMA.primario, border:"none", color:"white", fontSize:"13px", fontWeight:500,
                cursor: procesando || !coincide || !metodo ? "not-allowed" : "pointer",
                opacity: procesando || !coincide || !metodo ? 0.6 : 1 }}>
              {procesando ? "Procesando..." : `Registrar cobro de ${formatPeso(montoCobroNum)}`}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Página Cobranzas ────────────────────────────────────────────────────────
function Cobranzas() {
  const hoy            = new Date()
  const inicioMes      = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0]
  const finMes         = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split("T")[0]

  const [pagos,         setPagos]         = useState([])
  const [clientes,      setClientes]      = useState([])
  const [cargando,      setCargando]      = useState(true)
  const [modalNuevo,    setModalNuevo]    = useState(false)
  const [pagina,        setPagina]        = useState(1)
  const [busqueda,      setBusqueda]      = useState("")
  const [fechaDesde,    setFechaDesde]    = useState(inicioMes)
  const [fechaHasta,    setFechaHasta]    = useState(finMes)

  function cargarPagos() {
    setCargando(true)
    Promise.all([
      api.get("/pagos/"),
      api.get("/clientes/"),
    ]).then(([pagosRes, clientesRes]) => {
      setPagos(pagosRes.data.filter(p => p.estado_pago === "pagado").sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago)))
      setClientes(clientesRes.data)
    }).catch(console.error)
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarPagos() }, [])

  function nombreCliente(id) {
    return clientes.find(c => c.id === id)?.nombre || `Cliente #${id}`
  }

  const pagosFiltrados = pagos.filter(p => {
    const fecha      = new Date(p.fecha_pago)
    const desde      = new Date(fechaDesde + "T00:00:00")
    const hasta      = new Date(fechaHasta + "T23:59:59")
    const enRango    = fecha >= desde && fecha <= hasta
    const enBusqueda = busqueda === "" || nombreCliente(p.cliente_id).toLowerCase().includes(busqueda.toLowerCase())
    return enRango && enBusqueda
  })

  const totalPaginas  = Math.ceil(pagosFiltrados.length / PAGOS_POR_PAG)
  const pagosPagina   = pagosFiltrados.slice((pagina - 1) * PAGOS_POR_PAG, pagina * PAGOS_POR_PAG)
  const totalPeriodo  = pagosFiltrados.filter(p => p.tipo_pago !== "saldo_favor").reduce((acc, p) => acc + Number(p.monto), 0)

  return (
    <div style={{ flex:1, padding:"1.5rem", background: TEMA.fondo, overflowY:"auto" }}>

      {/* Encabezado */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <div>
          <p style={{ fontSize:"16px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>Cobranzas</p>
          <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:"2px 0 0" }}>Historial de cobros</p>
        </div>
        <button onClick={() => setModalNuevo(true)}
          style={{ padding:"8px 16px", borderRadius:"6px", background: TEMA.primario, border:"none", color:"white", fontSize:"13px", fontWeight:500, cursor:"pointer" }}>
          + Nuevo cobro
        </button>
      </div>

      {/* Tarjeta total */}
      <div style={{ background:"#0a1f0a", border:"0.5px solid #1a5a1a", borderRadius:"8px", padding:"12px 16px", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"13px", color: TEMA.textoSecundario }}>Total cobrado en el período</span>
        <span style={{ fontSize:"18px", fontWeight:500, color:"#44cc44" }}>{formatPeso(totalPeriodo)}</span>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"12px", flexWrap:"wrap" }}>
        <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          placeholder="Buscá por cliente..."
          style={{ flex:1, minWidth:"160px", padding:"8px 12px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"13px" }} />
        <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPagina(1) }}
          style={{ padding:"8px 10px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"12px" }} />
        <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPagina(1) }}
          style={{ padding:"8px 10px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"12px" }} />
        <button onClick={() => { setFechaDesde(inicioMes); setFechaHasta(finMes); setBusqueda(""); setPagina(1) }}
          style={{ padding:"8px 12px", borderRadius:"6px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, color: TEMA.textoSecundario, fontSize:"12px", cursor:"pointer" }}>
          Este mes
        </button>
      </div>

      {/* Tabla */}
      {cargando ? <p style={{ color: TEMA.textoSecundario, fontSize:"13px" }}>Cargando...</p> : (
        <div style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"8px", overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"60px 1fr 1fr 80px 100px 100px", padding:"10px 16px", borderBottom:`0.5px solid ${TEMA.bordeSuave}`, fontSize:"11px", color: TEMA.textoTerciario }}>
            <span>N°</span>
            <span>Cliente</span>
            <span>Fecha</span>
            <span>Turno</span>
            <span style={{ textAlign:"center" }}>Tipo</span>
            <span style={{ textAlign:"right" }}>Monto</span>
          </div>
          {pagosPagina.length === 0 ? (
            <p style={{ padding:"1.5rem", textAlign:"center", color: TEMA.textoTerciario, fontSize:"13px" }}>Sin cobros en este período</p>
          ) : pagosPagina.map(pago => (
            <div key={pago.pago_id}
              style={{ display:"grid", gridTemplateColumns:"60px 1fr 1fr 80px 100px 100px", padding:"10px 16px", borderBottom:`0.5px solid ${TEMA.bordeSuave}`, alignItems:"center" }}
              onMouseEnter={e => e.currentTarget.style.background = TEMA.superficie}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize:"11px", color: TEMA.textoTerciario }}>#{pago.pago_id}</span>
              <span style={{ fontSize:"13px", color: TEMA.textoPrimario, fontWeight:500 }}>{nombreCliente(pago.cliente_id)}</span>
              <span style={{ fontSize:"12px", color: TEMA.textoSecundario }}>{formatFecha(pago.fecha_pago)}</span>
              <span style={{ fontSize:"12px", color: TEMA.textoTerciario }}>
                {pago.turno_id ? `#${pago.turno_id}` : "—"}
              </span>
              <span style={{ fontSize:"11px", textAlign:"center", padding:"2px 6px", borderRadius:"20px", textTransform:"capitalize",
                background: pago.tipo_pago === "propina" ? "#1a2a1a" : pago.tipo_pago === "saldo_favor" ? "#0a1a2a" : TEMA.superficie,
                color: pago.tipo_pago === "propina" ? "#44cc44" : pago.tipo_pago === "saldo_favor" ? "#66aaff" : TEMA.textoSecundario,
              }}>
                {pago.tipo_pago}
              </span>
              <span style={{ fontSize:"13px", fontWeight:500, textAlign:"right", color:"#44cc44" }}>
                {formatPeso(pago.monto)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"12px", marginTop:"1rem" }}>
          <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
            style={{ padding:"6px 14px", borderRadius:"6px", border:`0.5px solid ${TEMA.borde}`, background: TEMA.superficie, color: pagina === 1 ? TEMA.textoDeshabilitado : TEMA.textoSecundario, cursor: pagina === 1 ? "not-allowed" : "pointer", fontSize:"13px" }}>←</button>
          <span style={{ fontSize:"13px", color: TEMA.textoSecundario }}>
            Página <span style={{ color: TEMA.textoPrimario, fontWeight:500 }}>{pagina}</span> de <span style={{ color: TEMA.textoPrimario, fontWeight:500 }}>{totalPaginas}</span>
          </span>
          <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
            style={{ padding:"6px 14px", borderRadius:"6px", border:`0.5px solid ${TEMA.borde}`, background: TEMA.superficie, color: pagina === totalPaginas ? TEMA.textoDeshabilitado : TEMA.textoSecundario, cursor: pagina === totalPaginas ? "not-allowed" : "pointer", fontSize:"13px" }}>→</button>
        </div>
      )}
      <p style={{ fontSize:"12px", color: TEMA.textoTerciario, textAlign:"center", marginTop:"8px" }}>
        {pagosFiltrados.length} cobros en el período
      </p>

      {modalNuevo && (
        <ModalNuevoCobro
          onCerrar={() => setModalNuevo(false)}
          onCobrado={cargarPagos}
        />
      )}
    </div>
  )
}

export default Cobranzas