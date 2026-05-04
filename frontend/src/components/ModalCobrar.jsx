import { useState } from "react"
import api from "../api"
import { TEMA } from "../theme"

const METODOS_PAGO = ["efectivo", "transferencia"]

function formatPeso(valor) {
  return `$${Number(valor).toLocaleString("es-AR")}`
}

function ModalCobrar({ deuda, onCerrar, onCobrado }) {
  const [metodo,   setMetodo]   = useState("")
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState(null)

  async function cobrar() {
    if (!metodo) return setError("Seleccioná un método de pago")
    setCargando(true)
    setError(null)
    try {
      await api.post(`/deudas/${deuda.deuda_id}/pagar`, {
        monto:       deuda.saldo_pendiente,
        metodo_pago: metodo,
      })
      onCobrado()
      onCerrar()
    } catch(e) {
      setError(e.response?.data?.detail || "Error al cobrar")
    } finally { setCargando(false) }
  }

  return (
    <div
      onClick={onCerrar}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"12px", padding:"1.5rem", width:"340px" }}
      >
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div>
            <p style={{ fontSize:"15px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>
              Registrar pago
            </p>
            <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:"2px 0 0" }}>
              Deuda: {formatPeso(deuda.saldo_pendiente)}
            </p>
          </div>
          <span onClick={onCerrar} style={{ color: TEMA.textoTerciario, cursor:"pointer", fontSize:"18px" }}>✕</span>
        </div>

        <div style={{ marginBottom:"12px" }}>
          <label style={{ fontSize:"13px", color: TEMA.textoSecundario, marginBottom:"6px", display:"block" }}>
            Método de pago
          </label>
          <select
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", background:"#2a2a2a", border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px" }}
          >
            <option value="">Seleccioná método</option>
            {METODOS_PAGO.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {error && (
          <p style={{ fontSize:"12px", color: TEMA.primarioHover, marginTop:"8px" }}>{error}</p>
        )}

        <div style={{ display:"flex", gap:"8px", marginTop:"1.25rem" }}>
          <button
            onClick={onCerrar}
            style={{ flex:1, padding:"10px", borderRadius:"6px", background:"transparent", border:`0.5px solid ${TEMA.borde}`, color: TEMA.textoSecundario, fontSize:"13px", cursor:"pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={cobrar}
            disabled={cargando}
            style={{ flex:2, padding:"10px", borderRadius:"6px", background: TEMA.primario, border:"none", color:"white", fontSize:"13px", fontWeight:500, cursor: cargando ? "not-allowed" : "pointer", opacity: cargando ? 0.7 : 1 }}
          >
            {cargando ? "Cobrando..." : `Cobrar ${formatPeso(deuda.saldo_pendiente)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalCobrar