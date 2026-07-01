"use client";

import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

const GROUPS = ["Next", "Later", "Future"];

// Only this signed-in user may edit. Everyone else (including logged-out
// visitors) is read-only. The real enforcement lives in Supabase RLS — this
// constant just drives the UI so non-editors don't see dead controls.
const OWNER_EMAIL = "kalle@paulsson.net";

const DEFAULT_ITEMS = [
  { id: 1, title: "Better data fetching", area: "", version: "", ease: 0, impact: 0, confidence: "", link: "", group: "Next" },
  { id: 2, title: "Better navigation", area: "", version: "", ease: 0, impact: 0, confidence: "", link: "", group: "Next" },
  { id: 3, title: "Chat view", area: "Private", version: "2.1", ease: 5, impact: 7, confidence: 0.15, link: "https://figma.com", group: "Next" },
  { id: 4, title: "Highlight immediate money transfers", area: "Private", version: "2.1", ease: 9, impact: 3, confidence: 0.1, link: "https://figma.com", group: "Next" },
  { id: 5, title: "Better control of my invites", area: "Private", version: "2.1", ease: 6, impact: 6, confidence: 0.8, link: "https://figma.com", group: "Next" },
  { id: 6, title: "Group money pooling", area: "Private", version: "2.2", ease: 4, impact: 10, confidence: 0.4, link: "", group: "Later" },
  { id: 7, title: "Recurring payments", area: "Private", version: "2.3", ease: 6, impact: 8, confidence: 0.6, link: "", group: "Later" },
  { id: 8, title: "Dark mode", area: "Private", version: "2.3", ease: 8, impact: 4, confidence: 1.0, link: "", group: "Future" },
];

const PALETTES = {
  dark: {
    pageBg: "#15171f", cardBg: "#1f2230", cardBorder: "#363a4a", headBg: "#272b3a", rowBorder: "#2e3242",
    textPrimary: "#e8e8ea", textSecondary: "#a0a2ad", textTertiary: "#6d7080", accent: "#7aa2f7",
    rowDrag: "#272b3a", inputBg: "#272b3a", shadow: "0 1px 3px rgba(0,0,0,0.4)", tabBg: "#1f2230",
  },
  light: {
    pageBg: "#faf9f5", cardBg: "#ffffff", cardBorder: "#e6e4dd", headBg: "#f6f5f1", rowBorder: "#eeede8",
    textPrimary: "#1a1a18", textSecondary: "#6b6a64", textTertiary: "#9c9b94", accent: "#2f6fdb",
    rowDrag: "#f6f5f1", inputBg: "#ffffff", shadow: "0 1px 2px rgba(0,0,0,0.04)", tabBg: "#ffffff",
  },
};

const AREA_RAMPS = {
  dark: {
    Private: { bg: "#3a3470", color: "#cecbf6" },
    _ramps: [["#3a3470", "#cecbf6"], ["#173a5e", "#b5d4f4"], ["#0d4035", "#9fe1cb"], ["#5a1f35", "#f4c0d1"], ["#4a3306", "#fac775"], ["#4a2113", "#f5c4b3"]],
  },
  light: {
    Private: { bg: "#EEEDFE", color: "#3C3489" },
    _ramps: [["#EEEDFE", "#3C3489"], ["#E6F1FB", "#0C447C"], ["#E1F5EE", "#085041"], ["#FBEAF0", "#72243E"], ["#FAEEDA", "#633806"], ["#FAECE7", "#712B13"]],
  },
};

function areaStyle(area, mode) {
  const set = AREA_RAMPS[mode];
  if (set[area]) return set[area];
  let h = 0;
  for (let i = 0; i < area.length; i++) h = area.charCodeAt(i) + ((h << 5) - h);
  const [bg, color] = set._ramps[Math.abs(h) % set._ramps.length];
  return { bg, color };
}

function Icon({ name, size = 16, style }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style, "aria-hidden": true };
  switch (name) {
    case "chevron-right": return <svg {...s}><path d="M9 6l6 6-6 6" /></svg>;
    case "chevron-down": return <svg {...s}><path d="M6 9l6 6 6-6" /></svg>;
    case "chevron-up": return <svg {...s}><path d="M6 15l6-6 6 6" /></svg>;
    case "unfold": return <svg {...s}><path d="M8 9l4-4 4 4" /><path d="M8 15l4 4 4-4" /></svg>;
    case "grip": return <svg {...s} strokeWidth={0} fill="currentColor"><circle cx="9" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>;
    case "info": return <svg {...s}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>;
    case "plus": return <svg {...s}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "trash": return <svg {...s}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>;
    case "download": return <svg {...s}><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 19h16" /></svg>;
    case "upload": return <svg {...s}><path d="M12 21V9" /><path d="M8 13l4-4 4 4" /><path d="M4 5h16" /></svg>;
    case "sun": return <svg {...s}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "moon": return <svg {...s}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
    case "maximize": return <svg {...s}><path d="M4 9V5a1 1 0 0 1 1-1h4" /><path d="M20 9V5a1 1 0 0 0-1-1h-4" /><path d="M4 15v4a1 1 0 0 0 1 1h4" /><path d="M20 15v4a1 1 0 0 1-1 1h-4" /></svg>;
    case "minimize": return <svg {...s}><path d="M9 4v4a1 1 0 0 1-1 1H4" /><path d="M15 4v4a1 1 0 0 0 1 1h4" /><path d="M9 20v-4a1 1 0 0 0-1-1H4" /><path d="M15 20v-4a1 1 0 0 1 1-1h4" /></svg>;
    default: return null;
  }
}

function InfoIcon({ tip, color }) {
  return <span title={tip} aria-label={tip} style={{ color, marginLeft: 4, cursor: "help", display: "inline-flex", verticalAlign: "-2px" }}><Icon name="info" size={13} /></span>;
}

function ScoreCell({ score, C }) {
  const rounded = Math.round(score * 10) / 10;
  if (!rounded) return null;
  return <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, opacity: 0.8 }}>{rounded}</span>;
}

function NumInput({ val, onChange, C, min = 0, max = 10, step = 1, width = 42 }) {
  const clamp = v => Math.min(max, Math.max(min, v));
  return (
    <input type="number" min={min} max={max} step={step} value={val}
      onChange={e => { const n = e.target.value === "" ? min : Number(e.target.value); onChange(clamp(isNaN(n) ? min : n)); }}
      style={{ width, fontSize: 13, padding: "3px 4px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: C.inputBg, color: C.textPrimary, textAlign: "center" }} />
  );
}

function ConfInput({ val, onChange, C }) {
  const [text, setText] = useState(val === "" ? "0" : String(val));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(val === "" ? "0" : String(val)); }, [val, focused]);
  function commit(raw) {
    const t = raw.trim();
    if (t === "") { onChange(""); return; }
    const n = Number(t);
    if (!isNaN(n)) onChange(Math.min(1, Math.max(0, n))); else onChange("");
  }
  return (
    <input type="text" inputMode="decimal" value={text}
      onFocus={e => { setFocused(true); e.target.select(); }}
      onBlur={e => { setFocused(false); commit(e.target.value); }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      onChange={e => { const raw = e.target.value; if (raw === "" || /^\d*\.?\d*$/.test(raw)) setText(raw); }}
      style={{ width: 52, fontSize: 13, padding: "3px 4px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: C.inputBg, color: C.textPrimary, textAlign: "center" }} />
  );
}

// Textarea that grows vertically with its content. Enter inserts a newline
// (we stop it bubbling to the row's Enter-to-commit handler).
function AutoTextarea({ val, onChange, C, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [val]);
  return (
    <textarea ref={ref} rows={1} placeholder={placeholder} value={val}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") e.stopPropagation(); }}
      style={{ width: "100%", fontSize: 12, marginTop: 6, padding: "4px 7px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: C.inputBg, color: C.textPrimary, boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.4, fontFamily: "inherit" }} />
  );
}

// --- Persistence: the whole items array is stored as ONE JSON document in
// Supabase (table `roadmap`, row id = 'main'), shared by everyone. This mirrors
// the original artifact, which saved the array as a single blob.
const DOC_ID = "main";

async function loadData() {
  try {
    const { data, error } = await supabase
      .from("roadmap")
      .select("items")
      .eq("id", DOC_ID)
      .maybeSingle();
    if (error) throw error;
    return data ? data.items : null; // null when no row exists yet
  } catch (e) {
    console.error("loadData failed:", e);
    return null;
  }
}

async function saveData(items) {
  try {
    const { error } = await supabase
      .from("roadmap")
      .upsert({ id: DOC_ID, items, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    console.error("saveData failed:", e);
  }
}

// When `publicItems` is passed (by the server-rendered /v/<token> page), the
// component runs in PUBLIC mode: read-only, Versions view only, no auth, no
// Supabase access from the browser. Otherwise it's the private owner app.
export default function App({ publicItems } = {}) {
  const isPublic = Array.isArray(publicItems);
  const [mode, setMode] = useState("dark");
  const [view, setView] = useState(isPublic ? "versions" : "main");
  const [items, setItems] = useState(isPublic ? publicItems : null);
  const [loaded, setLoaded] = useState(isPublic);
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(null);
  const [newItem, setNewItem] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [openDesc, setOpenDesc] = useState({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overInfo, setOverInfo] = useState({ id: null, group: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const dragId_r = useRef(null);
  const editRowRef = useRef(null);
  const fileInputRef = useRef(null);
  const rootRef = useRef(null);
  const saveTimer = useRef(null);

  // Load the doc only for the signed-in owner. Reads are locked to the owner by
  // RLS, so there is nothing to fetch (and nothing to show) for anyone else.
  useEffect(() => {
    if (isPublic) return;
    const isOwner = !!session && session.user && session.user.email === OWNER_EMAIL;
    if (!isOwner) { setItems(null); setLoaded(false); return; }
    loadData().then(d => { setItems(d || DEFAULT_ITEMS); setLoaded(true); });
  }, [session, isPublic]);

  // Track the Supabase auth session (persisted in localStorage by supabase-js).
  useEffect(() => {
    if (isPublic) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [isPublic]);

  // Debounced save: batches rapid edits (e.g. typing) into one network write.
  // Only the owner writes — RLS rejects anyone else, so don't even attempt it
  // (avoids a failed write firing on every page load for read-only visitors).
  useEffect(() => {
    if (isPublic || !loaded || !items) return;
    const isOwner = !!session && session.user && session.user.email === OWNER_EMAIL;
    if (!isOwner) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveData(items); }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [items, loaded, session]);

  useEffect(() => {
    if (editId == null && adding == null) return;
    function onDocMouseDown(e) {
      if (confirmDelete != null) return;
      if (editRowRef.current && !editRowRef.current.contains(e.target)) {
        if (adding != null) commitAdd(); else setEditId(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [editId, adding, newItem, confirmDelete]);

  useEffect(() => {
    const onFs = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  const C = PALETTES[mode];
  const canEdit = !isPublic && !!session && session.user && session.user.email === OWNER_EMAIL;

  // Private app: anyone who isn't the signed-in owner sees only a sign-in card —
  // never the board or the built-in default items.
  if (!isPublic && !canEdit) {
    const gateInput = { width: "100%", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "8px 10px", background: C.inputBg, color: C.textPrimary, boxSizing: "border-box" };
    return (
      <div style={{ background: C.pageBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "var(--font-sans)" }}>
        <form onSubmit={signIn} style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 24, maxWidth: 340, width: "100%", boxShadow: C.shadow }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Roadmap</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Sign in to view and edit.</div>
          <input type="email" placeholder="Email" autoFocus value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ ...gateInput, marginBottom: 8 }} />
          <input type="password" placeholder="Password" value={authPw} onChange={e => setAuthPw(e.target.value)} style={{ ...gateInput, marginBottom: 14 }} />
          {authErr && <div style={{ fontSize: 12, color: "#e5484d", marginBottom: 12 }}>{authErr}</div>}
          <button type="submit" disabled={authBusy} style={{ width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500, padding: "9px 14px", opacity: authBusy ? 0.6 : 1 }}>{authBusy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    );
  }

  if (!items) return <div style={{ padding: "2rem", fontSize: 13, color: C.textSecondary }}>Loading…</div>;

  const score = i => i.ease * i.impact * (Number(i.confidence) || 0);
  const nextId = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;

  const update = (id, f, v) => setItems(p => p.map(i => i.id === id ? { ...i, [f]: v } : i));
  const remove = id => setItems(p => p.filter(i => i.id !== id));

  const toggleDesc = id => setOpenDesc(o => ({ ...o, [id]: !o[id] }));
  const anyDesc = items.some(i => i.description && String(i.description).trim());
  function toggleAllDesc() {
    const next = !bulkOpen;
    setBulkOpen(next);
    if (!next) { setOpenDesc({}); return; }
    const all = {};
    items.forEach(i => { if (i.description && String(i.description).trim()) all[i.id] = true; });
    setOpenDesc(all);
  }

  function startAdd(group) { setAdding(group); setEditId(null); setNewItem({ title: "", description: "", area: "", version: "", ease: 0, impact: 0, confidence: "", link: "", group }); }
  function commitAdd() {
    if (!newItem.title.trim()) { setAdding(null); return; }
    setItems(p => [...p, { ...newItem, id: nextId, title: newItem.title.trim() }]);
    setAdding(null);
  }
  function onEditKeyDown(e, isNew) {
    if (e.key === "Enter") { e.preventDefault(); isNew ? commitAdd() : setEditId(null); }
    else if (e.key === "Escape") { isNew ? setAdding(null) : setEditId(null); }
  }
  function switchView(v) { setView(v); setEditId(null); setAdding(null); }

  async function signIn(e) {
    e.preventDefault();
    setAuthBusy(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPw });
    setAuthBusy(false);
    if (error) { setAuthErr(error.message); return; }
    setAuthPw("");
  }
  async function signOut() { await supabase.auth.signOut(); }

  function toggleFullscreen() {
    const el = rootRef.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) { try { const p = req.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { exit.call(document); } catch (e) {} }
    }
  }

  function importCsv(file) {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: res => {
        const data = res.data;
        if (!data.length) return;
        const header = data[0].map(h => String(h).trim().toLowerCase());
        const col = name => header.indexOf(name);
        const ci = { title: col("initiative"), description: col("description"), area: col("area"), version: col("version"), ease: col("ease"), impact: col("impact"), confidence: col("confidence"), link: col("link"), group: col("group") };
        const cleanLink = str => String(str || "").replace(/^\s*figma\s*[-–—:]\s*/i, "").trim();
        const cell = (row, idx) => idx >= 0 && idx < row.length ? String(row[idx]).trim() : "";
        const parsed = data.slice(1).map((row, idx) => {
          const conf = cell(row, ci.confidence);
          return {
            id: idx + 1,
            title: cell(row, ci.title),
            description: cell(row, ci.description),
            area: cell(row, ci.area),
            version: cell(row, ci.version),
            ease: Number(cell(row, ci.ease)) || 0,
            impact: Number(cell(row, ci.impact)) || 0,
            confidence: conf === "" ? "" : (Number(conf) || 0),
            link: cleanLink(cell(row, ci.link)),
            group: cell(row, ci.group) || "Next",
          };
        }).filter(i => i.title !== "");
        if (parsed.length) { setItems(parsed); setEditId(null); setAdding(null); setCollapsed({}); }
      },
    });
  }

  function exportCsv() {
    const headers = ["Initiative", "Description", "Area", "Version", "Score", "Ease", "Impact", "Confidence", "Link", "Group"];
    const esc = v => {
      const str = String(v ?? "");
      return /[",\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
    };
    const lines = items.map(i => [
      i.title, i.description || "", i.area, i.version,
      Math.round(score(i) * 10) / 10,
      i.ease, i.impact,
      i.confidence === "" ? "" : i.confidence,
      i.link, i.group,
    ].map(esc).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roadmap.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDrop(targetGroup, targetId) {
    const fromId = dragId_r.current;
    if (fromId == null) return;
    setItems(prev => {
      if (targetId === fromId) return prev; // dropped onto itself → leave in place
      let arr = [...prev];
      const fromIdx = arr.findIndex(i => i.id === fromId);
      const moved = { ...arr[fromIdx], group: targetGroup };
      arr.splice(fromIdx, 1);
      if (targetId != null) {
        const toIdx = arr.findIndex(i => i.id === targetId);
        arr.splice(toIdx, 0, moved);
      } else {
        const lastGroupIdx = arr.map(i => i.group).lastIndexOf(targetGroup);
        arr.splice(lastGroupIdx + 1, 0, moved);
      }
      return arr;
    });
    dragId_r.current = null;
    setDragId(null);
    setOverInfo({ id: null, group: null });
  }

  const colW = {
    drag: 26,
    init: "clamp(160px, 28vw, 400px)",
    area: "clamp(74px, 9vw, 110px)",
    version: "clamp(46px, 6vw, 80px)",
    score: "clamp(46px, 6vw, 70px)",
    num: "clamp(64px, 6vw, 92px)",
    conf: "clamp(64px, 6vw, 92px)",
    link: "clamp(52px, 6vw, 70px)",
    del: 72,
  };

  const headCell = (label, w, right, tip) => (
    <th style={{ width: w, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textTertiary, padding: "11px 8px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", userSelect: "none", overflow: "hidden", textOverflow: "ellipsis" }}>
      {label}{tip && <InfoIcon tip={tip} color={C.textTertiary} />}
    </th>
  );

  const cellBase = { fontSize: 13, padding: "11px 12px", verticalAlign: "middle", color: C.textPrimary };
  const inputStyle = { width: "100%", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: "4px 7px", background: C.inputBg, color: C.textPrimary, boxSizing: "border-box" };

  function renderEditRow(item, isNew, showGrip) {
    const it = isNew ? newItem : item;
    const set = isNew ? (f, v) => setNewItem(n => ({ ...n, [f]: v })) : (f, v) => update(item.id, f, v);
    const ec = { ...cellBase, verticalAlign: "top" }; // top-align edit cells against the tall description
    return (
      <>
        {showGrip && <td style={{ ...ec, color: C.textTertiary, textAlign: "center" }}><Icon name="grip" size={14} /></td>}
        <td style={ec}>
          <input autoFocus={isNew} placeholder="Initiative…" value={it.title} onChange={e => set("title", e.target.value)} style={inputStyle} />
          <AutoTextarea val={it.description || ""} onChange={v => set("description", v)} C={C} placeholder="Description…" />
        </td>
        <td style={ec}><input placeholder="Area" value={it.area} onChange={e => set("area", e.target.value)} style={inputStyle} /></td>
        <td style={ec}><input placeholder="2.0" value={it.version} onChange={e => set("version", e.target.value)} style={inputStyle} /></td>
        <td style={{ ...ec, textAlign: "right" }}><ScoreCell score={it.ease * it.impact * (Number(it.confidence) || 0)} C={C} /></td>
        <td style={{ ...ec, textAlign: "right" }}><NumInput val={it.ease} onChange={v => set("ease", v)} C={C} min={0} max={10} step={1} /></td>
        <td style={{ ...ec, textAlign: "right" }}><NumInput val={it.impact} onChange={v => set("impact", v)} C={C} min={0} max={10} step={1} /></td>
        <td style={{ ...ec, textAlign: "right" }}><ConfInput val={it.confidence} onChange={v => set("confidence", v)} C={C} /></td>
        <td style={ec} colSpan={2}><input placeholder="URL…" value={it.link} onChange={e => set("link", e.target.value)} style={{ ...inputStyle, fontSize: 12 }} /></td>
        <td style={{ ...ec, textAlign: "center", padding: "11px 18px 11px 12px" }}>{!isNew && (
          <button onClick={() => setConfirmDelete(item.id)} title="Delete initiative" aria-label="Delete initiative"
            style={{ background: mode === "dark" ? "rgba(229,72,77,0.16)" : "rgba(229,72,77,0.1)", border: "1px solid rgba(229,72,77,0.55)", borderRadius: 7, cursor: "pointer", color: "#e5484d", padding: "5px 8px", display: "inline-flex", alignItems: "center" }}>
            <Icon name="trash" size={15} />
          </button>
        )}</td>
      </>
    );
  }

  function renderDisplayRow(item, showGrip) {
    const dc = { ...cellBase, verticalAlign: "top" };
    const hasDesc = item.description && String(item.description).trim() !== "";
    const open = !!openDesc[item.id];
    return (
      <>
        {showGrip && <td style={{ ...dc, color: C.textTertiary, textAlign: "center" }}><Icon name="grip" size={14} /></td>}
        <td style={dc}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.35", overflowWrap: "anywhere" }}>{item.title}</div>
              {hasDesc && open && (
                <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.description}</div>
              )}
            </div>
            {hasDesc && (
              <button onClick={e => { e.stopPropagation(); toggleDesc(item.id); }} title={open ? "Hide description" : "Show description"} aria-label={open ? "Hide description" : "Show description"}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.textTertiary, display: "inline-flex", flexShrink: 0, marginTop: 1 }}>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
              </button>
            )}
          </div>
        </td>
        <td style={dc}>{item.area ? (() => { const a = areaStyle(item.area, mode); return <span style={{ background: a.bg, color: a.color, fontSize: 12, fontWeight: 500, padding: "2px 9px", borderRadius: 999 }}>{item.area}</span>; })() : null}</td>
        <td style={dc}>{item.version ? (() => { const a = areaStyle(item.version, mode); return <span style={{ background: a.bg, color: a.color, fontSize: 12, fontWeight: 500, padding: "2px 9px", borderRadius: 999 }}>{item.version}</span>; })() : null}</td>
        <td style={{ ...dc, textAlign: "right" }}><ScoreCell score={score(item)} C={C} /></td>
        <td style={{ ...dc, textAlign: "right", color: item.ease ? C.textPrimary : C.textTertiary }}>{item.ease || "–"}</td>
        <td style={{ ...dc, textAlign: "right", color: item.impact ? C.textPrimary : C.textTertiary }}>{item.impact || "–"}</td>
        <td style={{ ...dc, textAlign: "right", color: item.confidence === "" ? C.textTertiary : C.textPrimary }}>{item.confidence === "" ? "–" : Number(item.confidence).toFixed(2)}</td>
        <td style={dc}>{item.link ? <a href={item.link} style={{ fontSize: 13, color: C.accent, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>{/figma/i.test(item.link) ? "Figma" : item.link.replace(/^https?:\/\//, "").split("/")[0]}</a> : null}</td>
        <td style={dc} />
        <td style={dc} />
      </>
    );
  }

  function GroupCard({ label, rows, allowDrag }) {
    const collapseKey = view + ":" + label;
    const isCollapsed = collapsed[collapseKey];
    const isGroupDropTarget = allowDrag && overInfo.group === label && overInfo.id === null;
    return (
      <div key={collapseKey} style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px", cursor: "pointer" }}
          onClick={() => setCollapsed(c => ({ ...c, [collapseKey]: !c[collapseKey] }))}>
          <span style={{ color: C.accent, display: "inline-flex" }}><Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={15} /></span>
          <span style={{ fontWeight: 500, fontSize: 15, color: C.accent }}>{label}</span>
          <span style={{ fontSize: 12, color: C.textTertiary, fontWeight: 400 }}>{rows.length}</span>
        </div>
        {!isCollapsed && (
          <div
            onDragOver={allowDrag ? (e => { e.preventDefault(); setOverInfo({ id: null, group: label }); }) : undefined}
            onDrop={allowDrag ? (() => handleDrop(label, null)) : undefined}
            style={{ background: C.cardBg, border: `1px solid ${isGroupDropTarget ? C.accent : C.cardBorder}`, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {allowDrag && <col style={{ width: colW.drag }} />}<col style={{ width: colW.init }} /><col style={{ width: colW.area }} /><col style={{ width: colW.version }} /><col style={{ width: colW.score }} /><col style={{ width: colW.num }} /><col style={{ width: colW.num }} /><col style={{ width: colW.conf }} /><col style={{ width: colW.link }} /><col /><col style={{ width: colW.del }} />
              </colgroup>
              <thead>
                <tr style={{ background: C.headBg, borderBottom: `1px solid ${C.cardBorder}` }}>
                  {allowDrag && headCell("", colW.drag)}
                  {headCell("Initiative", colW.init)}
                  {headCell("Area", colW.area)}
                  {headCell("Version", colW.version)}
                  {headCell("Score", colW.score, true)}
                  {headCell("Ease", colW.num, true, "How easy to build (1–10)")}
                  {headCell("Impact", colW.num, true, "Expected impact (1–10)")}
                  {headCell("Conf", colW.conf, true, "Confidence multiplier (0–1)")}
                  {headCell("Link", colW.link)}
                  {headCell("")}
                  {headCell("", colW.del)}
                </tr>
              </thead>
              <tbody>
                {rows.map((item, idx) => {
                  const editing = editId === item.id;
                  const isOver = allowDrag && overInfo.id === item.id && dragId !== item.id;
                  return (
                    <tr key={item.id}
                      ref={editing ? editRowRef : null}
                      draggable={allowDrag && !editing}
                      onDragStart={allowDrag ? (() => { dragId_r.current = item.id; setDragId(item.id); }) : undefined}
                      onDragEnd={allowDrag ? (() => { setDragId(null); setOverInfo({ id: null, group: null }); }) : undefined}
                      onDragOver={allowDrag ? (e => { e.preventDefault(); e.stopPropagation(); setOverInfo({ id: item.id, group: label }); }) : undefined}
                      onDrop={allowDrag ? (e => { e.stopPropagation(); handleDrop(label, item.id); }) : undefined}
                      onDoubleClick={() => { if (canEdit && !editing) { setEditId(item.id); setAdding(null); } }}
                      onKeyDown={editing ? (e => onEditKeyDown(e, false)) : undefined}
                      style={{
                        borderBottom: idx === rows.length - 1 ? "none" : `1px solid ${C.rowBorder}`,
                        borderTop: isOver ? `2px solid ${C.accent}` : undefined,
                        background: dragId === item.id ? C.rowDrag : "transparent",
                        cursor: editing ? "default" : (allowDrag ? "grab" : "default"),
                        opacity: dragId === item.id ? 0.5 : 1,
                      }}>
                      {editing ? renderEditRow(item, false, allowDrag) : renderDisplayRow(item, allowDrag)}
                    </tr>
                  );
                })}
                {allowDrag && adding === label && (
                  <tr ref={editRowRef} onKeyDown={e => onEditKeyDown(e, true)} style={{ background: C.headBg, borderTop: `1px solid ${C.cardBorder}` }}>{renderEditRow(null, true, allowDrag)}</tr>
                )}
                {allowDrag && (
                  <tr>
                    <td colSpan={11} style={{ padding: "9px 12px", borderTop: rows.length ? `1px solid ${C.rowBorder}` : "none" }}>
                      <button onClick={() => startAdd(label)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.textTertiary, display: "flex", alignItems: "center", gap: 5, padding: 0 }}>
                        <Icon name="plus" size={14} /> Add initiative
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  const versions = [...new Set(items.filter(i => (i.version || "").trim() !== "").map(i => i.version.trim()))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const tabBtn = (id, label) => {
    const active = view === id;
    return (
      <button onClick={() => switchView(id)}
        style={{ background: active ? C.headBg : "transparent", border: "none", borderRadius: 7, cursor: "pointer", color: active ? C.textPrimary : C.textSecondary, fontSize: 13, fontWeight: 500, padding: "5px 14px" }}>{label}</button>
    );
  };

  const toolBtn = { background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 8, cursor: "pointer", color: C.textSecondary, fontSize: 13, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 };

  return (
    <div ref={rootRef} style={{ background: C.pageBg, minHeight: "100vh", height: isFs ? "100vh" : undefined, overflowY: isFs ? "auto" : undefined, padding: "1.25rem 0.5rem", fontFamily: "var(--font-sans)" }}>
      <h2 className="sr-only">Product roadmap planner</h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", padding: "0 4px", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isPublic
            ? <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, padding: "0 4px" }}>Roadmap — Versions</div>
            : (
              <div style={{ display: "inline-flex", gap: 2, background: C.tabBg, border: `1px solid ${C.cardBorder}`, borderRadius: 9, padding: 3 }}>
                {tabBtn("main", "Main")}
                {tabBtn("versions", "Versions")}
              </div>
            )}
          {anyDesc && (
            <button onClick={toggleAllDesc} style={{ ...toolBtn, padding: "5px 9px" }} title="Open/close all descriptions" aria-label="Open/close all descriptions">
              <Icon name="unfold" size={16} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canEdit && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={e => { const f = e.target.files && e.target.files[0]; if (f) importCsv(f); e.target.value = ""; }} />
              <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={toolBtn} aria-label="Import from CSV">
                <Icon name="upload" size={15} /> Import CSV
              </button>
            </>
          )}
          <button onClick={exportCsv} style={toolBtn} aria-label="Export as CSV">
            <Icon name="download" size={15} /> Export CSV
          </button>
          <button onClick={() => setMode(m => m === "dark" ? "light" : "dark")} style={toolBtn} aria-label="Toggle color mode">
            <Icon name={mode === "dark" ? "sun" : "moon"} size={15} /> {mode === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={toggleFullscreen} style={{ ...toolBtn, padding: "5px 9px" }} aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"} title={isFs ? "Exit fullscreen" : "Fullscreen"}>
            <Icon name={isFs ? "minimize" : "maximize"} size={16} />
          </button>
          {!isPublic && session && (
            <button onClick={signOut} style={toolBtn} aria-label="Sign out">Sign out</button>
          )}
        </div>
      </div>

      {!isPublic && view === "main" && [...GROUPS, ...[...new Set(items.map(i => (i.group || "").trim()))].filter(g => g && !GROUPS.includes(g))].map(group =>
        GroupCard({ label: group, rows: items.filter(i => (i.group || "").trim() === group), allowDrag: canEdit })
      )}

      {view === "versions" && (
        versions.length === 0
          ? (!isPublic ? <div style={{ padding: "2rem 4px", fontSize: 13, color: C.textSecondary }}>No initiatives have a version set yet. Add a version to an item in the Main view to see it grouped here.</div> : null)
          : versions.map(v =>
            GroupCard({ label: v, rows: items.filter(i => (i.version || "").trim() === v), allowDrag: false })
          )
      )}

      {isPublic && (() => {
        const unassigned = items.filter(i => (i.version || "").trim() === "");
        const groups = [...GROUPS, ...[...new Set(unassigned.map(i => (i.group || "").trim()))].filter(g => g && !GROUPS.includes(g))]
          .filter(g => unassigned.some(i => (i.group || "").trim() === g));
        if (!groups.length) return null;
        return (
          <>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, padding: "0 4px", marginTop: "0.5rem", marginBottom: "1rem" }}>Unassigned initiatives</div>
            {groups.map(group =>
              GroupCard({ label: group, rows: unassigned.filter(i => (i.group || "").trim() === group), allowDrag: false })
            )}
          </>
        );
      })()}

      {confirmDelete != null && (() => {
        const target = items.find(i => i.id === confirmDelete);
        return (
          <div onMouseDown={() => setConfirmDelete(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div onMouseDown={e => e.stopPropagation()}
              style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>Delete initiative?</div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45, marginBottom: 20 }}>
                {target ? `“${target.title}” will be permanently removed. This can't be undone.` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ background: "none", color: C.textSecondary, border: `1px solid ${C.cardBorder}`, borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "6px 14px" }}>Cancel</button>
                <button onClick={() => { remove(confirmDelete); setConfirmDelete(null); setEditId(null); }}
                  style={{ background: "#e5484d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, padding: "6px 14px" }}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
