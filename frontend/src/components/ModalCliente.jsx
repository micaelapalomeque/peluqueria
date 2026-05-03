import { useState } from "react"
import api from "../api"
import { TEMA } from "../theme"

function ModalCliente({ cliente, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    nombre:      cliente?.nombre      || "",
    celular:     cliente?.celular     || "",
    observacion: cliente?.observacion || "",
  })
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState(null)

  const esEdicion = !!cliente

  function cambiar(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function guardar() {
    if (!form.nombre.trim())  return setError("El nombre es obligatorio")
    if (!form.celular.trim()) return setError("El celular es obligatorio")
    if (form.celular.startsWith("0"))  return setError("No incluyas el 0 inicial (ej: 1123456789)")
    if (form.celular.startsWith("15")) return setError("No incluyas el 15 (ej: 1123456789)")
    if (form.celular.length !== 10)    return setError("El celular debe tener exactamente 10 dígitos (ej: 1123456789)")

    setCargando(true)
    setError(null)
    try {
      if (esEdicion) {
        await api.put(`/clientes/${cliente.id}`, form)
      } else {
        await api.post("/clientes/", form)
      }
      onGuardado()
      onCerrar()
    } catch(e) {
      setError(e.response?.data?.detail || "Error al guardar")
    } finally { setCargando(false) }
  }

  return (
    <div
      onClick={onCerrar}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"12px", padding:"1.5rem", width:"360px" }}
      >
        {/* Encabezado */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div>
            <p style={{ fontSize:"15px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>
              {esEdicion ? "Editar cliente" : "Nuevo cliente"}
            </p>
            {esEdicion && (
              <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:"2px 0 0" }}>
                {cliente.nombre}
              </p>
            )}
          </div>
          <span onClick={onCerrar} style={{ color: TEMA.textoTerciario, cursor:"pointer", fontSize:"18px" }}>✕</span>
        </div>

        {/* Formulario */}
        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <div>
            <label style={{ fontSize:"13px", color: TEMA.textoSecundario, marginBottom:"6px", display:"block" }}>
              Nombre *
            </label>
            <input
              value={form.nombre}
              onChange={e => cambiar("nombre", e.target.value)}
              placeholder="Ej: Juan Perez"
              style={{ width:"100%", padding:"10px 12px", background:"#2a2a2a", border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px", boxSizing:"border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize:"13px", color: TEMA.textoSecundario, marginBottom:"6px", display:"block" }}>
              Celular *
              <span style={{ fontSize:"11px", color: TEMA.textoTerciario, marginLeft:"6px" }}>
                (sin 0 ni 15, ej: 1123456789)
              </span>
            </label>
            <input
              value={form.celular}
              onChange={e => cambiar("celular", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="1123456789"
              inputMode="numeric"
              maxLength={10}
              style={{ width:"100%", padding:"10px 12px", background:"#2a2a2a", border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px", boxSizing:"border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize:"13px", color: TEMA.textoSecundario, marginBottom:"6px", display:"block" }}>
              Observación
              <span style={{ fontSize:"11px", color: TEMA.textoTerciario, marginLeft:"6px" }}>(opcional)</span>
            </label>
            <textarea
              value={form.observacion}
              onChange={e => cambiar("observacion", e.target.value)}
              placeholder="Ej: Viene con sus hijos, alérgico a..."
              rows={3}
              style={{ width:"100%", padding:"10px 12px", background:"#2a2a2a", border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px", boxSizing:"border-box", resize:"none" }}
            />
          </div>
        </div>

        {error && (
          <p style={{ fontSize:"12px", color: TEMA.primarioHover, marginTop:"10px" }}>{error}</p>
        )}

        {/* Botones */}
        <div style={{ marginTop:"1.25rem", display:"flex", gap:"8px" }}>
          <button
            onClick={onCerrar}
            style={{ flex:1, padding:"10px", borderRadius:"6px", background:"transparent", border:`0.5px solid ${TEMA.borde}`, color: TEMA.textoSecundario, fontSize:"13px", cursor:"pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={cargando}
            style={{ flex:2, padding:"10px", borderRadius:"6px", background: TEMA.primario, border:"none", color:"white", fontSize:"13px", fontWeight:500, cursor: cargando ? "not-allowed" : "pointer", opacity: cargando ? 0.7 : 1 }}
          >
            {cargando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear cliente"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalCliente