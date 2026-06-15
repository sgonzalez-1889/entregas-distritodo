import React, { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, Camera, PenLine, Check, X, Trash2, Plus, RotateCcw,
  Calendar, User, FileText, Hash, ChevronLeft, Search, Image as ImageIcon,
  Warehouse, Bike, Cog, Users, Settings, LogOut, Shield, ChevronDown, FileSpreadsheet, Cloud, CloudOff, Download, SlidersHorizontal, ArrowLeftRight, ArrowRight
} from "lucide-react";

// ============================================================
//  CONEXIÓN A LA BASE DE DATOS (Supabase)
//  Pega aquí los dos datos de tu proyecto de Supabase.
//  Settings → API:  Project URL  y  la clave pública (anon / publishable)
const SUPABASE_URL = "https://rigyrpgmudrndhxmhopw.supabase.co";
const SUPABASE_KEY = "sb_publishable_3qwE0y9td7AQVawjuW2GUg_BbOcb_HG";
// ============================================================
const hayBD = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_KEY.includes("TU_CLAVE");
const supabase = hayBD ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ====== Utilidades ======
const ahora = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};

// Devuelve siempre el nombre del almacén como texto (protege contra datos guardados como objeto)
const nombreAlm = (a) => (a && typeof a === "object" ? (a.nombre || "") : (a || ""));

// ====== Almacenes y usuarios iniciales (el admin los edita en la app) ======
const ALMACENES_INI = [
  { nombre: "Bodega Central", prefijo: "CENT/OUT/", prefijoT: "CENT/INT/" },
  { nombre: "Sucursal Norte", prefijo: "NORT/OUT/", prefijoT: "NORT/INT/" },
  { nombre: "Sucursal Sur", prefijo: "SUR/OUT/", prefijoT: "SUR/INT/" },
  { nombre: "Mompox", prefijo: "MOMPO/OUT/", prefijoT: "MOMPO/INT/" },
];
const USUARIOS_INI = [
  { id: 1, nombre: "Administrador", almacen: "Todos", pin: "1234", permisos: ["registrar", "ver", "motos", "editar", "informes", "admin"] },
  { id: 2, nombre: "Repartidor Centro", almacen: "Bodega Central", pin: "1111", permisos: ["registrar", "ver", "motos"] },
  { id: 3, nombre: "Repartidor Norte", almacen: "Sucursal Norte", pin: "2222", permisos: ["registrar", "ver"] },
];

const VACIO = { transaccion: "", numero: "", fecha: ahora(), cliente: "", recibe: "", documento: "", almacen: "", esMoto: false, motor: "", chasis: "", foto: null, fotos: [], firma: null };
const VACIO_T = { tipo: "traslado", numero: "", fecha: ahora(), origen: "", destino: "", recibe: "", documento: "", fotos: [], firma: null };

export default function App() {
  const [entregas, setEntregas] = useState([]);
  const [traslados, setTraslados] = useState([]);
  const [tipoLista, setTipoLista] = useState("entregas"); // entregas | traslados
  const [formT, setFormT] = useState(VACIO_T);
  const [usuarios, setUsuarios] = useState(USUARIOS_INI);
  const [almacenes, setAlmacenes] = useState(ALMACENES_INI);
  const [usuario, setUsuario] = useState(null); // usuario activo (quién soy)
  const [vista, setVista] = useState("lista"); // lista | nueva | detalle | admin
  const [form, setForm] = useState(VACIO);
  const [detalle, setDetalle] = useState(null);
  const [busca, setBusca] = useState("");
  const [menuDescarga, setMenuDescarga] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [fAlmacen, setFAlmacen] = useState("");
  const [fUsuario, setFUsuario] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fDocumento, setFDocumento] = useState("");
  const [fTransaccion, setFTransaccion] = useState("");
  const limpiarFiltros = () => { setFAlmacen(""); setFUsuario(""); setFCliente(""); setFDocumento(""); setFTransaccion(""); };
  const filtrosActivos = [fAlmacen, fUsuario, fCliente, fDocumento, fTransaccion].filter(Boolean).length;
  const [mounted, setMounted] = useState(false);
  const [sync, setSync] = useState(supabase ? "cargando" : "local");
  useEffect(() => { setMounted(true); }, []);

  // Cargar datos compartidos desde la nube al abrir
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data, error } = await supabase.from("datos").select("contenido").eq("id", 1).single();
        if (error) throw error;
        const c = data?.contenido || {};
        if (Array.isArray(c.usuarios) && c.usuarios.length) setUsuarios(c.usuarios);
        if (Array.isArray(c.almacenes) && c.almacenes.length) setAlmacenes(c.almacenes);
        if (Array.isArray(c.entregas)) setEntregas(c.entregas);
        if (Array.isArray(c.traslados)) setTraslados(c.traslados);
        setSync("ok");
      } catch (err) { setSync("error"); }
    })();
  }, []);

  // Guardar en la nube (se llama tras cualquier cambio del admin o registro)
  const guardarBD = async (next = {}) => {
    if (!supabase) return;
    try {
      const contenido = {
        usuarios: next.usuarios ?? usuarios,
        almacenes: next.almacenes ?? almacenes,
        entregas: next.entregas ?? entregas,
        traslados: next.traslados ?? traslados,
      };
      const { error } = await supabase.from("datos").upsert({ id: 1, contenido });
      if (error) throw error;
      setSync("ok");
    } catch (err) { setSync("error"); }
  };

  // ---- Acceso con PIN ----
  const [selUsuario, setSelUsuario] = useState(null); // usuario elegido, pendiente de PIN
  const [pinTecleado, setPinTecleado] = useState("");
  const [pinMal, setPinMal] = useState(false);

  const elegirUsuario = (u) => { setSelUsuario(u); setPinTecleado(""); setPinMal(false); };
  const teclear = (d) => {
    if (pinTecleado.length >= 4) return;
    const np = pinTecleado + d;
    setPinTecleado(np); setPinMal(false);
    if (np.length === 4) {
      setTimeout(() => {
        if (np === (selUsuario.pin || "")) {
          setUsuario({ ...selUsuario, almacen: selUsuario.almacen === "Todos" ? "Todos" : nombreAlm(selUsuario.almacen) }); setVista("lista"); setSelUsuario(null); setPinTecleado("");
        } else {
          setPinMal(true); setPinTecleado("");
        }
      }, 120);
    }
  };
  const borrarDigito = () => setPinTecleado((p) => p.slice(0, -1));

  const puede = (p) => usuario && usuario.permisos.includes(p);
  const esAdmin = () => puede("admin");
  const prefijoDe = (nombreAlm) => (almacenes.find((a) => a.nombre === nombreAlm)?.prefijo) || "";
  const prefijoTDe = (nombreAlm) => (almacenes.find((a) => a.nombre === nombreAlm)?.prefijoT) || "";

  // ---- Cámara ----
  const [camActiva, setCamActiva] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const abrirCamara = async () => {
    setCamActiva(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (err) {
      alert("No se pudo abrir la cámara. Revisa los permisos del navegador.");
      setCamActiva(false);
    }
  };
  const cerrarCamara = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCamActiva(false);
  }, []);
  const tomarFoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    const max = 1000;
    const escala = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = v.videoWidth * escala;
    canvas.height = v.videoHeight * escala;
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    if (destinoFoto === "traslado") setFormT((f) => ({ ...f, fecha: f.fecha || ahora(), fotos: [...(f.fotos || []), dataUrl] }));
    else setForm((f) => ({ ...f, fecha: f.fecha || ahora(), fotos: [...(f.fotos || []), dataUrl] }));
    cerrarCamara();
  };
  useEffect(() => () => cerrarCamara(), [cerrarCamara]);

  // ---- Elegir fotos desde galería/archivos (varias a la vez) ----
  const fileFotoRef = useRef(null);
  const fileFotoTRef = useRef(null);
  const [destinoFoto, setDestinoFoto] = useState("entrega"); // entrega | traslado
  const [destinoFirma, setDestinoFirma] = useState("entrega");
  const comprimir = (file, cb) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 1000;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = img.width * escala; canvas.height = img.height * escala;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const elegirArchivoT = (ev) => {
    Array.from(ev.target.files || []).forEach((file) =>
      comprimir(file, (url) => setFormT((f) => ({ ...f, fecha: f.fecha || ahora(), fotos: [...(f.fotos || []), url] })))
    );
    ev.target.value = "";
  };
  const elegirArchivo = (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const max = 1000;
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = img.width * escala;
          canvas.height = img.height * escala;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          const url = canvas.toDataURL("image/jpeg", 0.7);
          setForm((f) => ({ ...f, fecha: f.fecha || ahora(), fotos: [...(f.fotos || []), url] }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    ev.target.value = "";
  };

  // ---- Firma ----
  const [firmando, setFirmando] = useState(false);
  const sigRef = useRef(null);
  const dibujando = useRef(false);
  const iniciarFirma = () => { setFirmando(true); };
  useEffect(() => {
    if (!firmando) return;
    const canvas = sigRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#16181d";
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) };
    };
    const start = (e) => { e.preventDefault(); dibujando.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if (!dibujando.current) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end = () => { dibujando.current = false; };
    canvas.addEventListener("mousedown", start); canvas.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start); canvas.removeEventListener("mousemove", move); window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start); canvas.removeEventListener("touchmove", move); window.removeEventListener("touchend", end);
    };
  }, [firmando]);
  const limpiarFirma = () => { const c = sigRef.current; if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height); };
  const guardarFirma = () => {
    const c = sigRef.current;
    const data = c.toDataURL("image/png");
    if (destinoFirma === "traslado") setFormT((f) => ({ ...f, firma: data }));
    else setForm((f) => ({ ...f, firma: data }));
    setFirmando(false);
  };

  // ---- Guardar entrega ----
  const guardar = () => {
    const transaccionFinal = (prefijoDe(form.almacen) + (form.numero || "")).trim();
    if (!transaccionFinal && !form.cliente.trim()) {
      alert("Ingresa al menos el número de transacción o el nombre del cliente."); return;
    }
    const nueva = { ...form, transaccion: transaccionFinal, id: Date.now(), registradoPor: usuario?.nombre || "—" };
    const next = [nueva, ...entregas];
    setEntregas(next);
    guardarBD({ entregas: next });
    setForm(VACIO);
    setVista("lista");
  };
  const eliminar = (id) => {
    const next = entregas.filter((x) => x.id !== id);
    setEntregas(next); guardarBD({ entregas: next });
    setDetalle(null); setVista("lista");
  };

  // ---- Traslados ----
  const guardarTraslado = () => {
    const docFinal = (prefijoTDe(formT.origen) + (formT.numero || "")).trim();
    if (!formT.origen) { alert("Elige el almacén de origen."); return; }
    if (!formT.destino) { alert("Elige el almacén de destino."); return; }
    if (formT.origen === formT.destino) { alert("El origen y el destino no pueden ser el mismo almacén."); return; }
    const nuevo = { ...formT, transaccion: docFinal, id: Date.now(), registradoPor: usuario?.nombre || "—" };
    const next = [nuevo, ...traslados];
    setTraslados(next); guardarBD({ traslados: next });
    setFormT(VACIO_T); setVista("lista");
  };
  const eliminarTraslado = (id) => {
    const next = traslados.filter((x) => x.id !== id);
    setTraslados(next); guardarBD({ traslados: next });
    setDetalle(null); setVista("lista");
  };

  // ---- Informes ----
  const descargarExcel = (lista, etiqueta = "") => {
    const cols = ["Transacción", "Fecha", "Cliente", "Documento origen", "Almacén", "Es moto", "Motor", "Chasis", "Registrado por", "Firmado"];
    const filas = lista.map((e) => [
      e.transaccion, fmtFecha(e.fecha), e.cliente, e.documento, e.almacen,
      e.esMoto ? "Sí" : "No", e.motor || "", e.chasis || "", e.registradoPor || "", e.firma ? "Sí" : "No",
    ]);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [cols, ...filas].map((f) => f.map(esc).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `entregas${etiqueta ? "-" + etiqueta : ""}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const descargarPDF = (lista, etiqueta = "") => {
    const filas = lista.map((e) => `
      <tr>
        <td>${e.transaccion || "—"}</td><td>${fmtFecha(e.fecha)}</td>
        <td>${e.cliente || "—"}</td><td>${e.almacen || "—"}</td>
        <td>${e.esMoto ? `Motor: ${e.motor || "—"}<br>Chasis: ${e.chasis || "—"}` : "—"}</td>
        <td>${e.registradoPor || "—"}</td><td>${e.firma ? "Sí" : "No"}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Informe de entregas</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#16181d}h1{font-size:20px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
      th,td{border:1px solid #e3e6ea;padding:7px 9px;text-align:left}th{background:#16181d;color:#fff}
      tr:nth-child(even){background:rgba(255,255,255,.04)}.meta{color:#8b929e;font-size:12px}</style></head>
      <body><h1>Informe de entregas · Distritodo</h1>
      <p class="meta">Generado el ${fmtFecha(ahora())} · ${lista.length} entregas${etiqueta ? " · " + etiqueta : ""}</p>
      <table><thead><tr><th>Transacción</th><th>Fecha</th><th>Cliente</th><th>Almacén</th><th>Moto</th><th>Registró</th><th>Firma</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    else alert("Permite las ventanas emergentes para generar el PDF.");
  };

  // Entregas visibles para el usuario (sin el filtro de búsqueda) = "todas las suyas"
  const todasMias = entregas.filter((e) => !(usuario && usuario.almacen !== "Todos" && e.almacen !== usuario.almacen));
  // Traslados visibles: el admin ve todos; los demás ven los de su almacén (como origen o destino)
  const trasladosVisibles = traslados.filter((t) => {
    if (!usuario || usuario.almacen === "Todos") return true;
    return t.origen === usuario.almacen || t.destino === usuario.almacen;
  });

  const filtradas = entregas.filter((e) => {
    // El admin (almacén "Todos") ve todo; los demás ven solo su almacén
    if (usuario && usuario.almacen !== "Todos" && e.almacen !== usuario.almacen) return false;
    // Filtros avanzados
    if (fAlmacen && e.almacen !== fAlmacen) return false;
    if (fUsuario && e.registradoPor !== fUsuario) return false;
    if (fCliente && !e.cliente?.toLowerCase().includes(fCliente.toLowerCase())) return false;
    if (fDocumento && !e.documento?.toLowerCase().includes(fDocumento.toLowerCase())) return false;
    if (fTransaccion && !e.transaccion?.toLowerCase().includes(fTransaccion.toLowerCase())) return false;
    // Búsqueda general
    const q = busca.toLowerCase();
    return !q || e.transaccion?.toLowerCase().includes(q) || e.cliente?.toLowerCase().includes(q) || e.documento?.toLowerCase().includes(q) || e.almacen?.toLowerCase().includes(q) || e.motor?.toLowerCase().includes(q) || e.chasis?.toLowerCase().includes(q) || e.registradoPor?.toLowerCase().includes(q);
  });

  const COL = { fondo: "#0a0f1c", tinta: "#eaf2ff", acento: "#22d3ee", acento2: "#34d399", borde: "#1e2a44", suave: "#7d8db3", panel: "#111a2e", marca: "#ff3b4e" };

  const cssGlobal = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');
        *{box-sizing:border-box;margin:0} input,select{font-family:inherit}
        body{font-family:'Manrope',system-ui,sans-serif}
        .mono{font-family:'IBM Plex Mono',monospace;letter-spacing:-.3px}
        @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,.0)}50%{box-shadow:0 0 18px 0 rgba(34,211,238,.25)}}
        .card{background:linear-gradient(180deg, rgba(30,42,68,.55), rgba(17,26,46,.75));border:1px solid ${COL.borde};border-radius:16px;box-shadow:0 8px 30px -16px rgba(0,0,0,.7);backdrop-filter:blur(8px)}
        .btn{cursor:pointer;border:none;border-radius:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;transition:transform .12s,box-shadow .2s,background .15s,filter .15s}
        .btn:active{transform:scale(.97)}
        .btn:hover{filter:brightness(1.08)}
        .ipt{width:100%;background:rgba(10,15,28,.6);border:1.5px solid ${COL.borde};border-radius:11px;padding:13px 14px;font-size:15px;color:${COL.tinta};outline:none;transition:.15s}
        .ipt::placeholder{color:#5a6a8f}
        .ipt:focus{border-color:${COL.acento};background:rgba(10,15,28,.9);box-shadow:0 0 0 3px rgba(34,211,238,.15)}
        select.ipt option{background:#111a2e;color:${COL.tinta}}
        .lbl{font-size:11px;font-weight:700;color:${COL.suave};margin-bottom:6px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.6px}
        .fab{position:fixed;bottom:24px;right:24px;width:62px;height:62px;border-radius:18px;background:linear-gradient(135deg,${COL.acento},#0891b2);color:#04141a;box-shadow:0 10px 30px -6px rgba(34,211,238,.5);z-index:30;animation:glow 3s infinite}
        .fab::after{content:"";position:absolute;inset:0;border-radius:18px;border:1px solid rgba(255,255,255,.2)}`;

  // ====== PANTALLA: ¿Quién soy? ======
  if (!usuario) {
    return (
      <div style={{ minHeight: "100vh", background: `radial-gradient(1000px 500px at 50% -10%, rgba(34,211,238,.1), transparent 60%), ${COL.fondo}`, color: COL.tinta, fontFamily: "'Manrope', system-ui, sans-serif",
        display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
        <style>{cssGlobal}</style>
        {/* textura de cuadrícula tenue + halo rojo */}
        <div style={{ position: "absolute", inset: 0, backgroundImage:
          "linear-gradient(rgba(34,211,238,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.04) 1px,transparent 1px)",
          backgroundSize: "38px 38px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,.1), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 440, margin: "0 auto", width: "100%", opacity: mounted ? 1 : 0, transition: "opacity .5s", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <img src="/logo-distritodo.jpg" alt="Distritodo" style={{ height: 56, objectFit: "contain", background: "#fff", padding: "8px 14px", borderRadius: 12 }}
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
            <div style={{ display: "none" }}>
              <div style={{ width: 56, height: 56, borderRadius: 15, background: "#e3000f", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Package size={28} color="#fff" /></div>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>DISTRITODO</h1>
            </div>
            <p style={{ color: COL.suave, fontSize: 14, marginTop: 12 }}>
              {selUsuario ? "Ingresa tu clave de 4 dígitos" : "Registro de entregas · ¿Quién eres?"}
            </p>
          </div>

          {/* Lista de usuarios */}
          {!selUsuario && (
            <div style={{ display: "grid", gap: 10 }}>
              {usuarios.map((u, i) => (
                <button key={u.id} className="btn card" onClick={() => elegirUsuario(u)}
                  style={{ padding: "16px 18px", justifyContent: "flex-start", gap: 14, animation: `up .4s ${i * 0.05}s both` }}>
                  <Avatar usuario={u} size={44} COL={COL} />
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{u.nombre}</div>
                    <div style={{ fontSize: 12, color: COL.suave, fontWeight: 500 }}>
                      {u.almacen === "Todos" ? "Acceso a todos los almacenes" : nombreAlm(u.almacen)}
                    </div>
                  </div>
                  <ChevronDown size={18} color={COL.suave} style={{ transform: "rotate(-90deg)" }} />
                </button>
              ))}
            </div>
          )}

          {/* Teclado de PIN */}
          {selUsuario && (
            <div className="card" style={{ padding: 24, animation: "up .3s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Avatar usuario={selUsuario} size={42} COL={COL} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{selUsuario.nombre}</div>
                  <div style={{ fontSize: 12, color: COL.suave }}>{selUsuario.almacen === "Todos" ? "Todos los almacenes" : selUsuario.almacen}</div>
                </div>
                <button className="btn" onClick={() => setSelUsuario(null)} style={{ background: "rgba(255,255,255,.04)", color: COL.suave, width: 34, height: 34, borderRadius: 9, border: `1px solid ${COL.borde}` }}><X size={16} /></button>
              </div>

              {/* Puntos del PIN */}
              <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 18 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: "50%",
                    background: pinMal ? "#e0334e" : pinTecleado.length > i ? COL.acento : "transparent",
                    border: `2px solid ${pinMal ? "#e0334e" : pinTecleado.length > i ? COL.acento : COL.borde}`, transition: ".15s" }} />
                ))}
              </div>
              {pinMal && <p style={{ textAlign: "center", color: "#e0334e", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Clave incorrecta, intenta de nuevo</p>}

              {/* Teclado numérico */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button key={n} className="btn" onClick={() => teclear(String(n))}
                    style={{ background: "rgba(255,255,255,.04)", color: COL.tinta, padding: "18px", fontSize: 22, fontWeight: 700, border: `1px solid ${COL.borde}` }}>{n}</button>
                ))}
                <div />
                <button className="btn" onClick={() => teclear("0")}
                  style={{ background: "rgba(255,255,255,.04)", color: COL.tinta, padding: "18px", fontSize: 22, fontWeight: 700, border: `1px solid ${COL.borde}` }}>0</button>
                <button className="btn" onClick={borrarDigito}
                  style={{ background: "transparent", color: COL.suave, padding: "18px" }}><ChevronLeft size={22} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 80% -10%, rgba(34,211,238,.08), transparent 60%), radial-gradient(900px 500px at -10% 10%, rgba(255,59,78,.05), transparent 55%), ${COL.fondo}`, color: COL.tinta,
      fontFamily: "'Manrope', system-ui, sans-serif", paddingBottom: 40 }}>
      <style>{cssGlobal}</style>

      {/* Header */}
      <header style={{ background: "rgba(10,15,28,.85)", borderBottom: `1px solid ${COL.borde}`, padding: "14px 20px", boxShadow: "0 4px 20px -8px rgba(0,0,0,.6)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${COL.acento}, ${COL.acento} 30%, transparent)` }} />
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn" onClick={() => {
              if (vista === "lista") { setUsuario(null); setBusca(""); }
              else { setVista("lista"); setForm(VACIO); setFormT(VACIO_T); setDetalle(null); }
            }} style={{ background: "rgba(255,255,255,.04)", color: COL.tinta, width: 38, height: 38, borderRadius: 11, border: `1px solid ${COL.borde}`, flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </button>
            <img src="/logo-distritodo.jpg" alt="Distritodo"
              style={{ height: 32, objectFit: "contain", background: "#fff", padding: "4px 8px", borderRadius: 8 }}
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
            <div style={{ display: "none", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#e3000f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={18} color="#fff" />
              </div>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -.5 }}>DISTRITODO</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span title={sync === "ok" ? "Datos sincronizados" : sync === "local" ? "Sin nube (solo este equipo)" : sync === "cargando" ? "Cargando…" : "Error de conexión"}
              style={{ display: "inline-flex", alignItems: "center", color: sync === "ok" ? COL.acento2 : sync === "local" ? COL.suave : sync === "cargando" ? COL.suave : "#e0334e" }}>
              {sync === "ok" ? <Cloud size={17} /> : sync === "cargando" ? <Cloud size={17} /> : <CloudOff size={17} />}
            </span>
            {esAdmin() && (
              <button className="btn" onClick={() => setVista(vista === "admin" ? "lista" : "admin")}
                style={{ background: vista === "admin" ? COL.acento : "rgba(255,255,255,.04)", color: vista === "admin" ? "#fff" : COL.suave, width: 38, height: 38, borderRadius: 11, border: `1px solid ${COL.borde}` }}>
                <Settings size={17} />
              </button>
            )}
            <button className="btn" onClick={() => { setUsuario(null); setVista("lista"); setBusca(""); }}
              style={{ background: "rgba(255,255,255,.04)", color: COL.suave, padding: "6px 12px 6px 6px", borderRadius: 11, border: `1px solid ${COL.borde}`, fontSize: 13 }}>
              <Avatar usuario={usuario} size={26} COL={COL} />
              <span style={{ maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuario.nombre.split(" ")[0]}</span>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px", opacity: mounted ? 1 : 0, transition: "opacity .4s" }}>

        {/* ====== LISTA ====== */}
        {vista === "lista" && (
          <div style={{ marginTop: 18 }}>
            {/* Selector Entregas / Traslados */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, background: "rgba(255,255,255,.04)", padding: 5, borderRadius: 13, border: `1px solid ${COL.borde}` }}>
              <button className="btn" onClick={() => { setTipoLista("entregas"); setBusca(""); }}
                style={{ flex: 1, background: tipoLista === "entregas" ? COL.acento : "transparent", color: tipoLista === "entregas" ? "#04141a" : COL.suave, padding: "10px", fontSize: 14 }}>
                <Package size={16} /> Entregas
              </button>
              <button className="btn" onClick={() => { setTipoLista("traslados"); setBusca(""); }}
                style={{ flex: 1, background: tipoLista === "traslados" ? COL.acento : "transparent", color: tipoLista === "traslados" ? "#04141a" : COL.suave, padding: "10px", fontSize: 14 }}>
                <ArrowLeftRight size={16} /> Traslados
              </button>
            </div>

            {tipoLista === "entregas" && (<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COL.suave, fontWeight: 600 }}>
                <Warehouse size={15} color={COL.acento} />
                {usuario.almacen === "Todos" ? "Todos los almacenes" : nombreAlm(usuario.almacen)}
                <span style={{ background: "rgba(255,255,255,.08)", borderRadius: 7, padding: "2px 8px", fontSize: 12 }}>{filtradas.length}</span>
              </div>
              {puede("informes") && (
                <div style={{ position: "relative" }}>
                  <button className="btn" onClick={() => setMenuDescarga((v) => !v)}
                    style={{ background: COL.acento, color: "#04141a", padding: "8px 14px", fontSize: 13 }}>
                    <Download size={15} /> Descargar <ChevronDown size={14} style={{ transform: menuDescarga ? "rotate(180deg)" : "none", transition: ".2s" }} />
                  </button>
                  {menuDescarga && (
                    <>
                      <div onClick={() => setMenuDescarga(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                      <div className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 41, width: 250, padding: 8, animation: "up .2s both" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: COL.suave, textTransform: "uppercase", letterSpacing: ".5px", padding: "6px 8px 4px" }}>Todas las entregas ({todasMias.length})</div>
                        <MenuItem icon={<FileSpreadsheet size={16} color="#00855f" />} txt="Excel · todas" onClick={() => { descargarExcel(todasMias, "todas"); setMenuDescarga(false); }} COL={COL} />
                        <MenuItem icon={<FileText size={16} color={COL.acento} />} txt="PDF · todas" onClick={() => { descargarPDF(todasMias, "Todas las entregas"); setMenuDescarga(false); }} COL={COL} />
                        <div style={{ height: 1, background: COL.borde, margin: "6px 4px" }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: COL.suave, textTransform: "uppercase", letterSpacing: ".5px", padding: "6px 8px 4px" }}>Lo que veo ahora ({filtradas.length})</div>
                        <MenuItem icon={<FileSpreadsheet size={16} color="#00855f" />} txt="Excel · filtrado" onClick={() => { descargarExcel(filtradas, "filtrado"); setMenuDescarga(false); }} COL={COL} />
                        <MenuItem icon={<FileText size={16} color={COL.acento} />} txt="PDF · filtrado" onClick={() => { descargarPDF(filtradas, "Filtrado"); setMenuDescarga(false); }} COL={COL} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={17} color={COL.suave} style={{ position: "absolute", left: 14, top: 14 }} />
                <input className="ipt" style={{ paddingLeft: 40 }} placeholder="Buscar en todo…"
                  value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <button className="btn" onClick={() => setFiltrosAbiertos((v) => !v)}
                style={{ background: filtrosActivos ? COL.acento : "rgba(255,255,255,.04)", color: filtrosActivos ? "#04141a" : COL.suave, padding: "0 14px", border: `1.5px solid ${filtrosActivos ? COL.acento : COL.borde}`, flexShrink: 0, position: "relative" }}>
                <SlidersHorizontal size={17} />
                {filtrosActivos > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: COL.acento, color: "#04141a", borderRadius: "50%", width: 18, height: 18, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{filtrosActivos}</span>}
              </button>
            </div>

            {/* Panel de filtros avanzados */}
            {filtrosAbiertos && (
              <div className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 12, animation: "up .2s both" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>Filtros avanzados</span>
                  {filtrosActivos > 0 && (
                    <button className="btn" onClick={limpiarFiltros} style={{ background: "transparent", color: COL.acento, padding: 4, fontSize: 13 }}>
                      <RotateCcw size={14} /> Limpiar
                    </button>
                  )}
                </div>
                {usuario.almacen === "Todos" && (
                  <div>
                    <div className="lbl"><Warehouse size={12} /> Almacén</div>
                    <select className="ipt" value={fAlmacen} onChange={(e) => setFAlmacen(e.target.value)}>
                      <option value="">Todos los almacenes</option>
                      {almacenes.map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <div className="lbl"><User size={12} /> Registrado por</div>
                  <select className="ipt" value={fUsuario} onChange={(e) => setFUsuario(e.target.value)}>
                    <option value="">Cualquier usuario</option>
                    {usuarios.map((u) => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <div className="lbl"><User size={12} /> Cliente</div>
                  <input className="ipt" value={fCliente} onChange={(e) => setFCliente(e.target.value)} placeholder="Nombre del cliente" />
                </div>
                <div>
                  <div className="lbl"><FileText size={12} /> Documento origen</div>
                  <input className="ipt" value={fDocumento} onChange={(e) => setFDocumento(e.target.value)} placeholder="Documento origen" />
                </div>
                <div>
                  <div className="lbl"><Hash size={12} /> Transacción</div>
                  <input className="ipt" value={fTransaccion} onChange={(e) => setFTransaccion(e.target.value)} placeholder="Número de transacción" />
                </div>
              </div>
            )}

            {filtradas.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: "center", color: COL.suave }}>
                <Package size={40} color={COL.borde} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontWeight: 600, color: COL.tinta }}>Sin entregas registradas</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>{puede("registrar") ? "Toca el botón + para registrar la primera." : "No hay entregas para mostrar."}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 11 }}>
                {filtradas.map((e, i) => (
                  <div key={e.id} className="card" style={{ padding: 15, display: "flex", gap: 13, alignItems: "center", cursor: "pointer", animation: `up .4s ${i * 0.04}s both` }}
                    onClick={() => { setDetalle(e); setVista("detalle"); }}>
                    <div style={{ position: "relative", width: 52, height: 52, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: COL.fondo, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(e.fotos?.[0] || e.foto) ? <img src={e.fotos?.[0] || e.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <ImageIcon size={20} color={COL.borde} />}
                      {e.fotos?.length > 1 && <span style={{ position: "absolute", bottom: 2, right: 2, background: "rgba(22,24,29,.8)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 6 }}>{e.fotos.length}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: COL.acento }}>{e.transaccion || "—"}</span>
                        {e.firma && <span style={{ fontSize: 10, background: "rgba(52,211,153,.15)", color: COL.acento2, padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>FIRMADO</span>}
                        {e.esMoto && <span style={{ fontSize: 10, background: "rgba(217,103,10,.18)", color: "#d9670a", padding: "2px 7px", borderRadius: 6, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><Bike size={10} /> MOTO</span>}
                      </div>
                      <p style={{ fontWeight: 700, fontSize: 15, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.cliente || "Sin cliente"}</p>
                      {e.recibe && (
                        <p style={{ fontSize: 12, color: COL.suave, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Recibe: <span style={{ color: COL.tinta, fontWeight: 600 }}>{e.recibe}</span>
                        </p>
                      )}
                      {e.documento && (
                        <p style={{ fontSize: 12, color: COL.tinta, marginTop: 2, display: "flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <FileText size={12} color={COL.suave} /> {e.documento}
                        </p>
                      )}
                      <p style={{ fontSize: 12, color: COL.suave, marginTop: 2 }}>
                        {e.almacen ? `${e.almacen} · ` : ""}{fmtFecha(e.fecha)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>)}

            {/* ===== Lista de TRASLADOS ===== */}
            {tipoLista === "traslados" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COL.suave, fontWeight: 600, marginBottom: 14 }}>
                  <ArrowLeftRight size={15} color={COL.acento} />
                  Traslados de mercancía
                  <span style={{ background: "rgba(255,255,255,.08)", borderRadius: 7, padding: "2px 8px", fontSize: 12 }}>{trasladosVisibles.length}</span>
                </div>
                {trasladosVisibles.length === 0 ? (
                  <div className="card" style={{ padding: 40, textAlign: "center", color: COL.suave }}>
                    <ArrowLeftRight size={40} color={COL.borde} style={{ margin: "0 auto 12px" }} />
                    <p style={{ fontWeight: 600, color: COL.tinta }}>Sin traslados registrados</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>{puede("registrar") ? "Toca el botón + para registrar uno." : "No hay traslados para mostrar."}</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 11 }}>
                    {trasladosVisibles.map((t, i) => (
                      <div key={t.id} className="card" style={{ padding: 15, display: "flex", gap: 13, alignItems: "center", cursor: "pointer", animation: `up .4s ${i * 0.04}s both` }}
                        onClick={() => { setDetalle(t); setVista("detalleT"); }}>
                        <div style={{ position: "relative", width: 52, height: 52, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: COL.fondo, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {t.fotos?.[0] ? <img src={t.fotos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ArrowLeftRight size={20} color={COL.borde} />}
                          {t.fotos?.length > 1 && <span style={{ position: "absolute", bottom: 2, right: 2, background: "rgba(22,24,29,.8)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 6 }}>{t.fotos.length}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: COL.acento }}>{t.transaccion || "—"}</span>
                            {t.firma && <span style={{ fontSize: 10, background: "rgba(52,211,153,.15)", color: COL.acento2, padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>FIRMADO</span>}
                          </div>
                          <p style={{ fontWeight: 700, fontSize: 14, marginTop: 3, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.origen} <ArrowRight size={13} color={COL.suave} /> {t.destino}
                          </p>
                          <p style={{ fontSize: 12, color: COL.suave, marginTop: 2 }}>{fmtFecha(t.fecha)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {vista === "nueva" && (
          <div style={{ marginTop: 18, animation: "up .3s both" }}>
            <button className="btn" onClick={() => { setForm(VACIO); setVista("lista"); }}
              style={{ background: "transparent", color: COL.suave, padding: "4px 0", marginBottom: 10, fontWeight: 600 }}>
              <ChevronLeft size={18} /> Cancelar
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Nueva entrega</h2>

            <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
              <div>
                <div className="lbl"><Hash size={13} /> Número de transacción</div>
                {prefijoDe(form.almacen) ? (
                  <div style={{ display: "flex", alignItems: "stretch", border: `1.5px solid ${COL.borde}`, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,.04)" }}>
                    <span className="mono" style={{ display: "flex", alignItems: "center", padding: "0 12px", background: "rgba(255,255,255,.06)", color: COL.acento, fontWeight: 700, fontSize: 14, borderRight: `1px solid ${COL.borde}`, whiteSpace: "nowrap" }}>
                      {prefijoDe(form.almacen)}
                    </span>
                    <input value={form.numero || ""} inputMode="numeric"
                      onChange={(e) => setForm({ ...form, numero: e.target.value })}
                      placeholder="número de entrega"
                      style={{ flex: 1, border: "none", background: "transparent", padding: "13px 14px", fontSize: 15, outline: "none", fontFamily: "'IBM Plex Mono', monospace", minWidth: 0, color: COL.tinta }} />
                  </div>
                ) : (
                  <input className="ipt" value={form.numero || ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Ej: TRX-00123" />
                )}
              </div>
              <div>
                <div className="lbl"><Calendar size={13} /> Fecha y hora</div>
                <input className="ipt" type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              <div>
                <div className="lbl"><User size={13} /> Cliente</div>
                <input className="ipt" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre del cliente (titular)" />
              </div>
              <div>
                <div className="lbl"><User size={13} /> Quién recibe</div>
                <input className="ipt" value={form.recibe} onChange={(e) => setForm({ ...form, recibe: e.target.value })} placeholder="Nombre de quien recibe la mercancía" />
              </div>
              <div>
                <div className="lbl"><FileText size={13} /> Documento origen</div>
                <input className="ipt" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="Ej: Factura / Remisión N°" />
              </div>
              <div>
                <div className="lbl"><Warehouse size={13} /> Almacén de entrega</div>
                {usuario.almacen === "Todos" ? (
                  <select className="ipt" value={form.almacen} onChange={(e) => setForm({ ...form, almacen: e.target.value })}>
                    <option value="">Elige un almacén…</option>
                    {almacenes.map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                ) : (
                  <div className="ipt" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.06)", color: COL.suave, cursor: "not-allowed" }}>
                    <Warehouse size={15} /> {nombreAlm(usuario.almacen)}
                    <span style={{ marginLeft: "auto", fontSize: 11 }}>asignado</span>
                  </div>
                )}
              </div>

              {/* Interruptor motocicleta (solo con permiso) */}
              {puede("motos") && (
              <div onClick={() => setForm({ ...form, esMoto: !form.esMoto })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: form.esMoto ? "rgba(34,211,238,.12)" : "rgba(255,255,255,.04)",
                  border: `1.5px solid ${form.esMoto ? COL.acento : COL.borde}`, borderRadius: 12, cursor: "pointer", transition: ".15s" }}>
                <Bike size={19} color={form.esMoto ? COL.acento : COL.suave} />
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: form.esMoto ? COL.acento : COL.tinta }}>Es una motocicleta</span>
                <div style={{ width: 44, height: 26, borderRadius: 99, background: form.esMoto ? COL.acento : "#cfd9e6", position: "relative", transition: ".2s" }}>
                  <div style={{ position: "absolute", top: 3, left: form.esMoto ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                </div>
              </div>
              )}

              {puede("motos") && form.esMoto && (
                <div style={{ display: "grid", gap: 14, padding: "14px", background: "rgba(34,211,238,.08)", borderRadius: 12, border: `1px dashed ${COL.acento}`, animation: "up .25s both" }}>
                  <div>
                    <div className="lbl"><Cog size={13} /> Número de motor</div>
                    <input className="ipt" value={form.motor} onChange={(e) => setForm({ ...form, motor: e.target.value })} placeholder="Número de motor" style={{ textTransform: "uppercase" }} />
                  </div>
                  <div>
                    <div className="lbl"><Bike size={13} /> Número de chasis (VIN)</div>
                    <input className="ipt" value={form.chasis} onChange={(e) => setForm({ ...form, chasis: e.target.value })} placeholder="Número de chasis" style={{ textTransform: "uppercase" }} />
                  </div>
                </div>
              )}

              {/* Fotos (varias) */}
              <div>
                <div className="lbl"><Camera size={13} /> Fotos de la entrega {form.fotos?.length > 0 && `(${form.fotos.length})`}</div>
                {form.fotos?.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                    {form.fotos.map((src, i) => (
                      <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: `1px solid ${COL.borde}` }}>
                        <img src={src} alt={`evidencia ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button className="btn" onClick={() => setForm({ ...form, fotos: form.fotos.filter((_, j) => j !== i) })}
                          style={{ position: "absolute", top: 4, right: 4, background: "rgba(22,24,29,.85)", color: "#fff", width: 26, height: 26, borderRadius: 8 }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={() => { setDestinoFoto("entrega"); abrirCamara(); }}
                    style={{ flex: 1, background: "rgba(255,255,255,.04)", border: `1.5px dashed ${COL.acento}`, color: COL.acento, padding: "14px" }}>
                    <Camera size={18} /> Tomar foto
                  </button>
                  <input ref={fileFotoRef} type="file" accept="image/*" multiple onChange={elegirArchivo} style={{ display: "none" }} />
                  <button className="btn" onClick={() => fileFotoRef.current?.click()}
                    style={{ flex: 1, background: "rgba(255,255,255,.04)", border: `1.5px dashed ${COL.suave}`, color: COL.suave, padding: "14px" }}>
                    <ImageIcon size={18} /> Galería
                  </button>
                </div>
                {form.fotos?.length > 0 && (
                  <p style={{ fontSize: 11, color: COL.suave, marginTop: 6, textAlign: "center" }}>Puedes seguir agregando más fotos.</p>
                )}
              </div>

              {/* Firma */}
              <div>
                <div className="lbl"><PenLine size={13} /> Firma del cliente</div>
                {form.firma ? (
                  <div style={{ position: "relative" }}>
                    <img src={form.firma} alt="firma" style={{ width: "100%", height: 120, objectFit: "contain", borderRadius: 12, border: `1px solid ${COL.borde}`, background: "#fff" }} />
                    <button className="btn" onClick={() => setForm({ ...form, firma: null })}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(15,41,66,.8)", color: "#fff", width: 34, height: 34, borderRadius: 10 }}><X size={17} /></button>
                  </div>
                ) : (
                  <button className="btn" onClick={() => { setDestinoFirma("entrega"); iniciarFirma(); }}
                    style={{ width: "100%", background: "rgba(255,255,255,.04)", border: `1.5px dashed ${COL.acento2}`, color: COL.acento2, padding: "16px" }}>
                    <PenLine size={19} /> Capturar firma
                  </button>
                )}
              </div>

              <button className="btn" onClick={guardar} style={{ background: COL.acento, color: "#04141a", padding: "16px", fontSize: 16, marginTop: 4 }}>
                <Check size={20} /> Guardar entrega
              </button>
            </div>
          </div>
        )}

        {/* ====== DETALLE ====== */}
        {vista === "detalle" && detalle && (
          <div style={{ marginTop: 18, animation: "up .3s both" }}>
            <button className="btn" onClick={() => setVista("lista")}
              style={{ background: "transparent", color: COL.suave, padding: "4px 0", marginBottom: 10, fontWeight: 600 }}>
              <ChevronLeft size={18} /> Volver
            </button>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: COL.acento }}>{detalle.transaccion || "—"}</span>
                  <h2 style={{ fontSize: 21, fontWeight: 800, marginTop: 2 }}>{detalle.cliente || "Sin cliente"}</h2>
                </div>
                {puede("editar") && (
                  <button className="btn" onClick={() => eliminar(detalle.id)} style={{ background: "rgba(255,59,78,.15)", color: "#e0334e", width: 38, height: 38, borderRadius: 11 }}><Trash2 size={17} /></button>
                )}
              </div>

              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                <Dato icon={<Calendar size={14} />} lbl="Fecha" val={fmtFecha(detalle.fecha)} col={COL} />
                {detalle.recibe && <Dato icon={<User size={14} />} lbl="Quién recibe" val={detalle.recibe} col={COL} />}
                <Dato icon={<Warehouse size={14} />} lbl="Almacén de entrega" val={detalle.almacen || "—"} col={COL} />
                <Dato icon={<FileText size={14} />} lbl="Documento origen" val={detalle.documento || "—"} col={COL} />
                {detalle.esMoto && <Dato icon={<Cog size={14} />} lbl="Número de motor" val={detalle.motor || "—"} col={COL} />}
                {detalle.esMoto && <Dato icon={<Bike size={14} />} lbl="Número de chasis" val={detalle.chasis || "—"} col={COL} />}
                <Dato icon={<User size={14} />} lbl="Registrado por" val={detalle.registradoPor || "—"} col={COL} />
              </div>

              {(() => {
                const fotos = detalle.fotos?.length ? detalle.fotos : (detalle.foto ? [detalle.foto] : []);
                if (!fotos.length) return null;
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div className="lbl"><Camera size={13} /> Evidencias ({fotos.length})</div>
                    <div style={{ display: "grid", gridTemplateColumns: fotos.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
                      {fotos.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                          <img src={src} alt={`evidencia ${i + 1}`} style={{ width: "100%", borderRadius: 12, border: `1px solid ${COL.borde}`, display: "block" }} />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {detalle.firma && (
                <div>
                  <div className="lbl"><PenLine size={13} /> Firma</div>
                  <img src={detalle.firma} alt="firma" style={{ width: "100%", height: 120, objectFit: "contain", borderRadius: 12, border: `1px solid ${COL.borde}`, background: "#fff" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== NUEVO TRASLADO ====== */}
        {vista === "nuevaT" && (
          <div style={{ marginTop: 18, animation: "up .3s both" }}>
            <button className="btn" onClick={() => { setFormT(VACIO_T); setVista("lista"); }}
              style={{ background: "transparent", color: COL.suave, padding: "4px 0", marginBottom: 10, fontWeight: 600 }}>
              <ChevronLeft size={18} /> Cancelar
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowLeftRight size={22} color={COL.acento} /> Nuevo traslado
            </h2>

            <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
              <div>
                <div className="lbl"><Warehouse size={13} /> Almacén de origen</div>
                {usuario.almacen === "Todos" ? (
                  <select className="ipt" value={formT.origen} onChange={(e) => setFormT({ ...formT, origen: e.target.value })}>
                    <option value="">Elige el origen…</option>
                    {almacenes.map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                ) : (
                  <div className="ipt" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.06)", color: COL.suave }}>
                    <Warehouse size={15} /> {nombreAlm(usuario.almacen)} <span style={{ marginLeft: "auto", fontSize: 11 }}>asignado</span>
                  </div>
                )}
              </div>
              <div>
                <div className="lbl"><ArrowRight size={13} /> Almacén de destino</div>
                <select className="ipt" value={formT.destino} onChange={(e) => setFormT({ ...formT, destino: e.target.value })}>
                  <option value="">Elige el destino…</option>
                  {almacenes.filter((a) => a.nombre !== formT.origen).map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <div className="lbl"><Hash size={13} /> Número de documento</div>
                {prefijoTDe(formT.origen) ? (
                  <div style={{ display: "flex", alignItems: "stretch", border: `1.5px solid ${COL.borde}`, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,.04)" }}>
                    <span className="mono" style={{ display: "flex", alignItems: "center", padding: "0 12px", background: "rgba(255,255,255,.08)", color: COL.acento, fontWeight: 700, fontSize: 14, borderRight: `1px solid ${COL.borde}`, whiteSpace: "nowrap" }}>{prefijoTDe(formT.origen)}</span>
                    <input value={formT.numero || ""} inputMode="numeric" onChange={(e) => setFormT({ ...formT, numero: e.target.value })}
                      placeholder="número de traslado" style={{ flex: 1, border: "none", background: "transparent", padding: "13px 14px", fontSize: 15, outline: "none", fontFamily: "'IBM Plex Mono', monospace", minWidth: 0, color: COL.tinta }} />
                  </div>
                ) : (
                  <input className="ipt" value={formT.numero || ""} onChange={(e) => setFormT({ ...formT, numero: e.target.value })} placeholder="Elige primero el origen" />
                )}
              </div>
              <div>
                <div className="lbl"><User size={13} /> Quién recibe</div>
                <input className="ipt" value={formT.recibe} onChange={(e) => setFormT({ ...formT, recibe: e.target.value })} placeholder="Nombre de quien recibe en destino" />
              </div>

              {/* Fotos del traslado */}
              <div>
                <div className="lbl"><Camera size={13} /> Fotos del traslado {formT.fotos?.length > 0 && `(${formT.fotos.length})`}</div>
                {formT.fotos?.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                    {formT.fotos.map((src, i) => (
                      <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: `1px solid ${COL.borde}` }}>
                        <img src={src} alt={`traslado ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button className="btn" onClick={() => setFormT({ ...formT, fotos: formT.fotos.filter((_, j) => j !== i) })}
                          style={{ position: "absolute", top: 4, right: 4, background: "rgba(22,24,29,.85)", color: "#fff", width: 26, height: 26, borderRadius: 8 }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={() => { setDestinoFoto("traslado"); abrirCamara(); }}
                    style={{ flex: 1, background: "rgba(255,255,255,.04)", border: `1.5px dashed ${COL.acento}`, color: COL.acento, padding: "14px" }}>
                    <Camera size={18} /> Tomar foto
                  </button>
                  <input ref={fileFotoTRef} type="file" accept="image/*" multiple onChange={elegirArchivoT} style={{ display: "none" }} />
                  <button className="btn" onClick={() => fileFotoTRef.current?.click()}
                    style={{ flex: 1, background: "rgba(255,255,255,.04)", border: `1.5px dashed ${COL.suave}`, color: COL.suave, padding: "14px" }}>
                    <ImageIcon size={18} /> Galería
                  </button>
                </div>
              </div>

              {/* Firma */}
              <div>
                <div className="lbl"><PenLine size={13} /> Firma de quien recibe</div>
                {formT.firma ? (
                  <div style={{ position: "relative" }}>
                    <img src={formT.firma} alt="firma" style={{ width: "100%", height: 120, objectFit: "contain", borderRadius: 12, border: `1px solid ${COL.borde}`, background: "#fff" }} />
                    <button className="btn" onClick={() => setFormT({ ...formT, firma: null })}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(22,24,29,.8)", color: "#fff", width: 34, height: 34, borderRadius: 10 }}><X size={17} /></button>
                  </div>
                ) : (
                  <button className="btn" onClick={() => { setDestinoFirma("traslado"); iniciarFirma(); }}
                    style={{ width: "100%", background: "rgba(255,255,255,.04)", border: `1.5px dashed ${COL.acento2}`, color: COL.acento2, padding: "16px" }}>
                    <PenLine size={19} /> Capturar firma
                  </button>
                )}
              </div>

              <button className="btn" onClick={guardarTraslado} style={{ background: COL.acento, color: "#04141a", padding: "16px", fontSize: 16, marginTop: 4 }}>
                <Check size={20} /> Guardar traslado
              </button>
            </div>
          </div>
        )}

        {/* ====== DETALLE TRASLADO ====== */}
        {vista === "detalleT" && detalle && (
          <div style={{ marginTop: 18, animation: "up .3s both" }}>
            <button className="btn" onClick={() => setVista("lista")}
              style={{ background: "transparent", color: COL.suave, padding: "4px 0", marginBottom: 10, fontWeight: 600 }}>
              <ChevronLeft size={18} /> Volver
            </button>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: COL.acento }}>{detalle.transaccion || "—"}</span>
                  <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    {detalle.origen} <ArrowRight size={16} color={COL.suave} /> {detalle.destino}
                  </h2>
                </div>
                {puede("editar") && (
                  <button className="btn" onClick={() => eliminarTraslado(detalle.id)} style={{ background: "rgba(255,59,78,.15)", color: "#e0334e", width: 38, height: 38, borderRadius: 11 }}><Trash2 size={17} /></button>
                )}
              </div>
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                <Dato icon={<Calendar size={14} />} lbl="Fecha" val={fmtFecha(detalle.fecha)} col={COL} />
                <Dato icon={<Warehouse size={14} />} lbl="Origen" val={detalle.origen || "—"} col={COL} />
                <Dato icon={<ArrowRight size={14} />} lbl="Destino" val={detalle.destino || "—"} col={COL} />
                {detalle.recibe && <Dato icon={<User size={14} />} lbl="Quién recibe" val={detalle.recibe} col={COL} />}
                <Dato icon={<User size={14} />} lbl="Registrado por" val={detalle.registradoPor || "—"} col={COL} />
              </div>
              {detalle.fotos?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div className="lbl"><Camera size={13} /> Evidencias ({detalle.fotos.length})</div>
                  <div style={{ display: "grid", gridTemplateColumns: detalle.fotos.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
                    {detalle.fotos.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`evidencia ${i + 1}`} style={{ width: "100%", borderRadius: 12, border: `1px solid ${COL.borde}`, display: "block" }} /></a>
                    ))}
                  </div>
                </div>
              )}
              {detalle.firma && (
                <div>
                  <div className="lbl"><PenLine size={13} /> Firma</div>
                  <img src={detalle.firma} alt="firma" style={{ width: "100%", height: 120, objectFit: "contain", borderRadius: 12, border: `1px solid ${COL.borde}`, background: "#fff" }} />
                </div>
              )}
            </div>
          </div>
        )}
        {/* ====== ADMINISTRACIÓN ====== */}
        {vista === "admin" && esAdmin() && (
          <PanelAdmin COL={COL} usuarios={usuarios} setUsuarios={setUsuarios}
            almacenes={almacenes} setAlmacenes={setAlmacenes} volver={() => setVista("lista")}
            guardarBD={guardarBD} />
        )}
      </div>

      {/* Botón flotante: nueva entrega o traslado según la pestaña */}
      {vista === "lista" && puede("registrar") && (
        <button className="btn fab" onClick={() => {
          if (tipoLista === "traslados") {
            setFormT({ ...VACIO_T, fecha: ahora(), origen: usuario.almacen === "Todos" ? "" : usuario.almacen });
            setVista("nuevaT");
          } else {
            setForm({ ...VACIO, fecha: ahora(), almacen: usuario.almacen === "Todos" ? "" : usuario.almacen });
            setVista("nueva");
          }
        }}>
          <Plus size={28} />
        </button>
      )}

      {/* ====== Overlay CÁMARA ====== */}
      {camActiva && (
        <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50, display: "flex", flexDirection: "column" }}>
          <video ref={videoRef} playsInline muted style={{ flex: 1, width: "100%", objectFit: "cover" }} />
          <div style={{ padding: "20px 0 32px", background: "#000", display: "flex", justifyContent: "center", alignItems: "center", gap: 40 }}>
            <button className="btn" onClick={cerrarCamara} style={{ background: "rgba(255,255,255,.15)", color: "#fff", width: 56, height: 56, borderRadius: "50%" }}><X size={24} /></button>
            <button className="btn" onClick={tomarFoto} style={{ background: "#fff", width: 76, height: 76, borderRadius: "50%", border: "5px solid rgba(255,255,255,.4)" }}><Camera size={30} color="#16181d" /></button>
            <div style={{ width: 56 }} />
          </div>
        </div>
      )}

      {/* ====== Overlay FIRMA ====== */}
      {firmando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,41,66,.6)", zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ padding: 18, maxWidth: 520, margin: "0 auto", width: "100%" }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Firma del cliente</h3>
            <p style={{ fontSize: 13, color: COL.suave, marginBottom: 12 }}>Pide al cliente que firme con el dedo en el recuadro.</p>
            <canvas ref={sigRef} width={480} height={200}
              style={{ width: "100%", height: 200, background: "rgba(255,255,255,.04)", border: `1.5px solid ${COL.borde}`, borderRadius: 12, touchAction: "none" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={limpiarFirma} style={{ flex: 1, background: "rgba(255,255,255,.04)", color: COL.suave, padding: "13px", border: `1px solid ${COL.borde}` }}><RotateCcw size={17} /> Borrar</button>
              <button className="btn" onClick={() => setFirmando(false)} style={{ flex: 1, background: "rgba(255,59,78,.15)", color: "#e0334e", padding: "13px" }}><X size={17} /> Cancelar</button>
              <button className="btn" onClick={guardarFirma} style={{ flex: 1.4, background: COL.acento2, color: "#fff", padding: "13px" }}><Check size={18} /> Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== Avatar de usuario (foto o iniciales) ======
const iniciales = (nombre) => {
  const p = (nombre || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
};
function Avatar({ usuario, size = 44, COL }) {
  const esAdm = usuario?.permisos?.includes("admin");
  const bg = esAdm ? "#e3000f" : (COL?.acento || "#e3000f");
  if (usuario?.foto) {
    return <img src={usuario.foto} alt={usuario.nombre}
      style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: bg, color: "#fff", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.36 }}>
      {iniciales(usuario?.nombre)}
    </div>
  );
}

function MenuItem({ icon, txt, onClick, COL }) {
  return (
    <button className="btn" onClick={onClick}
      style={{ width: "100%", justifyContent: "flex-start", gap: 10, background: "transparent", color: COL.tinta, padding: "10px 8px", fontSize: 14, fontWeight: 600 }}
      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.04)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {icon} {txt}
    </button>
  );
}

function Dato({ icon, lbl, val, col }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,.04)", borderRadius: 11 }}>
      <span style={{ color: col.suave }}>{icon}</span>
      <span style={{ fontSize: 12, color: col.suave, fontWeight: 600, minWidth: 120 }}>{lbl}</span>
      <span style={{ fontSize: 14, fontWeight: 600, marginLeft: "auto", textAlign: "right" }}>{val}</span>
    </div>
  );
}

// ====== Panel de administración de usuarios y almacenes ======
const PERMS = {
  registrar: "Registrar entregas",
  ver: "Ver/consultar entregas",
  motos: "Registrar entregas de motocicletas",
  editar: "Editar o borrar entregas",
  informes: "Descargar informes (Excel/PDF)",
  admin: "Administrar usuarios y almacenes",
};

function PanelAdmin({ COL, usuarios, setUsuarios, almacenes, setAlmacenes, volver, guardarBD }) {
  const [tab, setTab] = useState("usuarios");
  const [editU, setEditU] = useState(null); // usuario en edición (objeto) o null
  const [nuevoAlm, setNuevoAlm] = useState("");
  const [nuevoPrefijo, setNuevoPrefijo] = useState("");
  const [nuevoPrefijoT, setNuevoPrefijoT] = useState("");
  const fotoUserRef = useRef(null);

  const elegirFotoUsuario = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const lado = 300;
        canvas.width = lado; canvas.height = lado;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        canvas.getContext("2d").drawImage(img, sx, sy, min, min, 0, 0, lado, lado);
        setEditU((u) => ({ ...u, foto: canvas.toDataURL("image/jpeg", 0.75) }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    ev.target.value = "";
  };

  const guardarUsuario = () => {
    if (!editU.nombre.trim()) { alert("El usuario necesita un nombre."); return; }
    if (!editU.pin || editU.pin.length !== 4) { alert("Asigna una clave de 4 dígitos."); return; }
    const next = editU.id
      ? usuarios.map((u) => u.id === editU.id ? editU : u)
      : [...usuarios, { ...editU, id: Date.now() }];
    setUsuarios(next); guardarBD && guardarBD({ usuarios: next });
    setEditU(null);
  };
  const borrarUsuario = (id) => {
    const next = usuarios.filter((u) => u.id !== id);
    setUsuarios(next); guardarBD && guardarBD({ usuarios: next });
  };
  const togglePerm = (p) => {
    setEditU((u) => ({ ...u, permisos: u.permisos.includes(p) ? u.permisos.filter((x) => x !== p) : [...u.permisos, p] }));
  };
  const agregarAlmacen = () => {
    const n = nuevoAlm.trim();
    if (n && !almacenes.some((a) => a.nombre === n)) {
      const next = [...almacenes, { nombre: n, prefijo: nuevoPrefijo.trim(), prefijoT: nuevoPrefijoT.trim() }];
      setAlmacenes(next); guardarBD && guardarBD({ almacenes: next });
      setNuevoAlm(""); setNuevoPrefijo(""); setNuevoPrefijoT("");
    }
  };
  const borrarAlmacen = (nombre) => {
    const next = almacenes.filter((x) => x.nombre !== nombre);
    setAlmacenes(next); guardarBD && guardarBD({ almacenes: next });
  };
  const cambiarPrefijo = (nombre, prefijo) => {
    const next = almacenes.map((x) => x.nombre === nombre ? { ...x, prefijo } : x);
    setAlmacenes(next); guardarBD && guardarBD({ almacenes: next });
  };
  const cambiarPrefijoT = (nombre, prefijoT) => {
    const next = almacenes.map((x) => x.nombre === nombre ? { ...x, prefijoT } : x);
    setAlmacenes(next); guardarBD && guardarBD({ almacenes: next });
  };

  return (
    <div style={{ marginTop: 18, animation: "up .3s both" }}>
      <button className="btn" onClick={volver} style={{ background: "transparent", color: COL.suave, padding: "4px 0", marginBottom: 10, fontWeight: 600 }}>
        <ChevronLeft size={18} /> Volver
      </button>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Administración</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn" onClick={() => setTab("usuarios")} style={{ flex: 1, background: tab === "usuarios" ? COL.acento : "rgba(255,255,255,.04)", color: tab === "usuarios" ? "#04141a" : COL.suave, padding: "11px", border: `1px solid ${tab === "usuarios" ? COL.acento : COL.borde}` }}><Users size={16} /> Usuarios</button>
        <button className="btn" onClick={() => setTab("almacenes")} style={{ flex: 1, background: tab === "almacenes" ? COL.acento : "rgba(255,255,255,.04)", color: tab === "almacenes" ? "#04141a" : COL.suave, padding: "11px", border: `1px solid ${tab === "almacenes" ? COL.acento : COL.borde}` }}><Warehouse size={16} /> Almacenes</button>
      </div>

      {/* ---- USUARIOS ---- */}
      {tab === "usuarios" && !editU && (
        <div style={{ display: "grid", gap: 10 }}>
          {usuarios.map((u) => (
            <div key={u.id} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar usuario={u} size={40} COL={COL} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{u.nombre}</div>
                <div style={{ fontSize: 12, color: COL.suave }}>{nombreAlm(u.almacen)} · {u.permisos.length} permisos</div>
              </div>
              <button className="btn" onClick={() => setEditU({ ...u, almacen: u.almacen === "Todos" ? "Todos" : nombreAlm(u.almacen) })} style={{ background: "rgba(255,255,255,.04)", color: COL.suave, width: 34, height: 34, borderRadius: 9, border: `1px solid ${COL.borde}` }}><Settings size={15} /></button>
              <button className="btn" onClick={() => borrarUsuario(u.id)} style={{ background: "rgba(255,59,78,.15)", color: "#e0334e", width: 34, height: 34, borderRadius: 9 }}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="btn" onClick={() => setEditU({ nombre: "", almacen: almacenes[0]?.nombre || "Todos", pin: "", permisos: ["registrar", "ver"] })}
            style={{ background: COL.acento, color: "#04141a", padding: "14px", marginTop: 4 }}><Plus size={18} /> Nuevo usuario</button>
        </div>
      )}

      {/* ---- EDITAR USUARIO ---- */}
      {tab === "usuarios" && editU && (
        <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
          {/* Foto del usuario */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Avatar usuario={editU} size={84} COL={COL} />
            <input ref={fotoUserRef} type="file" accept="image/*" onChange={elegirFotoUsuario} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => fotoUserRef.current?.click()}
                style={{ background: "rgba(255,255,255,.04)", color: COL.acento, padding: "8px 14px", fontSize: 13, border: `1px solid ${COL.borde}` }}>
                <Camera size={15} /> {editU.foto ? "Cambiar foto" : "Agregar foto"}
              </button>
              {editU.foto && (
                <button className="btn" onClick={() => setEditU({ ...editU, foto: null })}
                  style={{ background: "rgba(255,59,78,.15)", color: "#e0334e", padding: "8px 12px", fontSize: 13 }}>
                  <X size={15} /> Quitar
                </button>
              )}
            </div>
          </div>
          <div>
            <div className="lbl"><User size={13} /> Nombre del usuario</div>
            <input className="ipt" value={editU.nombre} onChange={(e) => setEditU({ ...editU, nombre: e.target.value })} placeholder="Ej: Juan Pérez" />
          </div>
          <div>
            <div className="lbl"><Shield size={13} /> Clave de 4 dígitos</div>
            <input className="ipt" value={editU.pin || ""} inputMode="numeric" maxLength={4}
              onChange={(e) => setEditU({ ...editU, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              placeholder="Ej: 4582" style={{ letterSpacing: 6, fontWeight: 700 }} />
          </div>
          <div>
            <div className="lbl"><Warehouse size={13} /> Almacén asignado</div>
            <select className="ipt" value={editU.almacen} onChange={(e) => setEditU({ ...editU, almacen: e.target.value })}>
              <option value="Todos">Todos (acceso total)</option>
              {almacenes.map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
            </select>
          </div>
          <div>
            <div className="lbl"><Shield size={13} /> Permisos</div>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.entries(PERMS).map(([k, label]) => (
                <div key={k} onClick={() => togglePerm(k)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 11, cursor: "pointer",
                    background: editU.permisos.includes(k) ? "rgba(34,211,238,.12)" : "rgba(255,255,255,.04)", border: `1.5px solid ${editU.permisos.includes(k) ? COL.acento : COL.borde}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: editU.permisos.includes(k) ? COL.acento : "rgba(255,255,255,.04)", border: `1.5px solid ${editU.permisos.includes(k) ? COL.acento : COL.borde}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {editU.permisos.includes(k) && <Check size={14} color="#04141a" />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => setEditU(null)} style={{ flex: 1, background: "rgba(255,255,255,.04)", color: COL.suave, padding: "13px", border: `1px solid ${COL.borde}` }}><X size={17} /> Cancelar</button>
            <button className="btn" onClick={guardarUsuario} style={{ flex: 1.5, background: COL.acento, color: "#04141a", padding: "13px" }}><Check size={18} /> Guardar</button>
          </div>
        </div>
      )}

      {/* ---- ALMACENES ---- */}
      {tab === "almacenes" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "grid", gap: 8, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${COL.borde}` }}>
            <div className="lbl"><Warehouse size={13} /> Nuevo almacén</div>
            <input className="ipt" value={nuevoAlm} onChange={(e) => setNuevoAlm(e.target.value)} placeholder="Nombre (ej: Mompox)" />
            <input className="ipt mono" value={nuevoPrefijo} onChange={(e) => setNuevoPrefijo(e.target.value)} placeholder="Prefijo de entrega (ej: MOMPO/OUT/)" />
            <input className="ipt mono" value={nuevoPrefijoT} onChange={(e) => setNuevoPrefijoT(e.target.value)} placeholder="Prefijo de traslado (ej: MOMPO/INT/)"
              onKeyDown={(e) => e.key === "Enter" && agregarAlmacen()} />
            <button className="btn" onClick={agregarAlmacen} style={{ background: COL.acento, color: "#04141a", padding: "12px" }}><Plus size={18} /> Agregar almacén</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {almacenes.map((a) => (
              <div key={a.nombre} style={{ padding: "12px 14px", background: "rgba(255,255,255,.04)", borderRadius: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Warehouse size={16} color={COL.acento} />
                  <span style={{ fontWeight: 700, flex: 1 }}>{a.nombre}</span>
                  <button className="btn" onClick={() => borrarAlmacen(a.nombre)} style={{ background: "transparent", color: "#e0334e", padding: 4 }}><Trash2 size={16} /></button>
                </div>
                <div className="lbl" style={{ marginBottom: 4 }}>Prefijo de entrega</div>
                <input className="ipt mono" value={a.prefijo || ""} onChange={(e) => cambiarPrefijo(a.nombre, e.target.value)}
                  placeholder="Ej: MOMPO/OUT/" style={{ fontSize: 13, padding: "9px 11px", marginBottom: 8 }} />
                <div className="lbl" style={{ marginBottom: 4 }}>Prefijo de traslado</div>
                <input className="ipt mono" value={a.prefijoT || ""} onChange={(e) => cambiarPrefijoT(a.nombre, e.target.value)}
                  placeholder="Ej: MOMPO/INT/" style={{ fontSize: 13, padding: "9px 11px" }} />
              </div>
            ))}
            {almacenes.length === 0 && <p style={{ color: COL.suave, fontSize: 13, textAlign: "center", padding: 10 }}>Agrega tu primer almacén.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
