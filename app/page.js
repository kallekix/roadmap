"use client";

import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

const GROUPS = ["Next", "Later", "Future"];

// Only this signed-in user may edit. Everyone else (including logged-out
// visitors) is read-only. The real enforcement lives in Supabase RLS — this
// constant just drives the UI so non-editors don't see dead controls.
const OWNER_EMAIL = "kalle@paulsson.net";

// Confidence is a derived value: the sum of the weights of the checked evidence
// factors, capped at 10. Stored per item as item.evidence = { key: bool, ... }.
const EVIDENCE = [
  { key: "self", label: "Self conviction", weight: 0.01, intro: "Supported by", points: ["Opinion of originator of idea", "Triage team's opinions", "Quick guesstimates"] },
  { key: "thematic", label: "Thematic support", weight: 0.05, intro: "Aligns with", points: ["Vision/mission/strategy", "Current buzzwords", "Outside research", "Market trends"] },
  { key: "internal", label: "Internal reviews", weight: 0.10, intro: "Supported by opinions/logic of", points: ["The team", "Management", "Stakeholder", "Experts"] },
  { key: "estimates", label: "Estimates and plans", weight: 0.30, intro: "Supported by", points: ["Back of the envelope calculations", "Eng / UX evaluation", "Project timeline", "Business model canvas/plan"] },
  { key: "anecdotal", label: "Anecdotal evidence", weight: 0.50, intro: "Supported by", points: ["A few product data points", "A Sales request", "1-3 interested customers", "1-2 competitors have it"] },
  { key: "market", label: "Market data", weight: 1.00, intro: "Supported by", points: ["Customer surveys", "Smoke tests", "All/most competitors have it"] },
  { key: "customer", label: "Customer evidence", weight: 2.00, intro: "Supported by", points: ["Lots of product data", "Top user request", "Interviews with 20+ users", "Usability study", "Wizard of Oz/Concierge test", "Dogfood"] },
  { key: "test", label: "Test results", weight: 5.00, intro: "Supported by", points: ["Longitudinal user study", "Alpha/beta", "Early-adopter program", "A/B experiments"] },
  { key: "launch", label: "Launch data", weight: 7.00, intro: "Supported by", points: ["% experiment", "Holdback experiment", "Launch data"] },
];

function confidenceOf(item) {
  const ev = (item && item.evidence) || {};
  const sum = EVIDENCE.reduce((s, f) => s + (ev[f.key] ? f.weight : 0), 0);
  return Math.min(10, Math.round(sum * 100) / 100);
}

const PALETTES = {
  dark: {
    pageBg: "#15171f", cardBg: "#1f2230", cardBorder: "#363a4a", headBg: "#272b3a", rowBorder: "#2e3242",
    textPrimary: "#e8e8ea", textSecondary: "#a0a2ad", textTertiary: "#6d7080", accent: "#7aa2f7", green: "#5cc98a",
    rowDrag: "#272b3a", inputBg: "#272b3a", shadow: "0 1px 3px rgba(0,0,0,0.4)", tabBg: "#1f2230",
  },
  light: {
    pageBg: "#faf9f5", cardBg: "#ffffff", cardBorder: "#e6e4dd", headBg: "#f6f5f1", rowBorder: "#eeede8",
    textPrimary: "#1a1a18", textSecondary: "#6b6a64", textTertiary: "#9c9b94", accent: "#2f6fdb", green: "#1f9d57",
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
    case "pencil": return <svg {...s}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
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

// --- Persistence: one row per initiative in Supabase table `initiatives`,
// ordered by a float `position` (fractional-rank so a reorder is a single-row
// write). Per-row writes mean two tabs editing different items no longer clobber
// each other's whole document.
const IMPOSSIBLE_ID = "00000000-0000-0000-0000-000000000000";

// Map an in-memory item to a DB row (column set of the `initiatives` table).
function toDbRow(it) {
  return {
    id: it.id,
    title: it.title || "",
    description: it.description || "",
    area: it.area || "",
    version_id: it.version_id || null,
    ease: it.ease || 0,
    impact: it.impact || 0,
    evidence: it.evidence || {},
    link: it.link || "",
    group: it.group || "Next",
    position: it.position ?? 0,
    updated_at: new Date().toISOString(),
  };
}

async function loadData() {
  try {
    const { data, error } = await supabase
      .from("initiatives")
      .select("*")
      .order("position", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("loadData failed:", e);
    return [];
  }
}

// Versions are a central table now (version number + description), referenced
// by initiatives.version_id — so renaming a version's number doesn't orphan
// the initiatives that use it.
async function loadVersions() {
  try {
    const { data, error } = await supabase.from("versions").select("*");
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("loadVersions failed:", e);
    return [];
  }
}

function sortVersions(list) {
  // Archived versions sink to the bottom; within each bucket, sort by number.
  return [...list].sort((a, b) => {
    const aa = a.archived ? 1 : 0, ba = b.archived ? 1 : 0;
    if (aa !== ba) return aa - ba;
    return (a.version || "").localeCompare(b.version || "", undefined, { numeric: true });
  });
}

// When `publicItems` is passed (by the server-rendered /v/<token> page), the
// component runs in PUBLIC mode: read-only, Versions view only, no auth, no
// Supabase access from the browser. Otherwise it's the private owner app.
export default function App({ publicItems, publicVersions } = {}) {
  const isPublic = Array.isArray(publicItems);
  const [mode, setMode] = useState("dark");
  const [view, setView] = useState(isPublic ? "versions" : "main");
  const [items, setItems] = useState(isPublic ? publicItems : null);
  const [versions, setVersions] = useState(isPublic ? (publicVersions || []) : null);
  const [loaded, setLoaded] = useState(isPublic);
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(null);
  const [newItem, setNewItem] = useState({});
  const [versionEditFor, setVersionEditFor] = useState(null); // version id, "new", or null
  const [versionDraft, setVersionDraft] = useState({ version: "", description: "" });
  const [collapsed, setCollapsed] = useState({});
  const [openDesc, setOpenDesc] = useState({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [crumb, setCrumb] = useState({ section: null, group: null });
  const [topOffset, setTopOffset] = useState(0);
  const [evidenceFor, setEvidenceFor] = useState(null); // item id, "new", or null
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
  const toolbarRef = useRef(null);
  const itemsRef = useRef(items);      // latest items, for the debounced flush
  const dirtyIds = useRef(new Set());  // ids whose rows need upserting
  const flushTimer = useRef(null);

  // Load the rows only for the signed-in owner. Reads are locked to the owner by
  // RLS, so there is nothing to fetch (and nothing to show) for anyone else.
  useEffect(() => {
    if (isPublic) return;
    const isOwner = !!session && session.user && session.user.email === OWNER_EMAIL;
    if (!isOwner) { setItems(null); setVersions(null); setLoaded(false); return; }
    Promise.all([loadData(), loadVersions()]).then(([d, v]) => { setItems(d); setVersions(v); setLoaded(true); });
  }, [session, isPublic]);

  // Track the Supabase auth session (persisted in localStorage by supabase-js).
  useEffect(() => {
    if (isPublic) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [isPublic]);

  // Keep a ref to the latest items so the debounced flush upserts current data.
  useEffect(() => { itemsRef.current = items; }, [items]);
  // Flush any pending edits on unmount so a quick edit-then-close isn't lost.
  useEffect(() => () => { if (dirtyIds.current.size) flushDirty(); }, []); // eslint-disable-line

  useEffect(() => {
    if (editId == null && adding == null) return;
    function onDocMouseDown(e) {
      if (confirmDelete != null || evidenceFor != null) return;
      if (editRowRef.current && !editRowRef.current.contains(e.target)) {
        if (adding != null) commitAdd(); else setEditId(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [editId, adding, newItem, confirmDelete, evidenceFor]);

  useEffect(() => {
    const onFs = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // Track which section/group header is currently scrolled up under the sticky
  // toolbar, to build the breadcrumb. Also measures the toolbar height so the
  // table headers can stick just below it.
  useEffect(() => {
    let ticking = false;
    function update() {
      const bar = toolbarRef.current, root = rootRef.current;
      if (!bar || !root) return;
      const rect = bar.getBoundingClientRect();
      const h = Math.round(rect.height);
      setTopOffset(prev => (prev === h ? prev : h));
      let section = null, group = null;
      root.querySelectorAll("[data-crumb]").forEach(n => {
        if (n.getBoundingClientRect().top < rect.bottom + 1) {
          if (n.getAttribute("data-crumb-level") === "section") { section = n.getAttribute("data-crumb"); group = null; }
          else { group = n.getAttribute("data-crumb"); }
        }
      });
      setCrumb(prev => (prev.section === section && prev.group === group) ? prev : { section, group });
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }
    update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [items, view, isPublic, collapsed, openDesc]);

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

  if (!items || !versions) return <div style={{ padding: "2rem", fontSize: 13, color: C.textSecondary }}>Loading…</div>;

  const score = i => i.ease * i.impact * confidenceOf(i);
  const versionById = id => versions.find(v => v.id === id);
  const versionText = id => { const v = versionById(id); return v ? v.version : ""; };

  // Mark a row dirty and debounce-flush it (and any siblings edited in the window)
  // as per-row upserts. Batches keystrokes without touching other items' rows.
  function markDirty(id) {
    dirtyIds.current.add(id);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushDirty, 600);
  }
  async function flushDirty() {
    const ids = [...dirtyIds.current];
    dirtyIds.current.clear();
    const rows = ids.map(id => itemsRef.current.find(i => i.id === id)).filter(Boolean).map(toDbRow);
    if (!rows.length) return;
    try {
      const { error } = await supabase.from("initiatives").upsert(rows);
      if (error) throw error;
    } catch (e) { console.error("sync failed:", e); }
  }
  async function deleteRow(id) {
    dirtyIds.current.delete(id);
    try {
      const { error } = await supabase.from("initiatives").delete().eq("id", id);
      if (error) throw error;
    } catch (e) { console.error("delete failed:", e); }
  }
  async function replaceAll(rows) { // used by CSV import: swap the whole table
    try {
      await supabase.from("initiatives").delete().neq("id", IMPOSSIBLE_ID);
      if (rows.length) {
        const { error } = await supabase.from("initiatives").insert(rows.map(toDbRow));
        if (error) throw error;
      }
    } catch (e) { console.error("replaceAll failed:", e); }
  }

  const update = (id, f, v) => { setItems(p => p.map(i => i.id === id ? { ...i, [f]: v } : i)); markDirty(id); };
  const remove = id => { setItems(p => p.filter(i => i.id !== id)); deleteRow(id); };

  function openNewVersion() { setVersionDraft({ version: "", description: "" }); setVersionEditFor("new"); }
  function openVersionEdit(v) { setVersionDraft({ version: v.version || "", description: v.description || "" }); setVersionEditFor(v.id); }
  async function saveVersionDraft() {
    const text = versionDraft.version.trim();
    if (!text) return;
    const description = versionDraft.description || "";
    if (versionEditFor === "new") {
      const id = crypto.randomUUID();
      setVersions(v => [...v, { id, version: text, description }]);
      try {
        const { error } = await supabase.from("versions").insert({ id, version: text, description });
        if (error) throw error;
      } catch (e) { console.error("version insert failed:", e); }
    } else {
      const id = versionEditFor;
      setVersions(v => v.map(x => x.id === id ? { ...x, version: text, description } : x));
      try {
        const { error } = await supabase.from("versions").update({ version: text, description }).eq("id", id);
        if (error) throw error;
      } catch (e) { console.error("version update failed:", e); }
    }
    setVersionEditFor(null);
  }
  // Archive / unarchive the version being edited. Also persists any pending
  // draft edits (version/description) so nothing typed in the dialog is lost.
  async function toggleVersionArchived() {
    const id = versionEditFor;
    if (id === "new") return;
    const v = versions.find(x => x.id === id);
    if (!v) return;
    const archived = !v.archived;
    const text = versionDraft.version.trim() || v.version;
    const description = versionDraft.description || "";
    setVersions(list => list.map(x => x.id === id ? { ...x, version: text, description, archived } : x));
    try {
      const { error } = await supabase.from("versions").update({ version: text, description, archived }).eq("id", id);
      if (error) throw error;
    } catch (e) { console.error("version archive toggle failed:", e); }
    setVersionEditFor(null);
  }

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

  function startAdd(group) { setAdding(group); setEditId(null); setNewItem({ title: "", description: "", area: "", version_id: null, ease: 0, impact: 0, evidence: {}, link: "", group }); }
  function commitAdd() {
    if (!newItem.title.trim()) { setAdding(null); return; }
    const id = crypto.randomUUID();
    const maxPos = itemsRef.current.reduce((m, i) => Math.max(m, i.position || 0), 0);
    const row = { ...newItem, id, title: newItem.title.trim(), evidence: newItem.evidence || {}, position: maxPos + 1 };
    setItems(p => [...p, row]);
    markDirty(id);
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
      complete: async res => {
        const data = res.data;
        if (!data.length) return;
        const header = data[0].map(h => String(h).trim().toLowerCase());
        const col = name => header.indexOf(name);
        const ci = { title: col("initiative"), description: col("description"), area: col("area"), version: col("version"), ease: col("ease"), impact: col("impact"), confidence: col("confidence"), link: col("link"), group: col("group") };
        const cleanLink = str => String(str || "").replace(/^\s*figma\s*[-–—:]\s*/i, "").trim();
        const cell = (row, idx) => idx >= 0 && idx < row.length ? String(row[idx]).trim() : "";
        // One column per evidence factor (header = factor label); truthy = checked.
        const evidenceCols = EVIDENCE.map(f => ({ key: f.key, idx: col(f.label.toLowerCase()) }));
        const isChecked = s => { const v = s.trim().toLowerCase(); return v !== "" && v !== "0" && v !== "false" && v !== "no"; };

        // Version is a free-text column in the CSV but a central table in the app:
        // reuse a matching version by text, or create a new one.
        const versionMap = {};
        versions.forEach(v => { versionMap[v.version] = v.id; });
        const versionsToInsert = [];
        const versionIdFor = text => {
          if (!text) return null;
          if (!versionMap[text]) {
            const id = crypto.randomUUID();
            versionMap[text] = id;
            versionsToInsert.push({ id, version: text, description: "" });
          }
          return versionMap[text];
        };

        const parsed = data.slice(1).map((row, idx) => {
          const evidence = {};
          evidenceCols.forEach(({ key, idx: ci2 }) => { if (ci2 >= 0 && isChecked(cell(row, ci2))) evidence[key] = true; });
          return {
            id: crypto.randomUUID(),
            title: cell(row, ci.title),
            description: cell(row, ci.description),
            area: cell(row, ci.area),
            version_id: versionIdFor(cell(row, ci.version)),
            ease: Number(cell(row, ci.ease)) || 0,
            impact: Number(cell(row, ci.impact)) || 0,
            evidence, // rebuilt from the per-factor columns; Confidence itself is derived
            link: cleanLink(cell(row, ci.link)),
            group: cell(row, ci.group) || "Next",
            position: idx + 1,
          };
        }).filter(i => i.title !== "");
        if (parsed.length) {
          if (versionsToInsert.length) {
            setVersions(v => [...v, ...versionsToInsert]);
            try {
              const { error } = await supabase.from("versions").insert(versionsToInsert);
              if (error) throw error;
            } catch (e) { console.error("version insert failed:", e); }
          }
          setItems(parsed); setEditId(null); setAdding(null); setCollapsed({}); replaceAll(parsed);
        }
      },
    });
  }

  function exportCsv() {
    const headers = ["Initiative", "Description", "Area", "Version", "Score", "Ease", "Impact", "Confidence", "Link", "Group", ...EVIDENCE.map(f => f.label)];
    const esc = v => {
      const str = String(v ?? "");
      return /[",\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
    };
    const lines = items.map(i => [
      i.title, i.description || "", i.area, versionText(i.version_id),
      Math.round(score(i) * 10) / 10,
      i.ease, i.impact,
      confidenceOf(i),
      i.link, i.group,
      ...EVIDENCE.map(f => (i.evidence && i.evidence[f.key]) ? "1" : ""),
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
    const clear = () => { dragId_r.current = null; setDragId(null); setOverInfo({ id: null, group: null }); };
    if (fromId == null || targetId === fromId) { clear(); return; } // dropped onto itself → no-op
    setItems(prev => {
      if (!prev.some(i => i.id === fromId)) return prev;
      // Neighbours in the target group, ordered by position, excluding the moved row.
      const groupItems = prev.filter(i => i.group === targetGroup && i.id !== fromId).sort((a, b) => a.position - b.position);
      let newPos;
      if (targetId == null) { // dropped on the group's empty area → append to the end
        const last = groupItems[groupItems.length - 1];
        const maxAll = prev.reduce((m, i) => Math.max(m, i.position || 0), 0);
        newPos = last ? last.position + 1 : maxAll + 1;
      } else { // insert just before the target row (matches the old splice behaviour)
        const ti = groupItems.findIndex(i => i.id === targetId);
        const target = groupItems[ti];
        const before = groupItems[ti - 1];
        newPos = before ? (before.position + target.position) / 2 : target.position - 1;
      }
      return prev
        .map(i => i.id === fromId ? { ...i, group: targetGroup, position: newPos } : i)
        .sort((a, b) => a.position - b.position);
    });
    markDirty(fromId);
    clear();
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

  const headCell = (label, w, right, tip, round) => (
    <th style={{ width: w, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: C.textTertiary, padding: "11px 8px", textAlign: right ? "right" : "left", whiteSpace: "nowrap", userSelect: "none", overflow: "hidden", textOverflow: "ellipsis", position: "sticky", top: topOffset, zIndex: 10, background: C.headBg, borderBottom: `1px solid ${C.cardBorder}`, ...(round === "left" ? { borderTopLeftRadius: 12 } : round === "right" ? { borderTopRightRadius: 12 } : {}) }}>
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
        <td style={ec}>
          <select value={it.version_id || ""} onChange={e => set("version_id", e.target.value || null)} style={inputStyle}>
            <option value="">—</option>
            {sortVersions(versions).map(v => (
              <option key={v.id} value={v.id}>{v.version}{v.description ? ` — ${v.description}` : ""}</option>
            ))}
          </select>
        </td>
        <td style={{ ...ec, textAlign: "right" }}><ScoreCell score={it.ease * it.impact * confidenceOf(it)} C={C} /></td>
        <td style={{ ...ec, textAlign: "right" }}><NumInput val={it.ease} onChange={v => set("ease", v)} C={C} min={0} max={10} step={1} /></td>
        <td style={{ ...ec, textAlign: "right" }}><NumInput val={it.impact} onChange={v => set("impact", v)} C={C} min={0} max={10} step={1} /></td>
        <td style={{ ...ec, textAlign: "right" }}>
          <button onClick={() => setEvidenceFor(isNew ? "new" : item.id)} title="Edit confidence evidence" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.accent, fontSize: 13, fontFamily: "inherit" }}>{confidenceOf(it).toFixed(2)}</button>
        </td>
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
        <td style={dc}>{item.version_id ? (() => { const vt = versionText(item.version_id); const a = areaStyle(vt, mode); return <span style={{ background: a.bg, color: a.color, fontSize: 12, fontWeight: 500, padding: "2px 9px", borderRadius: 999 }}>{vt}</span>; })() : null}</td>
        <td style={{ ...dc, textAlign: "right" }}><ScoreCell score={score(item)} C={C} /></td>
        <td style={{ ...dc, textAlign: "right", color: item.ease ? C.textPrimary : C.textTertiary }}>{item.ease || "–"}</td>
        <td style={{ ...dc, textAlign: "right", color: item.impact ? C.textPrimary : C.textTertiary }}>{item.impact || "–"}</td>
        <td style={{ ...dc, textAlign: "right" }}>
          <button onClick={e => { e.stopPropagation(); setEvidenceFor(item.id); }} title="Confidence evidence" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.accent, fontSize: 13, fontFamily: "inherit" }}>{confidenceOf(item).toFixed(2)}</button>
        </td>
        <td style={dc}>{item.link ? <a href={item.link} style={{ fontSize: 13, color: C.accent, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>{/figma/i.test(item.link) ? "Figma" : item.link.replace(/^https?:\/\//, "").split("/")[0]}</a> : null}</td>
        <td style={dc} />
        <td style={dc} />
      </>
    );
  }

  function GroupCard({ label, rows, allowDrag, subtitle, onEdit, accentColor }) {
    const acc = accentColor || C.accent;
    const collapseKey = view + ":" + label;
    const isCollapsed = collapsed[collapseKey];
    const isGroupDropTarget = allowDrag && overInfo.group === label && overInfo.id === null;
    return (
      <div key={collapseKey} style={{ marginBottom: "1.75rem" }}>
        <div data-crumb={label} data-crumb-level="group" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px", cursor: "pointer" }}
          onClick={() => setCollapsed(c => ({ ...c, [collapseKey]: !c[collapseKey] }))}>
          <span style={{ color: acc, display: "inline-flex" }}><Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={15} /></span>
          <span style={{ fontWeight: 500, fontSize: 15, color: acc }}>{label}</span>
          <span style={{ fontSize: 12, color: C.textTertiary, fontWeight: 400 }}>{rows.length}</span>
          {subtitle && subtitle.trim() && (
            <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{subtitle}</span>
          )}
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit version" aria-label="Edit version"
              style={{ marginLeft: "auto", flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer", color: C.textTertiary, display: "inline-flex" }}>
              <Icon name="pencil" size={14} />
            </button>
          )}
        </div>
        {!isCollapsed && (
          <div
            onDragOver={allowDrag ? (e => { e.preventDefault(); setOverInfo({ id: null, group: label }); }) : undefined}
            onDrop={allowDrag ? (() => handleDrop(label, null)) : undefined}
            style={{ background: C.cardBg, border: `1px solid ${isGroupDropTarget ? C.accent : C.cardBorder}`, borderRadius: 12, boxShadow: C.shadow }}>
            <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {allowDrag && <col style={{ width: colW.drag }} />}<col style={{ width: colW.init }} /><col style={{ width: colW.area }} /><col style={{ width: colW.version }} /><col style={{ width: colW.score }} /><col style={{ width: colW.num }} /><col style={{ width: colW.num }} /><col style={{ width: colW.conf }} /><col style={{ width: colW.link }} /><col /><col style={{ width: colW.del }} />
              </colgroup>
              <thead>
                <tr style={{ background: C.headBg, borderBottom: `1px solid ${C.cardBorder}` }}>
                  {allowDrag && headCell("", colW.drag, false, undefined, "left")}
                  {headCell("Initiative", colW.init, false, undefined, allowDrag ? undefined : "left")}
                  {headCell("Area", colW.area)}
                  {headCell("Version", colW.version)}
                  {headCell("Score", colW.score, true)}
                  {headCell("Ease", colW.num, true, "How easy to build (1–10)")}
                  {headCell("Impact", colW.num, true, "Expected impact (1–10)")}
                  {headCell("Conf", colW.conf, true, "Confidence multiplier (0–10), from evidence checkboxes")}
                  {headCell("Link", colW.link)}
                  {headCell("")}
                  {headCell("", colW.del, false, undefined, "right")}
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
        )}
      </div>
    );
  }

  const sortedVersions = sortVersions(versions);

  const tabBtn = (id, label) => {
    const active = view === id;
    return (
      <button onClick={() => switchView(id)}
        style={{ background: active ? C.headBg : "transparent", border: "none", borderRadius: 7, cursor: "pointer", color: active ? C.textPrimary : C.textSecondary, fontSize: 13, fontWeight: 500, padding: "5px 14px" }}>{label}</button>
    );
  };

  const toolBtn = { background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 8, cursor: "pointer", color: C.textSecondary, fontSize: 13, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 };
  const sectionBar = { background: C.headBg, color: C.textPrimary, fontSize: 15, fontWeight: 500, padding: "8px 12px", borderRadius: 8, marginBottom: "1rem" };

  return (
    <div ref={rootRef} style={{ background: C.pageBg, minHeight: "100vh", height: isFs ? "100vh" : undefined, overflowY: isFs ? "auto" : undefined, padding: "1.25rem 0.5rem", fontFamily: "var(--font-sans)" }}>
      <h2 className="sr-only">Product roadmap planner</h2>
      <div ref={toolbarRef} style={{ position: "sticky", top: 0, zIndex: 20, background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "0.75rem 4px", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {isPublic
            ? <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, padding: "0 4px" }}>Roadmap</div>
            : (
              <div style={{ display: "inline-flex", gap: 2, background: C.tabBg, border: `1px solid ${C.cardBorder}`, borderRadius: 9, padding: 3 }}>
                {tabBtn("main", "Main")}
                {tabBtn("versions", "Versions")}
              </div>
            )}
          {(isPublic ? crumb.section : crumb.group) && (
            <span style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {isPublic ? ` / ${crumb.section}${crumb.group ? ` / ${crumb.group}` : ""}` : crumb.group}
            </span>
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
          {!isPublic && canEdit && view === "versions" && (
            <button onClick={openNewVersion} style={toolBtn} aria-label="Add version">
              <Icon name="plus" size={15} /> Add version
            </button>
          )}
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

      {!isPublic && view === "main" && (() => {
        // Initiatives whose version is archived leave their normal group and
        // collect at the bottom under "Released".
        const archivedVids = new Set(versions.filter(v => v.archived).map(v => v.id));
        const isReleased = i => i.version_id && archivedVids.has(i.version_id);
        const active = items.filter(i => !isReleased(i));
        const released = items.filter(isReleased).sort((a, b) => a.position - b.position);
        const groups = [...GROUPS, ...[...new Set(active.map(i => (i.group || "").trim()))].filter(g => g && !GROUPS.includes(g))];
        return (
          <>
            {groups.map(group =>
              GroupCard({ label: group, rows: active.filter(i => (i.group || "").trim() === group), allowDrag: canEdit })
            )}
            {released.length > 0 && GroupCard({ label: "Released", rows: released, allowDrag: false, accentColor: C.green })}
          </>
        );
      })()}

      {isPublic && sortedVersions.length > 0 && <div data-crumb="Versions" data-crumb-level="section" style={sectionBar}>Versions</div>}

      {view === "versions" && (
        sortedVersions.length === 0
          ? (!isPublic ? <div style={{ padding: "2rem 4px", fontSize: 13, color: C.textSecondary }}>No versions yet. Add one with the "Add version" button above.</div> : null)
          : sortedVersions.map(v =>
            GroupCard({ label: v.version, rows: items.filter(i => i.version_id === v.id), allowDrag: false, subtitle: v.description, onEdit: canEdit ? () => openVersionEdit(v) : null, accentColor: v.archived ? C.green : undefined })
          )
      )}

      {isPublic && (() => {
        const unassigned = items.filter(i => !i.version_id);
        const groups = [...GROUPS, ...[...new Set(unassigned.map(i => (i.group || "").trim()))].filter(g => g && !GROUPS.includes(g))]
          .filter(g => unassigned.some(i => (i.group || "").trim() === g));
        if (!groups.length) return null;
        return (
          <>
            <div data-crumb="Unassigned initiatives" data-crumb-level="section" style={sectionBar}>Unassigned initiatives</div>
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

      {versionEditFor != null && (() => {
        const isNewV = versionEditFor === "new";
        return (
          <div onMouseDown={() => setVersionEditFor(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div onMouseDown={e => e.stopPropagation()}
              style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 20, maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 14 }}>{isNewV ? "Add version" : "Edit version"}</div>
              <label style={{ fontSize: 12, color: C.textSecondary, display: "block", marginBottom: 4 }}>Version</label>
              <input autoFocus placeholder="2.0" value={versionDraft.version} onChange={e => setVersionDraft(d => ({ ...d, version: e.target.value }))} style={inputStyle} />
              <label style={{ fontSize: 12, color: C.textSecondary, display: "block", marginTop: 12, marginBottom: 4 }}>Description</label>
              <AutoTextarea val={versionDraft.description} onChange={v => setVersionDraft(d => ({ ...d, description: v }))} C={C} placeholder="What's in this version…" />
              <div style={{ display: "flex", justifyContent: isNewV ? "flex-end" : "space-between", alignItems: "center", gap: 8, marginTop: 18 }}>
                {!isNewV && (() => {
                  const v = versions.find(x => x.id === versionEditFor);
                  const isArch = !!(v && v.archived);
                  return (
                    <button onClick={toggleVersionArchived}
                      style={{ background: "none", color: C.textSecondary, border: `1px solid ${C.cardBorder}`, borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "6px 14px" }}>
                      {isArch ? "Unarchive version" : "Archive version"}
                    </button>
                  );
                })()}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setVersionEditFor(null)}
                    style={{ background: "none", color: C.textSecondary, border: `1px solid ${C.cardBorder}`, borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "6px 14px" }}>Cancel</button>
                  <button onClick={saveVersionDraft} disabled={!versionDraft.version.trim()}
                    style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: versionDraft.version.trim() ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 500, padding: "6px 14px", opacity: versionDraft.version.trim() ? 1 : 0.5 }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {evidenceFor != null && (() => {
        const isNewT = evidenceFor === "new";
        const target = isNewT ? newItem : items.find(i => i.id === evidenceFor);
        if (!target) return null;
        const ev = target.evidence || {};
        const setEv = (key, checked) => {
          if (!canEdit) return;
          if (isNewT) setNewItem(n => ({ ...n, evidence: { ...(n.evidence || {}), [key]: checked } }));
          else { setItems(p => p.map(i => i.id === evidenceFor ? { ...i, evidence: { ...(i.evidence || {}), [key]: checked } } : i)); markDirty(evidenceFor); }
        };
        return (
          <div onMouseDown={() => setEvidenceFor(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
            <div onMouseDown={e => e.stopPropagation()}
              style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, maxWidth: 1600, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.4)", overflow: "hidden" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, padding: "14px 18px", borderBottom: `1px solid ${C.cardBorder}` }}>Evidence in support of impact and ease estimates</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "14px 18px 10px" }}>
                <span style={{ fontSize: 15, color: C.textPrimary }}>
                  <span style={{ fontWeight: 600 }}>{target.title || "New initiative"}</span>
                  <span style={{ fontWeight: 400, color: C.textSecondary, marginLeft: 10 }}>Ease {target.ease || 0} / Impact {target.impact || 0}</span>
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{confidenceOf(target).toFixed(2)}</span>
              </div>
              <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateColumns: `repeat(${EVIDENCE.length}, minmax(96px, 1fr))`, gridTemplateRows: "auto auto 1fr auto", columnGap: 10, rowGap: 8, padding: "6px 18px 16px", overflowX: "auto" }}>
                {EVIDENCE.flatMap(f => [
                  <div key={f.key + "-t"} style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary, lineHeight: 1.3, textAlign: "left" }}>{f.label}</div>,
                  <div key={f.key + "-w"} style={{ fontSize: 12, color: C.textSecondary, textAlign: "left" }}>{f.weight.toFixed(2)}</div>,
                  <div key={f.key + "-d"} style={{ fontSize: 11, opacity: 0.4, color: C.textPrimary, lineHeight: 1.35, alignSelf: "start" }}>
                    <div style={{ marginBottom: 3 }}>{f.intro.replace(/\s*\/\s*/g, " / ")}</div>
                    {f.points.map((p, i) => <div key={i}>– {p.replace(/\s*\/\s*/g, " / ")}</div>)}
                  </div>,
                  <div key={f.key + "-c"} style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", paddingTop: 4 }}>
                    <input type="checkbox" checked={!!ev[f.key]} disabled={!canEdit}
                      onChange={e => setEv(f.key, e.target.checked)}
                      style={{ width: 17, height: 17, accentColor: C.accent, cursor: canEdit ? "pointer" : "not-allowed" }} />
                  </div>,
                ])}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 18px 16px" }}>
                <button onClick={() => setEvidenceFor(null)}
                  style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, padding: "7px 16px" }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
