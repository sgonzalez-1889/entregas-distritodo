import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import {
  Plus, Trash2,
  Edit3, X, Check, Upload, AlertCircle, Activity, Zap, Store, Users, Lock, LogOut, Cloud, CloudOff
} from "lucide-react";

// ============================================================
//  CLAVE DE ADMINISTRADOR  ·  cámbiala por la que tú quieras
//  (escribe tu clave entre las comillas, sin borrar las comillas)
const CLAVE_ADMIN = "distritodo2026";
// ============================================================

// ============================================================
//  CONEXIÓN A LA BASE DE DATOS (Supabase)
//  Pega aquí los dos datos de tu proyecto de Supabase.
//  Los encuentras en: Supabase → tu proyecto → Settings → API
//   - SUPABASE_URL: el "Project URL" (empieza por https://)
//   - SUPABASE_KEY: la clave pública ("anon" o "publishable")
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_KEY = "TU_CLAVE_PUBLICA_AQUI";
// ============================================================

const hayBD = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_KEY.includes("TU_CLAVE");
const supabase = hayBD ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const ASESORES_INI = [
  { id: 1, nombre: "María González",   puntoVenta: "Sucursal Centro", meta: 500000, ventas: 380000, cotPendientes: 6, cotMonto: 210000,
    categorias: [
      { categoria: "MATERIALES", ventas: 240000, meta: 300000 },
      { categoria: "HOGAR", ventas: 80000, meta: 90000 },
      { categoria: "MOVILIDAD ELECTRICA", ventas: 45000, meta: 60000 },
      { categoria: "MOVILIDAD COMBUSTION", ventas: 15000, meta: 0 },
    ] },
  { id: 2, nombre: "Carlos Ramírez",   puntoVenta: "Sucursal Norte",  meta: 450000, ventas: 412000, cotPendientes: 3, cotMonto: 95000,
    categorias: [
      { categoria: "MATERIALES", ventas: 300000, meta: 280000 },
      { categoria: "MOVILIDAD COMBUSTION", ventas: 82000, meta: 90000 },
      { categoria: "HOGAR", ventas: 30000, meta: 0 },
      { categoria: "MOVILIDAD ELECTRICA", ventas: 0, meta: 40000 },
    ] },
  { id: 3, nombre: "Lucía Fernández",  puntoVenta: "Sucursal Sur",    meta: 600000, ventas: 295000, cotPendientes: 9, cotMonto: 340000 },
  { id: 4, nombre: "Jorge Medina",     puntoVenta: "Tienda Plaza",    meta: 400000, ventas: 410000, cotPendientes: 2, cotMonto: 48000 },
  { id: 5, nombre: "Ana Torres",       puntoVenta: "Sucursal Centro", meta: 520000, ventas: 233000, cotPendientes: 7, cotMonto: 280000 },
];
const PUNTOS_INI = [
  { id: 1, nombre: "Sucursal Centro", meta: 1200000, ventas: 940000, cotPendientes: 14, cotMonto: 520000 },
  { id: 2, nombre: "Sucursal Norte",  meta: 900000,  ventas: 870000, cotPendientes: 8,  cotMonto: 230000 },
  { id: 3, nombre: "Sucursal Sur",    meta: 1100000, ventas: 610000, cotPendientes: 19, cotMonto: 710000 },
  { id: 4, nombre: "Tienda Plaza",    meta: 700000,  ventas: 720000, cotPendientes: 5,  cotMonto: 140000 },
];

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

const hoy = new Date();
const diaActual = hoy.getDate();
const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
const fraccionMes = diaActual / diasMes;

function calcular(a) {
  const cumplimiento = a.meta ? (a.ventas / a.meta) * 100 : 0;
  const proyeccion = fraccionMes ? a.ventas / fraccionMes : a.ventas;
  const proyCumplimiento = a.meta ? (proyeccion / a.meta) * 100 : 0;
  const falta = Math.max(a.meta - a.ventas, 0);
  return { cumplimiento, proyeccion, proyCumplimiento, falta };
}
const colorCierre = (p) => (p >= 100 ? "#00f5a0" : "#ff4d6d");

function Ring({ pct, size = 58, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1b2540" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  );
}

// ---- Fila reutilizable ----
function Fila({ a, idx, editando, draft, setDraft, onEditar, onGuardar, onCancelar, onEliminar, mostrarPV, admin }) {
  const c = calcular(a);
  const col = colorCierre(c.proyCumplimiento);
  if (editando) {
    const campos = [["nombre","Nombre","text"]];
    if (mostrarPV) campos.push(["puntoVenta","Punto de venta","text"]);
    campos.push(["meta","Meta","number"],["ventas","Ventas","number"],
      ["cotPendientes","Cotiz. pend.","number"],["cotMonto","Monto cotiz.","number"]);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, alignItems: "end" }}>
        {campos.map(([k,l,t]) => (
          <label key={k} className="mono" style={{ fontSize: 11, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1 }}>{l}
            <input className="ipt" style={{ marginTop: 5 }} type={t} value={draft[k] ?? ""}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
          </label>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onGuardar} style={{ background: "linear-gradient(120deg,#00f5a0,#00c97f)", color: "#04140d", padding: "10px 14px" }}><Check size={16} /></button>
          <button className="iconbtn" onClick={onCancelar}><X size={16} color="#ff4d6d" /></button>
        </div>
      </div>
    );
  }
  const colCierre = colorCierre(c.proyCumplimiento);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Encabezado: rank + nombre + acciones */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 13, color: idx === 0 ? "#ffb020" : "#4a5b80", fontWeight: 700 }}>
              {idx === 0 ? "★" : `#${idx + 1}`}
            </span>
            <strong style={{ fontSize: 17, lineHeight: 1.2 }}>{a.nombre}</strong>
          </div>
          {mostrarPV && a.puntoVenta && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7,
              background: "rgba(124,92,255,.15)", border: "1px solid rgba(124,92,255,.35)",
              borderRadius: 8, padding: "3px 8px", color: "#b8a5ff", fontSize: 11 }}>
              <Store size={11} /> {a.puntoVenta}
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="mono" style={{ fontSize: 9, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1, minWidth: 78 }}>Ventas</span>
              <strong className="mono" style={{ fontSize: 13, color: "#dfe7f5" }}>{fmt(a.ventas)}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="mono" style={{ fontSize: 9, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1, minWidth: 78 }}>Presupuesto</span>
              <strong className="mono" style={{ fontSize: 13, color: "#4a5b80" }}>{fmt(a.meta)}</strong>
            </div>
          </div>
        </div>
        {admin && (
        <div style={{ display: "flex", gap: 6 }}>
          <div className="iconbtn" onClick={onEditar}><Edit3 size={14} color="#7d93b8" /></div>
          <div className="iconbtn" onClick={onEliminar}><Trash2 size={14} color="#ff4d6d" /></div>
        </div>
        )}
      </div>

      {/* Anillo central con % de cumplimiento */}
      <div style={{ display: "flex", justifyContent: "center", margin: "18px 0 16px", position: "relative" }}>
        <Ring pct={c.cumplimiento} color={col} size={120} stroke={9} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: col, lineHeight: 1 }}>{c.cumplimiento.toFixed(0)}%</div>
          <div className="mono" style={{ fontSize: 9, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>Cumplimiento</div>
        </div>
      </div>

      {/* Dos métricas % destacadas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: "auto" }}>
        <div style={{ background: "rgba(5,8,15,.5)", border: `1px solid ${col}40`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 9, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1 }}>% Cumplim.</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: col, marginTop: 4 }}>{c.cumplimiento.toFixed(0)}%</div>
        </div>
        <div style={{ background: "rgba(5,8,15,.5)", border: `1px solid ${colCierre}40`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 9, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1 }}>% al cierre</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colCierre, marginTop: 4 }}>{c.proyCumplimiento.toFixed(0)}%</div>
        </div>
      </div>
      {a.categorias && a.categorias.length > 0 && (
        <div className="mono" style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "#00e5ff",
          background: "rgba(0,229,255,.08)", border: "1px solid rgba(0,229,255,.25)", borderRadius: 10, padding: "8px", letterSpacing: .5 }}>
          Ver {a.categorias.length} categorías ›
        </div>
      )}
    </div>
  );
}

// ---- Sección (lista + KPIs propios) ----
function Seccion({ titulo, icono, acentoColor, items, setItems, editKey, edit, setEdit, draft, setDraft, mostrarPV, admin, persistir, onAbrir }) {
  const ranking = useMemo(() => [...items].sort((a, b) => calcular(b).cumplimiento - calcular(a).cumplimiento), [items]);
  const tot = useMemo(() => {
    const meta = items.reduce((s, a) => s + a.meta, 0);
    const ventas = items.reduce((s, a) => s + a.ventas, 0);
    const cot = items.reduce((s, a) => s + a.cotMonto, 0);
    return { meta, ventas, cot, proy: fraccionMes ? ventas / fraccionMes : ventas, cumpl: meta ? (ventas / meta) * 100 : 0 };
  }, [items]);

  const abrir = (a) => { setEdit({ key: editKey, id: a.id }); setDraft({ ...a }); };
  const guardar = () => {
    const nuevos = items.map((a) => a.id === edit.id ? { ...draft, meta:+draft.meta, ventas:+draft.ventas, cotPendientes:+draft.cotPendientes, cotMonto:+draft.cotMonto } : a);
    setItems(nuevos); setEdit(null);
    persistir && persistir(nuevos);
  };
  const agregar = () => {
    const id = Math.max(0, ...items.map((a) => a.id)) + 1;
    const nuevo = { id, nombre: "Nuevo", meta: 400000, ventas: 0, cotPendientes: 0, cotMonto: 0, ...(mostrarPV ? { puntoVenta: "" } : {}) };
    setItems([...items, nuevo]); abrir(nuevo);
  };
  const eliminar = (id) => {
    const nuevos = items.filter((x) => x.id !== id);
    setItems(nuevos);
    persistir && persistir(nuevos);
  };

  const kpis = [
    { lbl: "Ventas a la fecha", val: fmt(tot.ventas), c: "#00e5ff", sub: `${tot.cumpl.toFixed(0)}% de la meta` },
    { lbl: "Meta total", val: fmt(tot.meta), c: "#7c5cff", sub: `${items.length} registros` },
    { lbl: "Proyección cierre", val: fmt(tot.proy), c: "#00f5a0", sub: "según ritmo" },
    { lbl: "Pipeline cotizado", val: fmt(tot.cot), c: "#ffb020", sub: "cotizaciones" },
  ];

  return (
    <section style={{ marginBottom: 38 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 10, margin: 0, fontWeight: 600 }}>
          {React.cloneElement(icono, { size: 22, color: acentoColor, style: { filter: `drop-shadow(0 0 6px ${acentoColor})` } })}
          {titulo}
        </h2>
        {admin && (
        <button className="btn" onClick={agregar}
          style={{ background: "rgba(124,92,255,.15)", color: "#b8a5ff", padding: "10px 15px", border: "1px solid rgba(124,92,255,.4)" }}>
          <Plus size={16} /> Agregar
        </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        {kpis.map((k, i) => (
          <div key={i} className="glass" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.c, opacity: .7, boxShadow: `0 0 12px ${k.c}` }} />
            <div className="mono" style={{ color: k.c, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>{k.lbl}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10, letterSpacing: -.5 }}>{k.val}</div>
            <div style={{ color: "#7d93b8", fontSize: 12, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16, alignItems: "stretch" }}>
        {ranking.map((a, idx) => {
          const enEd = edit && edit.key === editKey && edit.id === a.id;
          return (
          <div key={a.id} className="glass rowcard" style={{ padding: 20, animation: `rise .5s ${idx * 0.05}s both`,
            gridColumn: enEd ? "1 / -1" : "auto", cursor: !enEd && a.categorias ? "pointer" : "default" }}
            onClick={(ev) => {
              if (enEd) return;
              if (ev.target.closest(".iconbtn")) return; // no abrir si tocó editar/eliminar
              if (a.categorias && a.categorias.length) onAbrir && onAbrir(a);
            }}>
            <Fila a={a} idx={idx}
              editando={enEd} mostrarPV={mostrarPV} admin={admin}
              draft={draft} setDraft={setDraft}
              onEditar={() => abrir(a)} onGuardar={guardar} onCancelar={() => setEdit(null)}
              onEliminar={() => eliminar(a.id)} />
          </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Modal de detalle por categoría padre ----
function DetalleCategorias({ registro, onCerrar }) {
  if (!registro) return null;
  const ORDEN = ["MATERIALES", "HOGAR", "MOVILIDAD ELECTRICA", "MOVILIDAD COMBUSTION"];
  const idxOrden = (n) => { const i = ORDEN.indexOf(String(n).toUpperCase()); return i === -1 ? 99 : i; };
  const cats = (registro.categorias || []).slice().sort((a, b) => idxOrden(a.categoria) - idxOrden(b.categoria) || b.ventas - a.ventas);
  const totalVentas = cats.reduce((s, c) => s + (c.ventas || 0), 0);
  const c = calcular(registro);
  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(2,4,10,.78)", backdropFilter: "blur(6px)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "rise .25s both" }}>
      <div onClick={(e) => e.stopPropagation()} className="glass" style={{ width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{registro.nombre}</h3>
            {registro.puntoVenta && <div className="mono" style={{ color: "#b8a5ff", fontSize: 12, marginTop: 4 }}>{registro.puntoVenta}</div>}
            <div className="mono" style={{ color: "#7d93b8", fontSize: 12, marginTop: 6 }}>Desglose por categoría</div>
          </div>
          <div className="iconbtn" onClick={onCerrar}><X size={16} color="#ff4d6d" /></div>
        </div>

        {/* Resumen total */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { l: "Ventas a la fecha", v: fmt(registro.ventas), c: "#00e5ff" },
            { l: "% Cumplimiento", v: c.cumplimiento.toFixed(0) + "%", c: colorCierre(c.proyCumplimiento) },
            { l: "Proyección cierre", v: c.proyCumplimiento.toFixed(0) + "%", c: colorCierre(c.proyCumplimiento) },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(5,8,15,.5)", border: `1px solid ${k.c}40`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 9, color: "#7d93b8", textTransform: "uppercase", letterSpacing: 1 }}>{k.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.c, marginTop: 5 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Lista de categorías */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cats.map((cat, i) => {
            const peso = totalVentas ? (cat.ventas / totalVentas) * 100 : 0;
            const cumpl = cat.meta ? (cat.ventas / cat.meta) * 100 : null;
            const proy = cat.meta && fraccionMes ? ((cat.ventas / fraccionMes) / cat.meta) * 100 : null;
            const col = cumpl == null ? "#4a5b80" : colorCierre(proy ?? cumpl);
            return (
              <div key={i} style={{ background: "rgba(5,8,15,.4)", border: "1px solid rgba(90,130,220,.18)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <strong style={{ fontSize: 14 }}>{cat.categoria}</strong>
                  <strong className="mono" style={{ fontSize: 14, color: "#dfe7f5" }}>{fmt(cat.ventas)}</strong>
                </div>
                {/* Barra de peso del total */}
                <div style={{ height: 7, background: "rgba(90,130,220,.15)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${Math.min(peso, 100)}%`, height: "100%", background: "linear-gradient(90deg,#00e5ff,#7c5cff)", borderRadius: 5, transition: "width .8s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: "#7d93b8" }}>{peso.toFixed(1)}% del total</span>
                  {cumpl == null ? (
                    <span className="mono" style={{ fontSize: 11, color: "#4a5b80" }}>sin meta cargada</span>
                  ) : (
                    <span style={{ display: "flex", gap: 12 }}>
                      <span className="mono" style={{ fontSize: 11, color: col }}>Cumpl: {cumpl.toFixed(0)}%</span>
                      {proy != null && <span className="mono" style={{ fontSize: 11, color: col }}>Cierre: {proy.toFixed(0)}%</span>}
                      <span className="mono" style={{ fontSize: 11, color: "#7d93b8" }}>Meta: {fmt(cat.meta)}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {!cats.length && <div className="mono" style={{ color: "#7d93b8", fontSize: 13, textAlign: "center", padding: 20 }}>Este registro no tiene categorías cargadas.</div>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [asesores, setAsesores] = useState(ASESORES_INI);
  const [puntos, setPuntos] = useState(PUNTOS_INI);
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState({});
  const [aviso, setAviso] = useState(null);
  const [detalle, setDetalle] = useState(null); // registro abierto para ver categorías
  const [mounted, setMounted] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [pinAbierto, setPinAbierto] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [sync, setSync] = useState("cargando"); // "cargando" | "ok" | "local" | "error"
  const fileRef = useRef(null);

  const intentarAdmin = () => {
    if (pin === CLAVE_ADMIN) {
      setAdmin(true); setPinAbierto(false); setPin(""); setPinError(false);
      setAviso({ tipo: "ok", txt: "Modo administrador activado." });
    } else {
      setPinError(true);
    }
  };
  const salirAdmin = () => { setAdmin(false); setEdit(null); setAviso({ tipo: "ok", txt: "Modo administrador desactivado." }); };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(null), 4000); return () => clearTimeout(t); } }, [aviso]);

  // Lee los datos guardados en la base de datos al abrir la app
  const cargarDesdeBD = async () => {
    if (!supabase) { setSync("local"); return; }
    try {
      const { data, error } = await supabase.from("datos").select("contenido").eq("id", 1).single();
      if (error) throw error;
      if (data && data.contenido) {
        if (Array.isArray(data.contenido.asesores)) setAsesores(data.contenido.asesores);
        if (Array.isArray(data.contenido.puntos)) setPuntos(data.contenido.puntos);
      }
      setSync("ok");
    } catch (err) {
      // Si la tabla está vacía o no existe aún, seguimos con datos de ejemplo
      setSync("error");
    }
  };
  useEffect(() => { cargarDesdeBD(); }, []);

  // Guarda los datos actuales en la base de datos (solo admin)
  const guardarEnBD = async (nuevosAsesores, nuevosPuntos) => {
    if (!supabase) return;
    try {
      const contenido = { asesores: nuevosAsesores, puntos: nuevosPuntos };
      const { error } = await supabase.from("datos").upsert({ id: 1, contenido });
      if (error) throw error;
      setSync("ok");
    } catch (err) {
      setSync("error");
      setAviso({ tipo: "err", txt: "Se guardó en tu pantalla, pero no en la nube. Revisa la conexión." });
    }
  };

  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const leerHoja = (wb, nombres) => {
    let ws = null;
    for (const n of nombres) { const k = wb.SheetNames.find((s) => norm(s) === norm(n)); if (k) { ws = wb.Sheets[k]; break; } }
    if (!ws) return null;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });
    return rows.map((r, i) => {
      const get = (...keys) => { for (const k of Object.keys(r)) if (keys.includes(norm(k))) return r[k]; return 0; };
      const pv = get("punto de venta", "puntoventa", "sucursal");
      return {
        id: i + 1, nombre: String(get("nombre") || `Registro ${i + 1}`),
        puntoVenta: pv ? String(pv) : "",
        meta: +get("meta") || 0, ventas: +get("ventas a la fecha", "ventas") || 0,
        cotPendientes: +get("cotizaciones pendientes", "cotizaciones") || 0,
        cotMonto: +get("monto cotizaciones", "monto") || 0,
      };
    }).filter((a) => a.nombre.trim());
  };

  // Lee una hoja de categorías. Soporta dos formatos:
  //  (A) ANCHO: una fila por nombre; cada categoría = bloque de columnas Presupuesto/Ventas/%Cumpl
  //  (B) LARGO: una fila por nombre+categoría (Nombre, Categoría, Ventas, Meta)
  const leerCategorias = (wb, nombres) => {
    let key = null;
    for (const n of nombres) { const k = wb.SheetNames.find((s) => norm(s) === norm(n)); if (k) { key = k; break; } }
    if (!key) return null;
    const ws = wb.Sheets[key];
    const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!matriz.length) return null;

    // Detectar formato ANCHO: en las primeras 2 filas hay celdas con nombres de categoría
    const CATS = ["MATERIALES", "HOGAR", "MOVILIDAD ELECTRICA", "MOVILIDAD COMBUSTION"];
    const fila0 = (matriz[0] || []).map((x) => norm(x));
    const esAncho = CATS.some((c) => fila0.includes(norm(c)));

    if (esAncho) {
      // Fila 0: nombres de categoría (cada bloque abarca Presupuesto/Ventas/%). Fila 1: subencabezados
      const f0 = matriz[0] || [], f1 = (matriz[1] || []).map((x) => norm(x));
      const cats = [];
      for (let c = 0; c < Math.max(f0.length, f1.length); c++) {
        if (norm(f1[c]) === "presupuesto") cats.push({ cat: f0[c] ? String(f0[c]).trim() : null, colPpto: c });
        if (norm(f1[c]) === "ventas" && cats.length) cats[cats.length - 1].colVentas = c;
      }
      let ultimaCat = null;
      const bloquesFinal = cats.map((b) => {
        if (b.cat) ultimaCat = b.cat; else b.cat = ultimaCat;
        return b;
      });
      const porNombre = {};
      for (let r = 2; r < matriz.length; r++) {
        const fila = matriz[r];
        const nombre = String(fila[0] || "").trim();
        if (!nombre || norm(nombre) === "total") continue;
        porNombre[nombre] = bloquesFinal.map((b) => ({
          categoria: b.cat,
          meta: +String(fila[b.colPpto] ?? "").replace(/[^0-9.-]/g, "") || 0,
          ventas: +String(fila[b.colVentas] ?? "").replace(/[^0-9.-]/g, "") || 0,
        }));
      }
      return porNombre;
    }

    // Formato LARGO
    const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });
    const porNombre = {};
    rows.forEach((r) => {
      const get = (...keys) => { for (const k of Object.keys(r)) if (keys.includes(norm(k))) return r[k]; return 0; };
      const nombre = String(get("nombre", "asesor", "tienda") || "").trim();
      const categoria = String(get("categoria", "categoria padre", "categoría") || "").trim();
      if (!nombre || !categoria) return;
      const ventas = +get("ventas a la fecha", "ventas") || 0;
      const meta = +get("presupuesto", "meta categoria", "meta categoría", "meta") || 0;
      (porNombre[nombre] = porNombre[nombre] || []).push({ categoria, ventas, meta });
    });
    return porNombre;
  };

  // Une las categorías a cada registro por nombre
  const unirCategorias = (registros, mapaCategorias) => {
    if (!mapaCategorias) return registros;
    return registros.map((r) => {
      const cats = mapaCategorias[r.nombre.trim()];
      if (!cats || !cats.length) return r;
      // La venta y meta totales se calculan sumando las categorías (una sola fuente de verdad)
      const ventasCat = cats.reduce((s, c) => s + (c.ventas || 0), 0);
      const metaCat = cats.reduce((s, c) => s + (c.meta || 0), 0);
      return {
        ...r,
        categorias: cats,
        ventas: ventasCat,
        meta: metaCat > 0 ? metaCat : r.meta, // si no hay presupuestos por categoría aún, conserva la meta de la hoja
      };
    });
  };

  const cargarExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const ase = leerHoja(wb, ["Asesores"]) || leerHoja(wb, [wb.SheetNames[0]]);
      const pv = leerHoja(wb, ["Puntos de Venta", "Puntos de venta", "Puntos"]);
      const catAse = leerCategorias(wb, ["Categorías Asesores", "Categorias Asesores", "Categorias Asesor"]);
      const catPv = leerCategorias(wb, ["Categorías Puntos", "Categorias Puntos", "Categorias Punto de Venta"]);
      let msg = [];
      let nuevosAse = asesores, nuevosPv = puntos;
      if (ase && ase.length) { nuevosAse = unirCategorias(ase, catAse); setAsesores(nuevosAse); msg.push(`${ase.length} asesores`); }
      if (pv && pv.length) { nuevosPv = unirCategorias(pv, catPv); setPuntos(nuevosPv); msg.push(`${pv.length} puntos de venta`); }
      const totalCats = (catAse ? Object.keys(catAse).length : 0) + (catPv ? Object.keys(catPv).length : 0);
      if (totalCats) msg.push(`categorías de ${totalCats} registros`);
      if (!msg.length) throw new Error("No se encontraron datos válidos.");
      await guardarEnBD(nuevosAse, nuevosPv);
      setAviso({ tipo: "ok", txt: `Cargado: ${msg.join(" y ")}.${supabase ? " Visible para todo el equipo." : ""}` });
    } catch (err) {
      setAviso({ tipo: "err", txt: `No se pudo leer el archivo: ${err.message}` });
    }
    e.target.value = "";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#05080f", color: "#dfe7f5", position: "relative",
      fontFamily: "'Space Grotesk', system-ui, sans-serif", padding: "40px 20px", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box} input{font-family:inherit}
        .mono{font-family:'JetBrains Mono',monospace}
        @keyframes rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes drift{from{transform:translate(0,0)}to{transform:translate(40px,40px)}}
        .glass{background:linear-gradient(150deg,rgba(22,32,56,.65),rgba(10,16,30,.55));
          border:1px solid rgba(90,130,220,.18);border-radius:20px;backdrop-filter:blur(14px);
          box-shadow:0 8px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05)}
        .glow-line{height:1px;background:linear-gradient(90deg,transparent,rgba(0,229,255,.6),transparent)}
        .ipt{background:rgba(5,8,15,.8);border:1px solid rgba(90,130,220,.3);border-radius:10px;color:#dfe7f5;padding:8px 11px;width:100%;outline:none;transition:.2s}
        .ipt:focus{border-color:#00e5ff;box-shadow:0 0 0 3px rgba(0,229,255,.15)}
        .btn{cursor:pointer;border:none;border-radius:12px;font-weight:600;display:inline-flex;align-items:center;gap:7px;transition:transform .15s,box-shadow .2s;font-family:inherit}
        .btn:hover{transform:translateY(-2px)}
        .rowcard{transition:transform .2s,border-color .2s}
        .rowcard:hover{transform:translateY(-4px);border-color:rgba(0,229,255,.4)}
        .iconbtn{cursor:pointer;border:1px solid rgba(90,130,220,.25);background:rgba(5,8,15,.6);border-radius:10px;padding:9px;display:flex;transition:.18s}
        .iconbtn:hover{transform:translateY(-2px);border-color:rgba(0,229,255,.5)}
      `}</style>

      <div style={{ position: "absolute", inset: 0, backgroundImage:
        "linear-gradient(rgba(90,130,220,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(90,130,220,.05) 1px,transparent 1px)",
        backgroundSize: "44px 44px", animation: "drift 8s linear infinite alternate", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -120, right: -80, width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(0,229,255,.18),transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -140, left: -100, width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(120,80,255,.16),transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1140, margin: "0 auto", position: "relative", opacity: mounted ? 1 : 0, transition: "opacity .6s" }}>
        <header style={{ marginBottom: 30, animation: "rise .6s both" }}>
          <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, color: "#00e5ff", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", flexWrap: "wrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00f5a0", boxShadow: "0 0 10px #00f5a0", animation: "pulse 2s infinite" }} />
            En vivo · Día {diaActual}/{diasMes} · {Math.round(fraccionMes * 100)}% del ciclo
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4,
              color: sync === "ok" ? "#00f5a0" : sync === "local" ? "#7d93b8" : "#ffb020" }}>
              {sync === "ok" ? <><Cloud size={13} /> Sincronizado</>
                : sync === "cargando" ? <><Cloud size={13} /> Cargando…</>
                : sync === "local" ? <><CloudOff size={13} /> Solo este equipo</>
                : <><CloudOff size={13} /> Sin conexión a la nube</>}
            </span>
          </div>
          <h1 style={{ fontSize: 44, margin: "10px 0 0", fontWeight: 700, letterSpacing: -1,
            background: "linear-gradient(120deg,#fff 30%,#00e5ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Ventas Distritodo
          </h1>
          <p style={{ color: "#7d93b8", margin: "6px 0 0", fontSize: 15 }}>Monitoreo de metas, proyección y pipeline por asesor y punto de venta</p>
          <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={cargarExcel} style={{ display: "none" }} />
            {admin && (
              <button className="btn" onClick={() => fileRef.current?.click()}
                style={{ background: "linear-gradient(120deg,#00e5ff,#00b3cc)", color: "#04141a", padding: "11px 18px", boxShadow: "0 4px 20px rgba(0,229,255,.35)" }}>
                <Upload size={16} /> Cargar Excel
              </button>
            )}
            {!admin && !pinAbierto && (
              <button className="btn" onClick={() => { setPinAbierto(true); setPinError(false); }}
                style={{ background: "rgba(90,130,220,.12)", color: "#8da2c4", padding: "10px 15px", border: "1px solid rgba(90,130,220,.3)" }}>
                <Lock size={15} /> Administrador
              </button>
            )}
            {!admin && pinAbierto && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="ipt" type="password" placeholder="Clave de administrador" value={pin}
                  autoFocus style={{ width: 200, borderColor: pinError ? "#ff4d6d" : undefined }}
                  onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && intentarAdmin()} />
                <button className="btn" onClick={intentarAdmin}
                  style={{ background: "linear-gradient(120deg,#00f5a0,#00c97f)", color: "#04140d", padding: "10px 14px" }}>
                  <Check size={16} />
                </button>
                <button className="iconbtn" onClick={() => { setPinAbierto(false); setPin(""); setPinError(false); }}><X size={15} color="#ff4d6d" /></button>
                {pinError && <span className="mono" style={{ color: "#ff4d6d", fontSize: 12 }}>Clave incorrecta</span>}
              </div>
            )}
            {admin && (
              <button className="btn" onClick={salirAdmin}
                style={{ background: "rgba(255,77,109,.12)", color: "#ff9aab", padding: "10px 15px", border: "1px solid rgba(255,77,109,.3)" }}>
                <LogOut size={15} /> Salir de admin
              </button>
            )}
          </div>
        </header>

        {aviso && (
          <div className="glass" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, padding: "12px 16px",
            borderColor: aviso.tipo === "ok" ? "rgba(0,245,160,.4)" : "rgba(255,77,109,.4)",
            color: aviso.tipo === "ok" ? "#00f5a0" : "#ff4d6d", fontSize: 13, animation: "rise .3s both" }}>
            {aviso.tipo === "ok" ? <Zap size={16} /> : <AlertCircle size={16} />} {aviso.txt}
          </div>
        )}

        <Seccion titulo="Asesores de ventas" icono={<Users />} acentoColor="#00e5ff"
          items={asesores} setItems={setAsesores} editKey="asesores" mostrarPV={true} admin={admin}
          persistir={(nuevos) => guardarEnBD(nuevos, puntos)}
          edit={edit} setEdit={setEdit} draft={draft} setDraft={setDraft} onAbrir={setDetalle} />

        <div className="glow-line" style={{ margin: "0 0 34px" }} />

        <Seccion titulo="Puntos de venta" icono={<Store />} acentoColor="#7c5cff"
          items={puntos} setItems={setPuntos} editKey="puntos" admin={admin}
          persistir={(nuevos) => guardarEnBD(asesores, nuevos)}
          edit={edit} setEdit={setEdit} draft={draft} setDraft={setDraft} onAbrir={setDetalle} />

        <div className="glow-line" style={{ margin: "10px 0 16px" }} />
        <p className="mono" style={{ color: "#4a5b80", fontSize: 12, textAlign: "center", letterSpacing: .5 }}>
          <Activity size={12} style={{ verticalAlign: "middle", marginRight: 6 }} />
          {admin
            ? "Modo administrador: puedes cargar el Excel, agregar, editar y eliminar."
            : "Vista de solo lectura. Para actualizar datos, entra como administrador."}
        </p>
      </div>

      <DetalleCategorias registro={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  );
}
