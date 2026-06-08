import { useState } from "react"
import { TEMA } from "../theme"

function Login({ onLogin }) {
  const [usuario,  setUsuario]  = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState(null)

  function handleLogin() {
    const userCorrecto = import.meta.env.VITE_LOGIN_USER
    const passCorrecto = import.meta.env.VITE_LOGIN_PASSWORD

    if (usuario === userCorrecto && password === passCorrecto) {
      localStorage.setItem("autenticado", "true")
      onLogin()
    } else {
      setError("Usuario o contraseña incorrectos")
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleLogin()
  }

  return (
    <div style={{ minHeight:"100vh", background: TEMA.fondo, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background: TEMA.superficieAlta, border:`0.5px solid ${TEMA.bordeSuave}`, borderRadius:"12px", padding:"2rem", width:"320px" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <img src="/logo_peluqueria.png" alt="Peluquería Isa"
            style={{ width:"100px", height:"100px", objectFit:"contain", marginBottom:"12px" }} />
          <p style={{ fontSize:"18px", fontWeight:500, color: TEMA.textoPrimario, margin:0 }}>Peluquería Isa</p>
          <p style={{ fontSize:"12px", color: TEMA.textoSecundario, margin:"4px 0 0" }}>Ingresá para continuar</p>
        </div>

        {/* Formulario */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={{ fontSize:"12px", color: TEMA.textoSecundario, display:"block", marginBottom:"4px" }}>Usuario</label>
            <input
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Usuario"
              style={{ width:"100%", padding:"10px 12px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px", boxSizing:"border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize:"12px", color: TEMA.textoSecundario, display:"block", marginBottom:"4px" }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contraseña"
              style={{ width:"100%", padding:"10px 12px", background: TEMA.superficie, border:`0.5px solid ${TEMA.borde}`, borderRadius:"6px", color: TEMA.textoPrimario, fontSize:"14px", boxSizing:"border-box" }}
            />
          </div>

          {error && (
            <p style={{ fontSize:"12px", color: TEMA.primarioHover, margin:0 }}>{error}</p>
          )}

          <button onClick={handleLogin}
            style={{ width:"100%", padding:"11px", borderRadius:"6px", background: TEMA.primario, border:"none", color:"white", fontSize:"14px", fontWeight:500, cursor:"pointer", marginTop:"4px" }}>
            Ingresar
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login