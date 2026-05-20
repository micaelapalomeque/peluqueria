import { useState, useEffect } from "react"
import api from "../api"
import { TEMA } from "../theme"
import ModalCuentaCliente from "../components/ModalCuentaCliente"

function iniciales(nombre) {
  return nombre?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"
}

function formatPeso(valor) {
  return `$${Number(valor).toLocaleString("es-AR")}`
}

const CLIENTES_POR_PAGINA = 10

function CuentaCorriente() {
  const [clientes,         setClientes]         = useState([])
  const [resumen,          setResumen]          = useState(null)
  const [cargando,         setCargando]         = useState(true)
  const [modalCuenta,      setModalCuenta]      = useState(null)
  const [paginaClientes,   setPaginaClientes]   = useState(1)
  const [busquedaClientes, setBusquedaClientes] = useState("")
  const [balances,         setBalances]         = useState({})

  function cargarTodo() {
    setCargando(true)
    Promise.all([
      api.get("/clientes/"),
      api.get("/clientes/balance/todos"),
    ]).then(([clientesRes, balanceRes]) => {
      const balances = balanceRes.data

      setClientes(clientesRes.data.filter(c => c.activo))
      setBalances(balances)

      const totalAdeudado    = Object.values(balances).filter(s => s > 0).reduce((acc, s) => acc + s, 0)
      const clientesConDeuda = Object.values(balances).filter(s => s > 0).length

      setResumen({ totalAdeudado, clientesConDeuda })
    }).catch(console.error)
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarTodo() }, [])

  function enviarResumenCliente(cliente) {
    const celular = cliente.celular.replace(/\D/g, "")
    const numero  = celular.startsWith("54") ? celular : `54${celular}`
    const mensaje = encodeURIComponent(
      `Hola ${cliente.nombre}! 👋\n` +
      `Te recordamos que tenés un saldo pendiente de *${formatPeso(cliente.saldoNeto)}* en Peluquería Isa.\n\n` +
      `Cualquier consulta estamos a disposición. ¡Gracias!`
    )
    window.open(`https://wa.me/${numero}?text=${mensaje}`, "_blank")
  }

  const deudasPorCliente = clientes.map(cliente => {
    const saldoNeto = balances[cliente.id] ?? 0
    return { ...cliente, total: saldoNeto, saldoNeto }
  }).sort((a, b) => b.saldoNeto - a.saldoNeto)

  const clientesFiltrados = deudasPorCliente.filter(c =>
    c.nombre.toLowerCase().includes(busquedaClientes.toLowerCase())
  )

  const totalPaginasClientes = Math.ceil(clientesFiltrados.length / CLIENTES_POR_PAGINA)
  const clientesPagina       = clientesFiltrados.slice((paginaClientes - 1) * CLIENTES_POR_PAGINA, paginaClientes * CLIENTES_POR_PAGINA)

  return (
    <div style={{ flex:1, padding:"1.5rem", background: TEMA.fondo, overflowY:"auto" }}>

      {/* Encabezado */}
      <div style={{ marginBottom:"1.25rem" }}>
        <p style={{ fontSize:"16px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>Cuenta corriente</p>
        <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:"2px 0 0" }}>Saldo por cliente</p>
      </div>

      {/* Resumen — solo 2 tarjetas */}
      {resumen && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"1.25rem" }}>
          <div style={{ background:"#1f1a0a", border:`1px solid ${TEMA.estados.reservado.border}`, borderRadius:"8px", padding:"14px 16px" }}>
            <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:"0 0 4px" }}>Total adeudado</p>
            <p style={{ fontSize:"18px", fontWeight:500, color:"#f0b429", margin:0 }}>{formatPeso(resumen.totalAdeudado)}</p>
          </div>
          <div style={{ background: TEMA.primarioBg, border:`1px solid ${TEMA.primarioBorder}`, borderRadius:"8px", padding:"14px 16px" }}>
            <p style={{ fontSize:"11px", color: TEMA.textoTerciario, margin:"0 0 4px" }}>Clientes con deuda</p>
            <p style={{ fontSize:"18px", fontWeight:500, color: TEMA.primarioHover, margin:0 }}>{resumen.clientesConDeuda}</p>
          </div>
        </div>
      )}

      {cargando ? (
        <p style={{ color: TEMA.textoSecundario, fontSize:"14px" }}>Cargando...</p>
      ) : (
        <>
          {/* Buscador */}
          <div style={{ position:"relative", marginBottom:"12px" }}>
            <span style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color: TEMA.textoTerciario, fontSize:"14px", pointerEvents:"none" }}>🔍</span>
            <input
              value={busquedaClientes}
              onChange={e => { setBusquedaClientes(e.target.value); setPaginaClientes(1) }}
              placeholder="Buscá por nombre de cliente..."
              style={{ width:"100%", padding:"10px 12px 10px 36px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px", boxSizing:"border-box" }}
            />
          </div>

          {/* Lista clientes */}
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {clientesPagina.map(cliente => (
              <div key={cliente.id}
                style={{ background: TEMA.superficieAlta, border:`0.5px solid ${cliente.saldoNeto > 0 ? TEMA.estados.reservado.border : cliente.saldoNeto < 0 ? "#1a4a8a" : TEMA.bordeSuave}`, borderRadius:"8px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"36px", height:"36px", borderRadius:"50%", background: TEMA.primarioBg, border:`0.5px solid ${TEMA.primarioBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:500, color: TEMA.primarioHover, flexShrink:0 }}>
                  {iniciales(cliente.nombre)}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:"14px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>{cliente.nombre}</p>
                  <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:0 }}>
                    {cliente.saldoNeto > 0 ? "Con deuda pendiente" : cliente.saldoNeto < 0 ? "Tiene saldo a favor" : "Al día"}
                  </p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:"15px", fontWeight:500, color: cliente.saldoNeto > 0 ? "#f0b429" : cliente.saldoNeto < 0 ? "#66aaff" : "#44cc44", margin:"0 0 4px" }}>
                    {cliente.saldoNeto > 0 ? formatPeso(cliente.saldoNeto) : cliente.saldoNeto < 0 ? `-${formatPeso(Math.abs(cliente.saldoNeto))}` : "$0"}
                  </p>
                  <span style={{
                    fontSize:"10px", padding:"2px 8px", borderRadius:"20px",
                    background: cliente.saldoNeto > 0 ? TEMA.estados.reservado.bg : cliente.saldoNeto < 0 ? "#0a1a2a" : "#0a1f0a",
                    color:      cliente.saldoNeto > 0 ? "#f0b429" : cliente.saldoNeto < 0 ? "#66aaff" : "#44cc44",
                    border:     `0.5px solid ${cliente.saldoNeto > 0 ? TEMA.estados.reservado.border : cliente.saldoNeto < 0 ? "#1a4a8a" : "#1a5a1a"}`,
                  }}>
                    {cliente.saldoNeto > 0 ? "Con deuda" : cliente.saldoNeto < 0 ? "Saldo a favor" : "Al día"}
                  </span>
                  <div style={{ marginTop:"6px", display:"flex", gap:"6px", justifyContent:"flex-end" }}>
                    {cliente.saldoNeto > 0 && (
                      <button onClick={() => enviarResumenCliente(cliente)}
                        style={{ padding:"5px 10px", borderRadius:"6px", background:"transparent", border:"0.5px solid #1a5a1a", color:"#44cc44", fontSize:"12px", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Enviar recordatorio
                      </button>
                    )}
                    <button onClick={() => setModalCuenta(cliente)}
                      style={{ padding:"4px 10px", borderRadius:"6px", background:"transparent", border:`0.5px solid ${TEMA.borde}`, color: TEMA.textoSecundario, fontSize:"11px", cursor:"pointer" }}>
                      Ver cuenta
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPaginasClientes > 1 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"12px", marginTop:"1rem" }}>
              <button onClick={() => setPaginaClientes(p => Math.max(1, p - 1))} disabled={paginaClientes === 1}
                style={{ padding:"6px 14px", borderRadius:"6px", border:`0.5px solid ${TEMA.borde}`, background: TEMA.superficie, color: paginaClientes === 1 ? TEMA.textoDeshabilitado : TEMA.textoSecundario, cursor: paginaClientes === 1 ? "not-allowed" : "pointer", fontSize:"13px" }}>←</button>
              <span style={{ fontSize:"13px", color: TEMA.textoSecundario }}>
                Página <span style={{ color: TEMA.textoPrimario, fontWeight:500 }}>{paginaClientes}</span> de <span style={{ color: TEMA.textoPrimario, fontWeight:500 }}>{totalPaginasClientes}</span>
              </span>
              <button onClick={() => setPaginaClientes(p => Math.min(totalPaginasClientes, p + 1))} disabled={paginaClientes === totalPaginasClientes}
                style={{ padding:"6px 14px", borderRadius:"6px", border:`0.5px solid ${TEMA.borde}`, background: TEMA.superficie, color: paginaClientes === totalPaginasClientes ? TEMA.textoDeshabilitado : TEMA.textoSecundario, cursor: paginaClientes === totalPaginasClientes ? "not-allowed" : "pointer", fontSize:"13px" }}>→</button>
            </div>
          )}
          <p style={{ fontSize:"12px", color: TEMA.textoTerciario, textAlign:"center", marginTop:"8px" }}>
            {clientesFiltrados.length} clientes en total
          </p>
        </>
      )}

      {modalCuenta && (
        <ModalCuentaCliente
          cliente={modalCuenta}
          onCerrar={() => setModalCuenta(null)}
        />
      )}
    </div>
  )
}

export default CuentaCorriente