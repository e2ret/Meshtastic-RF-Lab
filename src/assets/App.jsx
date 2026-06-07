import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ─── palette ───────────────────────────────────────────────── */
const C = {
  bg:       "#f0f2f5",
  surface:  "#ffffff",
  card:     "#ffffff",
  border:   "#dde1e9",
  blue:     "#185FA5",
  green:    "#0F6E56",
  amber:    "#854F0B",
  red:      "#991f1f",
  textPri:  "#111827",
  textSec:  "#4b5563",
  textMute: "#9ca3af",
};

/* ─── helpers ────────────────────────────────────────────────── */
function signalColor(rssi) {
  if (rssi >= -80)  return C.green;
  if (rssi >= -100) return C.amber;
  return C.red;
}
function signalLabel(rssi) {
  if (rssi >= -80)  return "GOOD";
  if (rssi >= -100) return "FAIR";
  return "WEAK";
}

/* ─── tooltip ────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.textSec,
    }}>
      <div style={{ marginBottom: 4, color: C.textPri, fontWeight: 600 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: 10 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── section label ───────────────────────────────────────────── */
const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, letterSpacing: "1px",
    textTransform: "uppercase", color: C.textMute, marginBottom: 10,
  }}>
    {children}
  </div>
);

/* ─── metric card ─────────────────────────────────────────────── */
const MetricCard = ({ label, value, unit, color }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "12px 16px", flex: 1,
  }}>
    <div style={{ fontSize: 11, color: C.textMute, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }}>
      {label}
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: color || C.textPri, lineHeight: 1 }}>
      {value}
      {unit && <span style={{ fontSize: 12, fontWeight: 400, color: C.textSec, marginLeft: 4 }}>{unit}</span>}
    </div>
  </div>
);

/* ─── node card ───────────────────────────────────────────────── */
const NodeCard = ({ link, name, selected, onClick }) => {
  const rssi      = parseFloat(link.rssi);
  const color     = signalColor(rssi);
  const label     = signalLabel(rssi);
  const trend     = link.trend;   // +n | -n | null
  const isPulsing = link.pulse;
  const maxRssi   = link.maxRssi;
  const viaNodes  = link.via;     // string or null

  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        border: `1px solid ${selected ? C.blue : C.border}`,
        borderRadius: 10, padding: "12px 14px", marginBottom: 8,
        borderLeft: `4px solid ${color}`,
        cursor: "pointer",
        animation: isPulsing ? "cardPulse 0.6s ease" : "none",
        boxShadow: selected ? `0 0 0 2px ${C.blue}30` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{name}</div>
          <div style={{ fontSize: 11, color: C.textMute, fontFamily: "monospace", marginTop: 2 }}>
            0x{link.from}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.6px",
          color, background: `${color}15`,
          padding: "2px 8px", borderRadius: 5,
          border: `1px solid ${color}40`, marginTop: 2,
        }}>
          {label}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
        {/* RSSI + trend */}
        <div>
          <div style={{ fontSize: 10, color: C.textMute, marginBottom: 2 }}>RSSI</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>
              {link.rssi}<span style={{ fontSize: 11, color: C.textSec, marginLeft: 2 }}>dBm</span>
            </div>
            {trend !== null && (
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: trend > 0 ? C.green : C.red,
              }}>
                {trend > 0 ? `↑ +${trend.toFixed(1)}` : `↓ ${trend.toFixed(1)}`}
              </span>
            )}
          </div>
        </div>

        {/* SNR */}
        <div>
          <div style={{ fontSize: 10, color: C.textMute, marginBottom: 2 }}>SNR</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>
            {link.snr}<span style={{ fontSize: 11, color: C.textSec, marginLeft: 2 }}>dB</span>
          </div>
        </div>

        {/* Max */}
        {maxRssi !== null && (
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 10, color: C.textMute, marginBottom: 2 }}>Max</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSec }}>
              {maxRssi} <span style={{ fontSize: 10, color: C.textMute }}>dBm</span>
            </div>
          </div>
        )}
      </div>

      {/* via relay path */}
      {viaNodes && (
        <div style={{
          fontSize: 11, color: C.blue, marginTop: 6,
          background: `${C.blue}08`, borderRadius: 5,
          padding: "3px 7px", display: "inline-block",
        }}>
          🔁 via {viaNodes}
        </div>
      )}

      <div style={{ fontSize: 11, color: C.textMute, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        ⏱ {link.lastSeen}
      </div>
    </div>
  );
};

/* ─── app ─────────────────────────────────────────────────────── */
export default function App() {
  const [connected,   setConnected]   = useState(false);
  const [linkOrder,   setLinkOrder]   = useState([]);
  const [links,       setLinks]       = useState({});
  const [log,         setLog]         = useState([]);
  const [history,     setHistory]     = useState([]);
  const [pktCount,    setPktCount]    = useState(0);
  const [nodeNames,   setNodeNames]   = useState({});
  const [mode,        setMode]        = useState("all");      // "all" | "single"
  const [selectedId,  setSelectedId]  = useState(null);
  const [baseline,    setBaseline]    = useState(null);       // RSSI value or null
  const [maxHold,     setMaxHold]     = useState(null);       // global max RSSI

  const logEndRef    = useRef(null);
  const nodeNamesRef = useRef({});
  nodeNamesRef.current = nodeNames;

  const resolveName = useCallback((hexId) =>
    nodeNamesRef.current[hexId]?.long ||
    nodeNamesRef.current[hexId]?.short ||
    `…${hexId.slice(-4).toUpperCase()}`, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  /* ── serial ──────────────────────────────────────────────────── */
  const connectSerial = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setConnected(true);
      const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) processLine(line.trim());
      }
    } catch { setConnected(false); }
  };

  /* ── parse line ───────────────────────────────────────────────── */
  const processLine = useCallback((l) => {
    // node info
    if (l.includes("long_name=")) {
      const idM    = l.match(/(?:node|fr)=?0x([0-9a-f]+)/i);
      const longM  = l.match(/long_name=([^\s]+)/);
      const shortM = l.match(/short_name=([^\s]+)/);
      if (idM && (longM || shortM)) {
        const id = idM[1].toLowerCase();
        setNodeNames(prev => ({
          ...prev,
          [id]: { long: longM?.[1] || prev[id]?.long, short: shortM?.[1] || prev[id]?.short },
        }));
      }
      return;
    }
    if (!l.includes("RadioIf") || !l.includes("rxSNR")) return;

    const from = l.match(/fr=0x([0-9a-f]+)/)?.[1];
    const snr  = parseFloat(l.match(/rxSNR=([-0-9.]+)/)?.[1]);
    const rssi = parseFloat(l.match(/rxRSSI=([-0-9.]+)/)?.[1]);
    if (!from || isNaN(rssi) || rssi >= 0) return;

    // via: hop_count or relay info
    const hopM = l.match(/hop_limit=(\d+)/);
    const relayM = l.match(/relay_node=0x([0-9a-f]+)/i);
    let via = null;
    if (relayM) {
      const relayId = relayM[1].toLowerCase();
      via = resolveName(relayId);
    } else if (hopM && parseInt(hopM[1]) < 6) {
      // hops used = 6 - hop_limit (default max_hops=6), if >0 then relayed
      const hopsUsed = 6 - parseInt(hopM[1]);
      if (hopsUsed > 0) via = `${hopsUsed} hop${hopsUsed > 1 ? "s" : ""}`;
    }

    const timestamp = new Date().toLocaleTimeString();
    const timeShort = timestamp.split(" ")[0] || timestamp;

    setHistory(prev => [...prev.slice(-59), { time: timeShort, rssi, snr }]);
    setPktCount(n => n + 1);

    setLog(prev => {
      const name = resolveName(from);
      return [...prev.slice(-99),
        `${timestamp}  ·  ${name}  ·  RSSI ${rssi} dBm  ·  SNR ${snr} dB`];
    });

    setMaxHold(prev => (prev === null || rssi > prev) ? rssi : prev);

    setLinkOrder(prev =>
      prev.includes(from) ? prev : [from, ...prev]
    );

    setLinks(prev => {
      const old = prev[from];
      const prevRssi = old ? parseFloat(old.rssi) : null;
      const trend = prevRssi !== null ? rssi - prevRssi : null;
      const oldMax = old?.maxRssi ?? null;
      const newMax = oldMax === null ? rssi : Math.max(oldMax, rssi);
      const improved = prevRssi !== null && rssi > prevRssi;
      return {
        ...prev,
        [from]: {
          from,
          snr:      snr.toFixed(1),
          rssi:     rssi.toFixed(0),
          lastSeen: timestamp,
          trend,
          maxRssi:  newMax.toFixed(0),
          pulse:    improved,
          via,
        },
      };
    });

    // clear pulse after animation
    setTimeout(() => {
      setLinks(prev => prev[from] ? { ...prev, [from]: { ...prev[from], pulse: false } } : prev);
    }, 700);
  }, [resolveName]);

  /* ── derived ──────────────────────────────────────────────────── */
  const displayHistory = (mode === "single" && selectedId)
    ? history  // ideally per-node history, but we keep global for simplicity
    : history;

  const lastEntry = displayHistory[displayHistory.length - 1];
  const avgRssi   = displayHistory.length
    ? (displayHistory.reduce((s, h) => s + h.rssi, 0) / displayHistory.length).toFixed(0)
    : "—";

  const visibleLinks = (mode === "single" && selectedId)
    ? linkOrder.filter(id => id === selectedId)
    : linkOrder;

  /* ── handlers ─────────────────────────────────────────────────── */
  const handleNodeClick = (id) => {
    if (mode === "single") {
      setSelectedId(prev => prev === id ? null : id);
    }
  };

  const setBaselineNow = () => {
    if (lastEntry) setBaseline(lastEntry.rssi);
  };

  const resetMax = () => {
    setMaxHold(null);
    setLinks(prev => {
      const next = { ...prev };
      for (const id in next) next[id] = { ...next[id], maxRssi: null };
      return next;
    });
  };

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div style={{
      background: C.bg, color: C.textPri,
      width: "100vw", height: "100vh",
      padding: "16px 24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column", gap: 14,
      boxSizing: "border-box",
      overflow: "hidden",
      position: "fixed",
      top: 0, left: 0,
    }}>

      {/* ── header ── */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 14, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${C.blue}15`, border: `1px solid ${C.blue}30`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>📡</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px" }}>
              Meshtastic <span style={{ color: C.blue }}>RF Lab</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMute, marginTop: 1 }}>LoRa signal monitor</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {[
              { id: "all",    label: "🌐 All Nodes" },
              { id: "single", label: "🎯 Single Node" },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => { setMode(id); if (id === "all") setSelectedId(null); }} style={{
                padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: mode === id ? C.blue : "transparent",
                color:      mode === id ? "#fff"  : C.textSec,
                transition: "background 0.2s, color 0.2s",
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Baseline button */}
          <button onClick={setBaselineNow} style={{
            background: baseline !== null ? `${C.amber}15` : C.surface,
            color: baseline !== null ? C.amber : C.textSec,
            border: `1px solid ${baseline !== null ? C.amber + "50" : C.border}`,
            padding: "7px 14px", borderRadius: 8, cursor: "pointer",
            fontSize: 13, fontWeight: 600,
          }}>
            🎯 Set baseline{baseline !== null ? ` (${baseline.toFixed(0)})` : ""}
          </button>

          {/* Max Hold reset */}
          {maxHold !== null && (
            <button onClick={resetMax} style={{
              background: `${C.green}10`, color: C.green,
              border: `1px solid ${C.green}40`,
              padding: "7px 14px", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}>
              🏆 Max: {maxHold} · Reset
            </button>
          )}

          {!connected ? (
            <button onClick={connectSerial} style={{
              background: C.blue, color: "#fff", border: "none",
              padding: "9px 22px", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 600,
            }}>
              Connect USB
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.green, fontWeight: 600 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: C.green, animation: "pulse 2s infinite",
              }} />
              Monitoring active
            </div>
          )}
        </div>
      </header>

      {/* ── metrics ── */}
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <MetricCard label="Last RSSI" value={lastEntry ? lastEntry.rssi.toFixed(0) : "—"} unit={lastEntry ? "dBm" : ""} color={lastEntry ? signalColor(lastEntry.rssi) : C.textMute} />
        <MetricCard label="Last SNR"  value={lastEntry ? lastEntry.snr.toFixed(1)  : "—"} unit={lastEntry ? "dB"  : ""} color={C.blue} />
        <MetricCard label="Avg RSSI"  value={avgRssi} unit={displayHistory.length ? "dBm" : ""} />
        <MetricCard label="Packets"   value={pktCount} />
      </div>

      {/* ── main ── */}
      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>

        {/* sidebar */}
        <div style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <SectionLabel>
            {mode === "single" && selectedId
              ? `Single: ${resolveName(selectedId)}`
              : "Active RF links"}
          </SectionLabel>
          <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
            {visibleLinks.length === 0 ? (
              <div style={{
                border: `1px dashed ${C.border}`, borderRadius: 12,
                padding: "28px 16px", textAlign: "center",
                color: C.textMute, fontSize: 14,
              }}>
                {mode === "single" && !selectedId
                  ? "Click a node in All Nodes mode first, then switch"
                  : "Waiting for data…"}
              </div>
            ) : (
              visibleLinks.map(id => links[id] && (
                <NodeCard
                  key={id}
                  link={links[id]}
                  name={resolveName(id)}
                  selected={mode === "single" && selectedId === id}
                  onClick={() => handleNodeClick(id)}
                />
              ))
            )}
          </div>
        </div>

        {/* chart */}
        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
            <SectionLabel>Signal dynamics</SectionLabel>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {[
                { color: C.blue,  label: "RSSI" },
                { color: C.green, label: "SNR", dashed: true },
              ].map(({ color, label, dashed }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec }}>
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
                background: `${C.green}15`, color: C.green,
                border: `1px solid ${C.green}40`, fontWeight: 600,
              }}>
                Good ≥ −80 dBm
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayHistory} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="time" stroke={C.border} tick={{ fontSize: 11, fill: C.textSec }} tickMargin={8} />
                <YAxis yAxisId="rssi" domain={[-125, -40]} stroke={C.border} tick={{ fontSize: 11, fill: C.textSec }} />
                <YAxis yAxisId="snr" orientation="right" domain={[-20, 20]} stroke={C.border} tick={{ fontSize: 11, fill: C.textSec }} />
                <Tooltip content={<CustomTooltip />} />
                {/* Good threshold */}
                <ReferenceLine yAxisId="rssi" y={-80} stroke={C.green} strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: "Good", fill: C.green, fontSize: 11, position: "insideTopRight" }} />
                {/* Baseline */}
                {baseline !== null && (
                  <ReferenceLine yAxisId="rssi" y={baseline} stroke={C.amber} strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: "Baseline", fill: C.amber, fontSize: 11, position: "insideBottomRight" }} />
                )}
                {/* Max hold */}
                {maxHold !== null && (
                  <ReferenceLine yAxisId="rssi" y={maxHold} stroke={C.green} strokeDasharray="2 4" strokeWidth={1}
                    label={{ value: `Max ${maxHold}`, fill: C.green, fontSize: 10, position: "insideTopLeft" }} />
                )}
                <Line yAxisId="rssi" type="monotone" dataKey="rssi" name="RSSI"
                  stroke={C.blue} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line yAxisId="snr" type="monotone" dataKey="snr" name="SNR"
                  stroke={C.green} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── log ── */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "12px 18px", flexShrink: 0,
      }}>
        <SectionLabel>Raw telemetry log</SectionLabel>
        <div style={{
          height: 90, overflowY: "auto",
          fontFamily: "monospace", fontSize: 12, color: C.textPri,
        }}>
          {log.length === 0 && (
            <div style={{ color: C.textMute, padding: "4px 0" }}>No data yet…</div>
          )}
          {log.map((entry, i) => (
            <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}`, lineHeight: 1.6 }}>
              <span style={{ color: C.textMute }}>{entry.split("·")[0]}</span>
              {entry.split("·").slice(1).map((part, j) => (
                <span key={j}>
                  <span style={{ color: C.textMute }}> · </span>
                  <span style={{ color: C.textPri }}>{part.trim()}</span>
                </span>
              ))}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes cardPulse {
          0%   { box-shadow: 0 0 0 0 ${C.green}60; }
          50%  { box-shadow: 0 0 0 8px ${C.green}00; background: ${C.green}08; }
          100% { box-shadow: 0 0 0 0 ${C.green}00; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        html, body, #root { margin:0; padding:0; height:100%; overflow:hidden; background:${C.bg}; }
      `}</style>
    </div>
  );
}
