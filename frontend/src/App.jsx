import { useState, useEffect } from "react"
import Sidebar from "./components/Sidebar"
import Turnos from "./pages/Turnos"

function App() {
  const [pagina, setPagina] = useState(
    window.location.hash.replace("#", "") || "/"
  )

  useEffect(() => {
    function handleHash() {
      setPagina(window.location.hash.replace("#", "") || "/")
    }
    window.addEventListener("hashchange", handleHash)
    return () => window.removeEventListener("hashchange", handleHash)
  }, [])

  function navegar(path) {
    window.location.hash = path
    setPagina(path)
  }

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#1a1a1a" }}>
      <Sidebar paginaActual={pagina} onNavegar={navegar} />
      <div style={{ flex:1, paddingBottom:"70px" }} className="main-content">
        {pagina === "/" || pagina === ""
          ? <Turnos />
          : (
            <div style={{ padding:"2rem", color:"#888", fontSize:"14px" }}>
              Pantalla en construcción...
            </div>
          )
        }
      </div>
    </div>
  )
}

export default App