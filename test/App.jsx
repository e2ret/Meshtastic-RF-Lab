import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ─── palette ─────────────────────────────────────────────────── */
const $ = {
  bg:       "#0f1117",
  surface:  "#1a1d27",
  card:     "#1e2130",
  border:   "#2a2d3e",
  blue:     "#4da3ff",
  green:    "#2dd4a0",
  amber:    "#f59e0b",
  red:      "#f87171",
  textPri:  "#e8eaf0",
  textSec:  "#c8d0e8",
  textMute: "#8892b0",
};

/* ─── helpers ─────────────────────────────────────────────────── */
function DN(rssi) {
  if (rssi >= -80)  return $.green;
  if (rssi >= -100) return $.amber;
  return $.red;
}
function ON(rssi) {
  if (rssi >= -80)  return "GOOD";
  if (rssi >= -100) return "FAIR";
  return "WEAK";
}


/* ─── timeAgo ─────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "";
  // ts is like "11:34:26" — parse as today
  const [h, m, s] = ts.split(":").map(Number);
  const now = new Date();
  const then = new Date();
  then.setHours(h, m, s, 0);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 5)  return "сейчас";
  if (diff < 60) return `${diff}с`;
  if (diff < 3600) return `${Math.floor(diff/60)}м`;
  return `${Math.floor(diff/3600)}ч`;
}
/* ─── Tooltip ─────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: $.surface, border: `1px solid ${$.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 13, color: $.textSec,
    }}>
      <div style={{ marginBottom: 4, color: $.textPri, fontWeight: 600 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: 10 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── SectionLabel ────────────────────────────────────────────── */
const AN = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 700, letterSpacing: "1px",
    textTransform: "uppercase", color: $.textMute, marginBottom: 6,
  }}>
    {children}
  </div>
);

/* ─── TrendBadge ──────────────────────────────────────────────── */
const jN = ({ current: e, previous: t, unit: n, inverse: r = false }) => {
  if (t == null || e == null) return null;
  const i = e - t;
  const a = r ? i < 0 : i > 0;
  const o = r ? i > 0 : i < 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, marginLeft: 6,
      color: a ? $.green : o ? $.red : $.textMute,
      display: "inline-flex", alignItems: "center", gap: 2,
    }}>
      {a && "↑"}{o && "↓"}{Math.abs(i).toFixed(1)}{n}
    </span>
  );
};

/* ─── MetricCard ──────────────────────────────────────────────── */
const MN = ({ label, value, unit, color, previous, inverse, source, maxVal, onResetMax }) => {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (previous != null && value !== "—") {
      const cur = parseFloat(value);
      const prev = parseFloat(previous);
      if (!isNaN(cur) && !isNaN(prev) && (inverse ? cur < prev : cur > prev)) {
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [value, previous, inverse]);

  return (
    <div style={{
      background: flash ? `${$.green}10` : $.card,
      border: `1px solid ${flash ? $.green : $.border}`,
      borderRadius: 12, padding: "12px 16px", flex: 1,
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: $.textMute, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: color || $.textPri, lineHeight: 1 }}>
          {value}
          {unit && <span style={{ fontSize: 12, fontWeight: 400, color: $.textSec, marginLeft: 4 }}>{unit}</span>}
        </div>
        {previous != null && value !== "—" && (
          <jN current={parseFloat(value)} previous={parseFloat(previous)} unit={unit} inverse={inverse} />
        )}
        {source && (
          <span style={{ fontSize: 10, color: $.textMute, marginLeft: 8, fontWeight: 400 }}>• {source}</span>
        )}
      </div>
      {maxVal != null && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: $.textMute }}>Max: {maxVal} dBm</span>
          {onResetMax && (
            <button onClick={onResetMax} style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 4,
              border: `1px solid ${$.border}`, background: $.bg,
              color: $.textMute, cursor: "pointer",
            }}>Reset</button>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── SignalBar ───────────────────────────────────────────────── */
const NN = ({ rssi }) => {
  const pct = Math.min(100, Math.max(0, (rssi + 120) / 80 * 100));
  const color = DN(rssi);
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {Array.from({ length: 20 }, (_, n) => {
          const r = (n + 1) / 20 * 100;
          const active = r <= pct;
          const c = r <= 25 ? $.red : r <= 50 ? $.amber : $.green;
          return (
            <div key={n} style={{
              flex: 1, height: 4,
              background: active ? c : `${c}30`,
              marginRight: n < 19 ? 1 : 0,
              borderRadius: 1,
            }} />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, color: $.textMute }}>-120</span>
        <span style={{ fontSize: 9, color, fontWeight: 600 }}>{ON(rssi)}</span>
        <span style={{ fontSize: 9, color: $.textMute }}>-40</span>
      </div>
    </div>
  );
};

/* ─── NodeCard ────────────────────────────────────────────────── */
const PN = ({ link, name, prevRssi, isSelected, onSelect, packetCount, onRename, relays, nodeNames, isFlashing, onTrace }) => {
  const rssi  = parseFloat(link.rssi);
  const color = DN(rssi);
  const label = ON(rssi);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setEditName(name); }, [name]);
  const [, forceUpdate] = useState(0);
  useEffect(() => { const t = setInterval(() => forceUpdate(n => n+1), 5000); return () => clearInterval(t); }, []);

  const commit = () => { editName.trim() && onRename(editName.trim()); setEditing(false); };

  const relayNames = relays?.map(id => nodeNames?.[id] || `0x${id}`).join(", ");

  return (
    <div
      onClick={editing ? undefined : onSelect}
      style={{
        background: isFlashing ? `${$.blue}10` : isSelected ? `${$.blue}08` : $.card,
        borderLeft: `4px solid ${isSelected ? $.blue : color}`,
        border: `1px solid ${isSelected ? $.blue : $.border}`,
        borderRadius: 8, padding: "7px 10px", marginBottom: 5,
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
        animation: isFlashing ? "flashCard 0.5s ease" : "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              style={{
                fontSize: 14, fontWeight: 700, color: $.textPri,
                border: `1px solid ${$.blue}`, borderRadius: 4,
                padding: "2px 6px", background: $.bg, width: "100%",
              }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: $.textPri }}>{name}</div>
              <button
                onClick={e => { e.stopPropagation(); setEditing(true); }}
                title="Rename"
                style={{
                  fontSize: 10, background: "none", border: "none",
                  cursor: "pointer", color: $.textMute, padding: "0 2px",
                }}
              >✏️</button>
              {packetCount > 0 && (
                <span style={{
                  fontSize: 9, background: `${$.blue}15`, color: $.blue,
                  borderRadius: 10, padding: "1px 5px", fontWeight: 600,
                }}>
                  {packetCount}
                </span>
              )}
              {onTrace && (
                <button
                  onClick={e => { e.stopPropagation(); onTrace(); }}
                  title="Трассировка"
                  style={{
                    fontSize: 10, background: "none", border: "none",
                    cursor: "pointer", color: $.textMute, padding: "0 2px",
                  }}
                >🔍</button>
              )}
            </div>
          )}
          <div style={{ display: "none" }}>
            0x{link.from}{link.hops > 0 && <span style={{ color: $.amber, marginLeft: 4 }}>· {link.hops}h</span>}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.6px",
          color, background: `${color}15`,
          padding: "2px 8px", borderRadius: 5,
          border: `1px solid ${color}40`, marginTop: 2, flexShrink: 0,
        }}>
          {label}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color: $.textMute, marginBottom: 1 }}>RSSI</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>
              {link.rssi}<span style={{ fontSize: 10, color: $.textSec, marginLeft: 2 }}>dBm</span>
            </div>
            {prevRssi != null && (
              <jN current={rssi} previous={prevRssi} unit="" />
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: $.textMute, marginBottom: 1 }}>SNR</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: $.blue }}>
            {link.snr}<span style={{ fontSize: 10, color: $.textSec, marginLeft: 2 }}>dB</span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
          <span style={{ fontSize: 11, color: $.textMute, fontVariantNumeric: "tabular-nums" }}>
            {timeAgo(link.lastSeen)}
          </span>
        </div>
      </div>

      {/* Signal bar */}
      <NN rssi={rssi} />

      {/* Relay info */}
      {relayNames && (
        <div style={{
          fontSize: 11, color: $.blue, marginTop: 6,
          background: `${$.blue}08`, borderRadius: 5,
          padding: "3px 7px",
        }}>
          🔁 via {relayNames}
        </div>
      )}


    </div>
  );
};


/* ─── TraceModal ──────────────────────────────────────────────── */
const TraceModal = ({ nodeId, nodeName, link, nodeNames, onClose }) => {
  const relays = link?.relays || [];
  const hops   = link?.hops  || 0;
  const rssi   = parseFloat(link?.rssi);
  const snr    = parseFloat(link?.snr);

  // Build route: source -> ...relays... -> us
  // relays[] = intermediate nodes (from relay= field)
  const route = [nodeId, ...relays];

  const quality = (snr) => {
    if (snr >= 5)   return { label: "Отлично", color: "#2dd4a0", bar: 100 };
    if (snr >= 0)   return { label: "Хорошо",  color: "#2dd4a0", bar: 75  };
    if (snr >= -5)  return { label: "Средне",  color: "#f59e0b", bar: 50  };
    if (snr >= -10) return { label: "Слабо",   color: "#f87171", bar: 25  };
    return           { label: "Плохо",   color: "#f87171", bar: 10  };
  };

  const rssiColor = (r) => r >= -80 ? "#2dd4a0" : r >= -100 ? "#f59e0b" : "#f87171";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: "#1a1d27", border: "1px solid #2a2d3e",
        borderRadius: 16, padding: "28px 32px", minWidth: 480, maxWidth: 640,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0" }}>
              Трассировка: <span style={{ color: "#4da3ff" }}>{nodeName}</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7494", marginTop: 4, fontFamily: "monospace" }}>
              0x{nodeId} · {hops > 0 ? `${hops} хоп${hops > 1 ? "а" : ""}` : "прямой"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#2a2d3e", border: "none", borderRadius: 8,
            color: "#8892b0", fontSize: 18, width: 36, height: 36,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {[
            { label: "RSSI", value: `${rssi} dBm`, color: rssiColor(rssi) },
            { label: "SNR",  value: `${snr} dB`,   color: quality(snr).color },
            { label: "Хопов", value: hops || "прямой", color: "#4da3ff" },
            { label: "Качество", value: quality(snr).label, color: quality(snr).color },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, background: "#0f1117", borderRadius: 10,
              padding: "10px 12px", border: "1px solid #2a2d3e",
            }}>
              <div style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* SNR quality bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7494" }}>Качество сигнала</span>
            <span style={{ fontSize: 11, color: quality(snr).color, fontWeight: 600 }}>{quality(snr).label}</span>
          </div>
          <div style={{ height: 6, background: "#2a2d3e", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${quality(snr).bar}%`,
              background: quality(snr).color, borderRadius: 3,
              transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 9, color: "#6b7494" }}>Плохо</span>
            <span style={{ fontSize: 9, color: "#6b7494" }}>Отлично</span>
          </div>
        </div>

        {/* Route chain */}
        <div style={{ background: "#0f1117", borderRadius: 12, padding: "16px 20px", border: "1px solid #2a2d3e" }}>
          <div style={{ fontSize: 11, color: "#6b7494", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
            Маршрут пакета
          </div>

          {route.length === 0 ? (
            <div style={{ color: "#6b7494", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
              Прямое соединение — ретрансляторов нет
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Source node */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `${rssiColor(rssi)}20`,
                  border: `2px solid ${rssiColor(rssi)}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0,
                }}>📡</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0" }}>{nodeName}</div>
                  <div style={{ fontSize: 10, color: "#6b7494", fontFamily: "monospace" }}>0x{nodeId}</div>
                </div>
              </div>

              {/* Relay hops */}
              {relays.map((relayId, i) => (
                <div key={relayId}>
                  <div style={{ display: "flex", alignItems: "center", marginLeft: 17, paddingLeft: 1, gap: 0 }}>
                    <div style={{ width: 2, height: 24, background: "#2a2d3e" }} />
                    <div style={{ fontSize: 11, color: "#f59e0b", marginLeft: 12 }}>↓ ретрансляция</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "#f59e0b20", border: "2px solid #f59e0b",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0,
                    }}>🔁</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0" }}>
                        {nodeNames?.[relayId] || `0x${relayId}`}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7494", fontFamily: "monospace" }}>0x{relayId}</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Arrow to us */}
              <div style={{ display: "flex", alignItems: "center", marginLeft: 17, paddingLeft: 1 }}>
                <div style={{ width: 2, height: 24, background: "#2a2d3e" }} />
                <div style={{ fontSize: 11, color: "#2dd4a0", marginLeft: 12 }}>
                  ↓ {rssi} dBm · SNR {snr} dB
                </div>
              </div>

              {/* Us */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#4da3ff20", border: "2px solid #4da3ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0,
                }}>🖥️</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4da3ff" }}>Вы (локальная нода)</div>
                  <div style={{ fontSize: 10, color: "#6b7494" }}>точка назначения</div>
                </div>
              </div>
            </div>
          )}

          {hops === 0 && route.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `${rssiColor(rssi)}20`, border: `2px solid ${rssiColor(rssi)}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>📡</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0" }}>{nodeName}</div>
                  <div style={{ fontSize: 10, color: "#6b7494", fontFamily: "monospace" }}>0x{nodeId}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginLeft: 17 }}>
                <div style={{ width: 2, height: 24, background: "#2a2d3e" }} />
                <div style={{ fontSize: 11, color: "#2dd4a0", marginLeft: 12 }}>↓ {rssi} dBm · SNR {snr} dB · прямой</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#4da3ff20", border: "2px solid #4da3ff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>🖥️</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4da3ff" }}>Вы</div>
                  <div style={{ fontSize: 10, color: "#6b7494" }}>точка назначения</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── App ─────────────────────────────────────────────────────── */
export default function App() {
  const [connected,   setConnected]   = useState(false);
  const [history,     setHistory]     = useState([]);
  const [links,       setLinks]       = useState({});
  const [prevLinks,   setPrevLinks]   = useState({});
  const [order,       setOrder]       = useState([]);
  const [log,         setLog]         = useState([]);
  const [pktCount,    setPktCount]    = useState(0);
  const [pktPerNode,  setPktPerNode]  = useState({});
  // nodeNames persisted in localStorage
  const [nodeNames,   setNodeNames]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("meshNodeNames") || "{}"); } catch { return {}; }
  });
  const [myNodeId,    setMyNodeId]    = useState(() => localStorage.getItem("meshMyNodeId") || null);
  const [allPackets,  setAllPackets]  = useState(true);   // true=All Packets/My TX toggle
  const [singleMode,  setSingleMode]  = useState(false);
  const [focusId,     setFocusId]     = useState(null);
  const [baseline,    setBaseline]    = useState(null);
  const [maxRssi,     setMaxRssi]     = useState(null);
  const [flashId,     setFlashId]     = useState(null);
  const [traceNode,   setTraceNode]   = useState(null); // {id, name}
  const [editingMyId, setEditingMyId] = useState(false);

  // Refs for use inside async processLine without stale closure
  const focusIdRef   = useRef(focusId);
  const singleRef    = useRef(singleMode);
  const allPktsRef   = useRef(allPackets);
  const myNodeRef    = useRef(myNodeId);
  const nodeNamesRef = useRef(nodeNames);
  const flashTimer   = useRef(null);
  const logEndRef    = useRef(null);

  useEffect(() => { focusIdRef.current   = focusId;    }, [focusId]);
  useEffect(() => { singleRef.current    = singleMode; }, [singleMode]);
  useEffect(() => { allPktsRef.current   = allPackets; }, [allPackets]);
  useEffect(() => { myNodeRef.current    = myNodeId;   }, [myNodeId]);
  useEffect(() => { nodeNamesRef.current = nodeNames;  }, [nodeNames]);

  // Persist names & myNodeId
  useEffect(() => {
    try { localStorage.setItem("meshNodeNames", JSON.stringify(nodeNames)); } catch {}
    if (myNodeId) try { localStorage.setItem("meshMyNodeId", myNodeId); } catch {}
  }, [nodeNames, myNodeId]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  const resolveName = useCallback(id =>
    nodeNamesRef.current[id] || `0x${id}`, []);

  const renameNode = useCallback((id, name) => {
    setNodeNames(prev => ({ ...prev, [id]: name }));
  }, []);

  /* ── serial ─────────────────────────────────────────────────── */
  const connectSerial = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setConnected(true);
      const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) processLine(line.trim());
      }
    } catch { setConnected(false); }
  };

  /* ── parse line ─────────────────────────────────────────────── */
  const processLine = useCallback((line) => {
    // Node info line
    if (line.includes("long_name=")) {
      const idM    = line.match(/(?:node|fr)=?0x([0-9a-f]+)/i);
      const longM  = line.match(/long_name=([^\s]+)/);
      const shortM = line.match(/short_name=([^\s]+)/);
      if (idM && (longM || shortM)) {
        const id = idM[1].toLowerCase();
        setNodeNames(prev => ({
          ...prev,
          [id]: longM?.[1] || shortM?.[1] || prev[id],
        }));
      }
      return;
    }

    // Detect local node from telemetry LOCAL or phone downloaded with LOCAL context
    if (!myNodeRef.current) {
      // Pattern 1: "updateTelemetry LOCAL" followed by fr= in same or next lines
      if (line.includes("updateTelemetry LOCAL") || line.includes("DeviceTelemetry") && line.includes("LOCAL")) {
        // store flag, next fr= will be ours
        window._expectLocalNode = true;
        return;
      }
      // Pattern 2: NimbleBluetooth phone downloaded packet after LOCAL telemetry
      if (window._expectLocalNode && line.includes("NimbleBluetooth") && line.includes("phone downloaded packet")) {
        const frM = line.match(/fr=0x([0-9a-f]+)/i);
        if (frM) {
          setMyNodeId(frM[1].toLowerCase());
          window._expectLocalNode = false;
        }
        return;
      }
      // Pattern 3: Started Tx where noda sends its own beacon (Portnum=67 is telemetry)
      if (line.includes("Started Tx") && line.includes("Portnum=67")) {
        const frM = line.match(/fr=0x([0-9a-f]+)/i);
        if (frM) {
          setMyNodeId(frM[1].toLowerCase());
        }
        return;
      }
    }

    if (!line.includes("RadioIf") || !line.includes("rxSNR")) return;

    const from  = line.match(/fr=0x([0-9a-f]+)/i)?.[1]?.toLowerCase();
    const snr   = parseFloat(line.match(/rxSNR=([-0-9.]+)/)?.[1]);
    const rssi  = parseFloat(line.match(/rxRSSI=([-0-9.]+)/)?.[1]);
    const pktId = line.match(/id=0x([0-9a-f]+)/i)?.[1]?.toLowerCase();
    const hopsM = line.match(/hopsAway=(\d+)/i)?.[1];
    const hops  = hopsM ? parseInt(hopsM) : 0;

    // Relay detection
    const isRelayed = line.includes("RELAYED") || line.includes("handleReceived(RELAYED)");
    const relayFrom = isRelayed ? line.match(/from=0x([0-9a-f]+)/i)?.[1]?.toLowerCase() : null;

    if (!from || isNaN(rssi) || rssi >= 0) return;

    const ts    = new Date().toLocaleTimeString();
    const tsFmt = ts.split(" ")[0] || ts;

    // Update relay tracking
    if (pktId && relayFrom) {
      setLinks(prev => {
        const node = prev[from] || { from, relays: [], snr: snr.toFixed(1), rssi: rssi.toFixed(0) };
        if (!node.relays.includes(relayFrom)) {
          return { ...prev, [from]: { ...node, relays: [...node.relays, relayFrom] } };
        }
        return prev;
      });
    }

    setHistory(prev => [...prev.slice(-59), { time: tsFmt, rssi, snr, from, pktId }]);
    setPktCount(n => n + 1);
    setPktPerNode(prev => ({ ...prev, [from]: (prev[from] || 0) + 1 }));
    setLog(prev => [...prev.slice(-99), `${ts}  ·  ${resolveName(from)}  ·  RSSI ${rssi} dBm  ·  SNR ${snr} dB`]);

    // Auto-detect via "Started Tx" — handled in processLine below

    setPrevLinks(prev => ({ ...prev, [from]: links[from] }));
    setOrder(prev => prev.includes(from) ? prev : [from, ...prev]);
    setLinks(prev => ({
      ...prev,
      [from]: {
        from,
        snr:      snr.toFixed(1),
        rssi:     rssi.toFixed(0),
        lastSeen: ts,
        relays:   prev[from]?.relays || [],
        hops,
      },
    }));

    // Flash
    setFlashId(from);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 500);

    // Max RSSI (only when relevant to filter)
    const inScope = allPktsRef.current || from === myNodeRef.current;
    if (inScope) setMaxRssi(prev => prev === null || rssi > prev ? rssi : prev);
  }, [resolveName]);

  /* ── derived ──────────────────────────────────────────────────── */
  const myTxHistory = myNodeId ? history.filter(h => h.from === myNodeId) : history;
  const dispHistory = allPackets ? history : myTxHistory;
  const focusHistory = (singleMode && focusId) ? history.filter(h => h.from === focusId) : dispHistory;

  const sortedOrder = [...order].sort((a, b) =>
    parseFloat(links[b]?.rssi || -200) - parseFloat(links[a]?.rssi || -200)
  );
  const localNode  = myNodeId && links[myNodeId];
  const remoteList = sortedOrder.filter(id => id !== myNodeId);

  const last     = focusHistory[focusHistory.length - 1];
  const prevLast = focusHistory[focusHistory.length - 2];
  const avgRssi  = focusHistory.length
    ? (focusHistory.reduce((s, h) => s + h.rssi, 0) / focusHistory.length).toFixed(0)
    : null;

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div style={{
      background: $.bg, color: $.textPri,
      width: "100vw", height: "100vh",
      padding: "16px 24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column", gap: 14,
      boxSizing: "border-box",
      overflow: "hidden", position: "fixed", top: 0, left: 0,
    }}>

      {/* ── HEADER ── */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 14, borderBottom: `1px solid ${$.border}`, flexShrink: 0,
      }}>
        {/* Logo + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${$.blue}15`, border: `1px solid ${$.blue}30`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>📡</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px" }}>
              Meshtastic <span style={{ color: $.blue }}>RF Lab</span>
            </div>
            <div style={{ fontSize: 12, color: $.textMute, marginTop: 1 }}>LoRa signal monitor v2.1</div>
          </div>
          {connected && (
            <div style={{
              marginLeft: 16, paddingLeft: 16,
              borderLeft: `1px solid ${$.border}`,
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: $.green, fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: $.green, animation: "pulse 2s infinite" }} />
                <span>Monitoring</span>
              </div>
              <div style={{ fontSize: 11, color: $.textMute, marginTop: 2, fontFamily: "monospace" }}>
                {myNodeId ? `Local: 0x${myNodeId}` : "Local: Detecting..."}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {connected ? (
            <>
              {/* My TX / All Packets */}
              <button
                onClick={() => { setAllPackets(p => !p); setFocusId(null); setSingleMode(false); setBaseline(null); }}
                style={{
                  padding: "10px 18px", borderRadius: 10, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap",
                  border: `1px solid ${allPackets ? $.border : $.amber}`,
                  background: allPackets ? $.bg : $.amber,
                  color: allPackets ? $.textSec : "#fff",
                  boxShadow: allPackets ? "0 2px 4px rgba(0,0,0,0.05)" : "0 4px 12px rgba(133,79,11,0.35)",
                  transition: "all 0.2s ease",
                }}
              >
                {allPackets ? "All Packets" : "My TX"}
              </button>

              {/* My Node ID */}
              {allPackets && (
                editingMyId ? (
                  <input
                    autoFocus
                    value={myNodeId || ""}
                    onChange={e => setMyNodeId(e.target.value.toLowerCase().replace(/[^0-9a-f]/g, ""))}
                    onBlur={() => setEditingMyId(false)}
                    onKeyDown={e => { if (e.key === "Enter") setEditingMyId(false); }}
                    placeholder="Enter node hex ID"
                    style={{
                      fontSize: 12, padding: "8px 12px", borderRadius: 8,
                      border: `1px solid ${$.blue}`, background: $.surface, color: $.textPri,
                      WebkitTextFillColor: $.textPri, width: 160, outline: "none", fontFamily: "monospace",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingMyId(true)}
                    title="Click to edit My Node ID"
                    style={{
                      padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${$.border}`, background: $.surface,
                      display: "flex", flexDirection: "column", gap: 2,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span style={{ fontSize: 12, color: $.textPri, fontWeight: 600 }}>
                      {myNodeId ? `My Node: 0x${myNodeId}` : "Set My ID"}
                    </span>
                    {myNodeId && <span style={{ fontSize: 10, color: $.textMute }}>(click to edit)</span>}
                  </button>
                )
              )}

              {/* Single focus badge */}
              {!allPackets && focusId && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fff", border: `1px solid ${$.border}`,
                  borderRadius: 8, padding: "6px 12px",
                }}>
                  <span style={{ fontSize: 12, color: $.textSec }}>Focus:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: $.blue }}>{resolveName(focusId)}</span>
                  <button
                    onClick={() => setFocusId(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: $.textMute, fontSize: 14 }}
                  >×</button>
                </div>
              )}

              {/* Set Baseline */}
              <button
                onClick={() => { if (last) { setBaseline({ rssi: last.rssi, snr: last.snr }); } }}
                style={{
                  padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, lineHeight: 1,
                  background: baseline ? `${$.green}15` : $.surface,
                  color: baseline ? $.green : $.textSec,
                  border: `1px solid ${baseline ? $.green + "50" : $.border}`,
                  boxShadow: baseline ? `0 4px 12px rgba(15,110,86,0.35)` : "0 2px 4px rgba(0,0,0,0.05)",
                  transition: "all 0.2s ease",
                }}
              >
                {baseline ? "✓ Baseline" : "Set Baseline"}
              </button>
            </>
          ) : (
            <button onClick={connectSerial} style={{
              background: $.blue, color: "#fff", border: `1px solid ${$.blue}`,
              padding: "10px 22px", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 600, lineHeight: 1,
            }}>
              Connect USB
            </button>
          )}
        </div>
      </header>

      {/* ── METRICS ── */}
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <MN
          label="Last RSSI"
          value={last ? last.rssi.toFixed(0) : "—"}
          unit={last ? "dBm" : ""}
          color={last ? DN(last.rssi) : $.textMute}
          previous={prevLast?.rssi}
          maxVal={maxRssi}
          onResetMax={() => setMaxRssi(null)}
        />
        <MN
          label="Last SNR"
          value={last ? last.snr.toFixed(1) : "—"}
          unit={last ? "dB" : ""}
          color={$.blue}
          previous={prevLast?.snr}
          source={!allPackets && last ? resolveName(last.from) : null}
        />
        <MN
          label="Avg RSSI"
          value={avgRssi ?? "—"}
          unit={avgRssi ? "dBm" : ""}
          previous={undefined}
        />
        <MN label="Packets" value={pktCount} />
      </div>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>

        {/* SIDEBAR */}
        <div style={{ flex: "0 0 270px", display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <AN>Active RF links</AN>
            <span style={{
              fontSize: 10, color: $.textMute, background: $.surface,
              padding: "2px 6px", borderRadius: 4, border: `1px solid ${$.border}`,
            }}>
              📶 Sorted by RSSI
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
            {order.length === 0 ? (
              <div style={{
                border: `1px dashed ${$.border}`, borderRadius: 12,
                padding: "28px 16px", textAlign: "center",
                color: $.textMute, fontSize: 14,
              }}>
                Waiting for data…
              </div>
            ) : (
              <>
                {/* Local node section */}
                {localNode && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: $.textMute,
                      textTransform: "uppercase", letterSpacing: "1px", marginBottom: 5,
                    }}>📡 Local Node (You)</div>
                    <PN
                      link={localNode}
                      name={resolveName(myNodeId)}
                      prevRssi={prevLinks[myNodeId] ? parseFloat(prevLinks[myNodeId].rssi) : undefined}
                      isSelected={false}
                      onSelect={() => {}}
                      packetCount={pktPerNode[myNodeId] || 0}
                      onRename={n => renameNode(myNodeId, n)}
                      relays={localNode.relays}
                      nodeNames={nodeNames}
                      isFlashing={myNodeId === flashId}
                    />
                  </div>
                )}

                {/* Remote nodes */}
                {remoteList.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: $.textMute,
                      textTransform: "uppercase", letterSpacing: "1px", marginBottom: 5,
                      borderTop: localNode ? `1px solid ${$.border}` : "none",
                      paddingTop: localNode ? 8 : 0,
                    }}>Remote Nodes</div>
                    {remoteList.map(id => links[id] && (
                      <PN
                        key={id}
                        link={links[id]}
                        name={resolveName(id)}
                        prevRssi={prevLinks[id] ? parseFloat(prevLinks[id].rssi) : undefined}
                        isSelected={!allPackets && focusId === id}
                        onSelect={() => {
                          if (allPackets) {
                            setAllPackets(false);
                            setFocusId(id);
                          } else {
                            setFocusId(focusId === id ? null : id);
                          }
                          setBaseline(null);
                        }}
                        packetCount={pktPerNode[id] || 0}
                        onRename={n => renameNode(id, n)}
                        relays={links[id].relays}
                        nodeNames={nodeNames}
                        isFlashing={id === flashId}
                        onTrace={() => setTraceNode({ id, name: resolveName(id) })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* CHART */}
        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          background: $.surface, border: `1px solid ${$.border}`,
          borderRadius: 14, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexShrink: 0 }}>
            <AN>Signal dynamics</AN>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {[{ color: $.blue, label: "RSSI" }, { color: $.green, label: "SNR", dashed: true }].map(({ color, label, dashed }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: $.textSec }}>
                  <div style={{
                    width: 20, height: 2,
                    background: dashed
                      ? `repeating-linear-gradient(90deg,${color} 0 4px,transparent 4px 7px)`
                      : color,
                  }} />
                  {label}
                </div>
              ))}
              <div style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 6,
                background: `${$.green}15`, color: $.green,
                border: `1px solid ${$.green}40`, fontWeight: 600,
              }}>
                Good ≥ −80 dBm
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={focusHistory} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={$.border} vertical={false} />
                <XAxis dataKey="time" stroke={$.border} tick={{ fontSize: 11, fill: $.textSec }} tickMargin={8} />
                <YAxis yAxisId="rssi" domain={[-125, -40]} stroke={$.border} tick={{ fontSize: 11, fill: $.textSec }} />
                <YAxis yAxisId="snr" orientation="right" domain={[-20, 20]} stroke={$.border} tick={{ fontSize: 11, fill: $.textSec }} />
                <Tooltip content={<CustomTooltip />} />
                {baseline && (
                  <ReferenceLine yAxisId="rssi" y={baseline.rssi} stroke={$.amber} strokeDasharray="3 3" strokeWidth={1}
                    label={{ value: "Baseline", fill: $.amber, fontSize: 10, position: "insideTopRight" }} />
                )}
                <ReferenceLine yAxisId="rssi" y={-80} stroke={$.green} strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: "Good", fill: $.green, fontSize: 11, position: "insideTopRight" }} />
                <Line yAxisId="rssi" type="monotone" dataKey="rssi" name="RSSI"
                  stroke={$.blue} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line yAxisId="snr" type="monotone" dataKey="snr" name="SNR"
                  stroke={$.green} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── LOG ── */}
      <div style={{
        background: $.surface, border: `1px solid ${$.border}`,
        borderRadius: 12, padding: "12px 18px", flexShrink: 0,
      }}>
        <AN>Raw telemetry log</AN>
        <div style={{ height: 90, overflowY: "auto", fontFamily: "monospace", fontSize: 12, color: $.textPri }}>
          {log.length === 0 && <div style={{ color: $.textMute, padding: "4px 0" }}>No data yet…</div>}
          {log.map((entry, i) => (
            <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${$.border}`, lineHeight: 1.6 }}>
              <span style={{ color: $.textMute }}>{entry.split("·")[0]}</span>
              {entry.split("·").slice(1).map((part, j) => (
                <span key={j}>
                  <span style={{ color: $.textMute }}> · </span>
                  <span style={{ color: $.textPri }}>{part.trim()}</span>
                </span>
              ))}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {traceNode && links[traceNode.id] && (
        <TraceModal
          nodeId={traceNode.id}
          nodeName={traceNode.name}
          link={links[traceNode.id]}
          nodeNames={nodeNames}
          onClose={() => setTraceNode(null)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        input { color-scheme: dark; }
        @keyframes flashCard { 0%{background:${$.blue}20} 100%{background:transparent} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 4px; }
        html, body, #root { margin:0; padding:0; height:100%; overflow:hidden; background:${$.bg}; }
        .ctrl-btn { transition: all 0.2s ease; }
        .ctrl-btn:hover { filter: brightness(1.05); }
      `}</style>
    </div>
  );
}
