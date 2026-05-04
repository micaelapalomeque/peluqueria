import { useState, useEffect } from "react"
import api from "../api"
import { TEMA } from "../theme"
import ModalCobrar from "../components/ModalCobrar"

function iniciales(nombre) {
  return nombre?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"
}

function formatPeso(valor) {
  return `$${Number(valor).toLocaleString("es-AR")}`
}

function CuentaCorriente() {
  const [pestaña,    setPestaña]    = useState("deudas")
  const [deudas,     setDeudas]     = useState([])
  const [clientes,   setClientes]   = useState([])
  const [pagos,      setPagos]      = useState([])
  const [resumen,    setResumen]    = useState(null)
  const [cargando,   setCargando]   = useState(true)
  const [modalDeuda, setModalDeuda] = useState(null)

  function cargarTodo() {
    setCargando(true)
    Promise.all([
      api.get("/deudas/?estado=pendiente"),
      api.get("/deudas/?estado=parcial"),
      api.get("/clientes/"),
      api.get("/pagos/"),
      api.get("/clientes/ranking/frecuentes"),
    ]).then(([pendientes, parciales, clientesRes, pagosRes, frecuentesRes]) => {
      setDeudas([...pendientes.data, ...parciales.data])
      setClientes(clientesRes.data.filter(c => c.activo))
      setPagos(pagosRes.data.filter(p => p.estado_pago === "pagado").slice(0, 20))

      const todasDeudas      = [...pendientes.data, ...parciales.data]
      const totalAdeudado    = todasDeudas.reduce((acc, d) => acc + Number(d.saldo_pendiente), 0)
      const clientesConDeuda = new Set(todasDeudas.map(d => d.cliente_id)).size
      const cobradoEsteMes   = pagosRes.data
        .filter(p => {
          const fechaPago = new Date(p.fecha_pago)
          const hoy = new Date()
          return p.estado_pago === "pagado" &&
            fechaPago.getMonth()    === hoy.getMonth() &&
            fechaPago.getFullYear() === hoy.getFullYear()
        })
        .reduce((acc, p) => acc + Number(p.monto), 0)

      const turnosCompletados = frecuentesRes.data.reduce((acc, c) => acc + (c.total_turnos || 0), 0)
      setResumen({ totalAdeudado, clientesConDeuda, cobradoEsteMes, turnosCompletados })
    }).catch(console.error)
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarTodo() }, [])

  function nombreCliente(cliente_id) {
    return clientes.find(c => c.id === cliente_id)?.nombre || `Cliente #${cliente_id}`
  }

  const deudasPorCliente = clientes.map(cliente => {
    const deudasCliente = deudas.filter(d => d.cliente_id === cliente.id)
    const total = deudasCliente.reduce((acc, d) => acc + Number(d.saldo_pendiente), 0)
    return { ...cliente, deudasCliente, total }
  }).sort((a, b) => b.total - a.total)

  return (
    <div style={{ flex:1, padding:"1.5rem", background: TEMA.fondo, overflowY:"auto" }}>

      {/* Encabezado */}
      <div style={{ marginBottom:"1.25rem" }}>
        <p style={{ fontSize:"16px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>Cuenta corriente</p>
        <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:"2px 0 0" }}>Resumen financiero y deudas</p>
      </div>

      {/* Resumen */}
      {resumen && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:"10px", marginBottom:"1.25rem" }}>

          <div style={{ background:"#1f1a0a", border:`1px solid ${TEMA.estados.reservado.border}`, borderRadius:"8px", padding:"14px 16px" }}>
            <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:"0 0 4px" }}>Total adeudado</p>
            <p style={{ fontSize:"18px", fontWeight:500, color: TEMA.estados.reservado.color, margin:0 }}>{formatPeso(resumen.totalAdeudado)}</p>
          </div>

          <div style={{ background:"#0a1f0a", border:"1px solid #1a5a1a", borderRadius:"8px", padding:"14px 16px" }}>
            <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:"0 0 4px" }}>Cobrado este mes</p>
            <p style={{ fontSize:"18px", fontWeight:500, color:"#44cc44", margin:0 }}>{formatPeso(resumen.cobradoEsteMes)}</p>
          </div>

          <div style={{ background: TEMA.primarioBg, border:`1px solid ${TEMA.primarioBorder}`, borderRadius:"8px", padding:"14px 16px" }}>
            <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:"0 0 4px" }}>Clientes con deuda</p>
            <p style={{ fontSize:"18px", fontWeight:500, color: TEMA.primarioHover, margin:0 }}>{resumen.clientesConDeuda}</p>
          </div>

          <div style={{ background:"#1a0a2a", border:"1px solid #5a1a8a", borderRadius:"8px", padding:"14px 16px" }}>
            <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:"0 0 4px" }}>Turnos completados</p>
            <p style={{ fontSize:"18px", fontWeight:500, color:"#cc66ff", margin:0 }}>{resumen.turnosCompletados}</p>
          </div>

        </div>
      )}

      {/* Pestañas */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          { key:"deudas",    label:"Deudas pendientes" },
          { key:"clientes",  label:"Por cliente" },
          { key:"historial", label:"Historial de pagos" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setPestaña(tab.key)}
            style={{
              padding:"6px 14px", borderRadius:"6px", fontSize:"13px", cursor:"pointer",
              border:     pestaña === tab.key ? `0.5px solid ${TEMA.primario}` : `0.5px solid ${TEMA.borde}`,
              background: pestaña === tab.key ? TEMA.primarioBg : TEMA.superficie,
              color:      pestaña === tab.key ? TEMA.primarioHover : TEMA.textoSecundario,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <p style={{ color: TEMA.textoSecundario, fontSize:"14px" }}>Cargando...</p>
      ) : (
        <>
          {/* ── DEUDAS PENDIENTES ── */}
          {pestaña === "deudas" && (
            <div style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"8px", overflow:"hidden" }}>
              <div style={{ display:"flex", padding:"10px 16px", borderBottom:`0.5px solid ${TEMA.bordeSuave}`, fontSize:"12px", color: TEMA.textoTerciario }}>
                <span style={{ flex:2 }}>Cliente</span>
                <span style={{ flex:2 }}>Turno</span>
                <span style={{ flex:1, textAlign:"center" }}>Deuda</span>
                <span style={{ flex:1, textAlign:"right" }}>Acción</span>
              </div>
              {deudas.length === 0 ? (
                <p style={{ padding:"1.5rem", textAlign:"center", color: TEMA.textoTerciario, fontSize:"14px" }}>
                  ¡Sin deudas pendientes! 🎉
                </p>
              ) : deudas.map(deuda => (
                <div key={deuda.deuda_id}
                  style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`0.5px solid ${TEMA.bordeSuave}`, gap:"12px" }}
                  onMouseEnter={e => e.currentTarget.style.background = TEMA.superficie}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ flex:2 }}>
                    <p style={{ fontSize:"14px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>
                      {nombreCliente(deuda.cliente_id)}
                    </p>
                    <span style={{ fontSize:"10px", padding:"2px 6px", borderRadius:"20px", background: TEMA.estados.reservado.bg, color: TEMA.estados.reservado.color, border:`0.5px solid ${TEMA.estados.reservado.border}` }}>
                      {deuda.estado}
                    </span>
                  </div>
                  <div style={{ flex:2, fontSize:"12px", color: TEMA.textoSecundario }}>
                    Turno #{deuda.turno_id}
                  </div>
                  <div style={{ flex:1, textAlign:"center", fontSize:"14px", fontWeight:500, color: TEMA.estados.reservado.color }}>
                    {formatPeso(deuda.saldo_pendiente)}
                  </div>
                  <div style={{ flex:1, textAlign:"right" }}>
                    <button onClick={() => setModalDeuda(deuda)}
                      style={{ padding:"5px 10px", borderRadius:"6px", background:"transparent", border:`0.5px solid ${TEMA.primarioBorder}`, color: TEMA.primarioHover, fontSize:"12px", cursor:"pointer" }}>
                      Cobrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── POR CLIENTE ── */}
          {pestaña === "clientes" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {deudasPorCliente.map(cliente => (
                <div key={cliente.id}
                  style={{ background: TEMA.superficieAlta, border:`0.5px solid ${cliente.total > 0 ? TEMA.estados.reservado.border : TEMA.bordeSuave}`, borderRadius:"8px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"50%", background: TEMA.primarioBg, border:`0.5px solid ${TEMA.primarioBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:500, color: TEMA.primarioHover, flexShrink:0 }}>
                    {iniciales(cliente.nombre)}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:"14px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>{cliente.nombre}</p>
                    <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:0 }}>
                      {cliente.deudasCliente.length > 0
                        ? `${cliente.deudasCliente.length} deuda${cliente.deudasCliente.length > 1 ? "s" : ""} pendiente${cliente.deudasCliente.length > 1 ? "s" : ""}`
                        : "Sin deudas"}
                    </p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:"15px", fontWeight:500, color: cliente.total > 0 ? TEMA.estados.reservado.color : "#44cc44", margin:"0 0 4px" }}>
                      {formatPeso(cliente.total)}
                    </p>
                    <span style={{ fontSize:"10px", padding:"2px 8px", borderRadius:"20px", background: cliente.total > 0 ? TEMA.estados.reservado.bg : "#0a1f0a", color: cliente.total > 0 ? TEMA.estados.reservado.color : "#44cc44", border:`0.5px solid ${cliente.total > 0 ? TEMA.estados.reservado.border : "#1a5a1a"}` }}>
                      {cliente.total > 0 ? "Con deuda" : "Al día"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── HISTORIAL ── */}
          {pestaña === "historial" && (
            <div style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"8px", overflow:"hidden" }}>
              <div style={{ display:"flex", padding:"10px 16px", borderBottom:`0.5px solid ${TEMA.bordeSuave}`, fontSize:"12px", color: TEMA.textoTerciario }}>
                <span style={{ flex:2 }}>Cliente</span>
                <span style={{ flex:1, textAlign:"center" }}>Fecha</span>
                <span style={{ flex:1, textAlign:"center" }}>Método</span>
                <span style={{ flex:1, textAlign:"right" }}>Monto</span>
              </div>
              {pagos.length === 0 ? (
                <p style={{ padding:"1.5rem", textAlign:"center", color: TEMA.textoTerciario, fontSize:"14px" }}>
                  Sin historial de pagos
                </p>
              ) : pagos.map(pago => (
                <div key={pago.pago_id}
                  style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:`0.5px solid ${TEMA.bordeSuave}`, gap:"12px" }}
                  onMouseEnter={e => e.currentTarget.style.background = TEMA.superficie}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ flex:2 }}>
                    <p style={{ fontSize:"14px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>
                      {nombreCliente(pago.cliente_id)}
                    </p>
                    <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:0, textTransform:"capitalize" }}>
                      {pago.tipo_pago}
                    </p>
                  </div>
                  <div style={{ flex:1, textAlign:"center", fontSize:"12px", color: TEMA.textoSecundario }}>
                    {new Date(pago.fecha_pago).toLocaleDateString("es-AR")}
                  </div>
                  <div style={{ flex:1, textAlign:"center", fontSize:"12px", color: TEMA.textoSecundario, textTransform:"capitalize" }}>
                    {pago.metodo_pago}
                  </div>
                  <div style={{ flex:1, textAlign:"right", fontSize:"14px", fontWeight:500, color:"#44cc44" }}>
                    {formatPeso(pago.monto)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal cobrar */}
      {modalDeuda && (
        <ModalCobrar
          deuda={modalDeuda}
          onCerrar={() => setModalDeuda(null)}
          onCobrado={cargarTodo}
        />
      )}
    </div>
  )
}

export default CuentaCorriente