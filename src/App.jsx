import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { MeshDevice } from "@meshtastic/core";
import { TransportWebSerial } from "@meshtastic/transport-web-serial";

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
  if (rssi >= -80)  return "ХОРОШО";
  if (rssi >= -100) return "СРЕДНЕ";
  return "СЛАБО";
}


/* ─── timeAgo ─────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts || ts.includes('USB')) return "";
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
const TrendBadge = ({ current: e, previous: t, unit: n, inverse: r = false }) => {
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
          <TrendBadge current={parseFloat(value)} previous={parseFloat(previous)} unit={unit} inverse={inverse} />
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
  const rssiRaw = link.rssi;
  const rssi  = rssiRaw === "—" ? -999 : parseFloat(rssiRaw);
  const color = rssi === -999 ? $.textMute : DN(rssi);
  const label = rssi === -999 ? "ЛОКАЛ" : ON(rssi);
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
                  style={{
                    fontSize: 9, background: `${$.blue}15`, border: `1px solid ${$.blue}30`,
                    borderRadius: 4, cursor: "pointer", color: $.blue,
                    padding: "1px 6px", fontWeight: 600, lineHeight: 1.4,
                  }}
                >трасс</button>
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
  {link.rssi === '—' ? '—' : <>{link.rssi}<span style={{ fontSize: 10, color: $.textSec, marginLeft: 2 }}>dBm</span></>}
            </div>
            {prevRssi != null && (
              <TrendBadge current={rssi} previous={prevRssi} unit="" />
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: $.textMute, marginBottom: 1 }}>SNR</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: $.blue }}>
{link.snr === '—' ? '—' : <>{link.snr}<span style={{ fontSize: 10, color: $.textSec, marginLeft: 2 }}>dB</span></>}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
          <span style={{ fontSize: 11, color: $.textMute, fontVariantNumeric: "tabular-nums" }}>
{link.lastSeen === 'USB подключение' ? '' : timeAgo(link.lastSeen)}
          </span>
        </div>
      </div>

      {/* Signal bar */}
      {rssi !== -999 && <NN rssi={rssi} />}

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
const TraceModal = ({ nodeId, nodeName, link, nodeNames, myNodeId, onClose, traceResult, traceStatus }) => {
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {traceStatus === "pending" && (
              <div style={{ fontSize: 12, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s infinite" }} />
                Ожидание ответа…
              </div>
            )}
            {traceStatus === "error" && (
              <div style={{ fontSize: 12, color: "#f87171" }}>Нет ответа</div>
            )}
            <button onClick={onClose} style={{
              background: "#2a2d3e", border: "none", borderRadius: 8,
              color: "#8892b0", fontSize: 18, width: 36, height: 36,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
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
          {traceStatus === "pending" || !traceResult ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              {traceStatus === "pending" ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📡</div>
                  <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>Отправляю запрос…</div>
                  <div style={{ color: "#6b7494", fontSize: 11, marginTop: 6 }}>Может занять 10–30 секунд</div>
                </>
              ) : traceStatus === "timeout" ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>⏱️</div>
                  <div style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>Нет ответа</div>
                  <div style={{ color: "#6b7494", fontSize: 11, marginTop: 6 }}>Нода недоступна или вне зоны</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>❌</div>
                  <div style={{ color: "#f87171", fontSize: 13 }}>Ошибка отправки</div>
                </>
              )}
            </div>
          ) : (
            (() => {
              // Build two-column route display from RouteDiscovery
              const toRoute   = [nodeId, ...(traceResult.route    || []).map(n => n.toString(16).padStart(8,"0"))];
              const toSnr     = traceResult.snrTowards || [];
              // routeBack = [relay1, relay2, ...] from dest back to us
              // Display: dest -> relay... -> us
              const backRelays = (traceResult.routeBack || []).map(n => n.toString(16).padStart(8,"0"));
              const backRoute  = [nodeId, ...backRelays, myNodeId || "local"];
              const backSnr    = traceResult.snrBack || [];
              const snrLabel  = (v) => v == null ? "" : `SNR: ${(v/4).toFixed(1)} dB`;
              const snrColor  = (v) => v == null ? "#6b7494" : v/4 >= 5 ? "#2dd4a0" : v/4 >= -5 ? "#f59e0b" : "#f87171";

              const RouteCol = ({ title, nodes, snrs, icon }) => (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#6b7494", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>{title}</div>
                  {nodes.map((nId, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                          background: i === 0 ? "#4da3ff20" : i === nodes.length-1 ? "#2dd4a0" + "20" : "#f59e0b20",
                          border: `2px solid ${i === 0 ? "#4da3ff" : i === nodes.length-1 ? "#2dd4a0" : "#f59e0b"}`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                        }}>
                          {i === 0 ? icon : i === nodes.length-1 ? "🖥️" : "🔁"}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e8eaf0" }}>
                            {nodeNames?.[nId] || (nId === myNodeId ? "Вы" : `0x${nId}`)}
                          </div>
                          <div style={{ fontSize: 9, color: "#6b7494", fontFamily: "monospace" }}>0x{nId}</div>
                        </div>
                      </div>
                      {i < nodes.length - 1 && (
                        <div style={{ display: "flex", alignItems: "center", marginLeft: 15 }}>
                          <div style={{ width: 2, height: 20, background: "#2a2d3e" }} />
                          <div style={{ fontSize: 10, marginLeft: 10, color: snrColor(snrs[i]) }}>
                            ↓ {snrLabel(snrs[i])}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );

              return (
                <div style={{ display: "flex", gap: 20 }}>
                  <RouteCol title="Туда" nodes={toRoute} snrs={toSnr} icon="📡" />
                  {backRoute.length > 1 && (
                    <>
                      <div style={{ width: 1, background: "#2a2d3e" }} />
                      <RouteCol title="Обратно" nodes={backRoute} snrs={backSnr} icon="🖥️" />
                    </>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};


/* ─── LocalNodeCard ───────────────────────────────────────────── */
const LocalNodeCard = ({ myNodeId, nodeNames, pktPerNode, traceResults, links }) => {
  const name = nodeNames?.[myNodeId] || `0x${myNodeId}`;
  const txCount = pktPerNode?.[myNodeId] || 0;

  // Gather best SNR data from traceroute results
  const traceEntries = Object.entries(traceResults || {});
  const bestTrace = traceEntries.reduce((best, [destId, data]) => {
    const snrs = [...(data.snrTowards || []), ...(data.snrBack || [])];
    if (!snrs.length) return best;
    const maxSnr = Math.max(...snrs.map(v => v / 4));
    return maxSnr > (best?.snr ?? -999) ? { destId, snr: maxSnr, data } : best;
  }, null);

  // From links: how others heard us (when we appear as from= in their packets)
  const myLink = links?.[myNodeId];
  const hasRssi = myLink && myLink.rssi !== "—";

  const snrColor = (v) => v >= 5 ? $.green : v >= -5 ? $.amber : $.red;

  return (
    <div style={{
      background: `${$.blue}08`,
      borderLeft: `4px solid ${$.blue}`,
      outline: `1px solid ${$.blue}30`,
      borderRadius: 8, padding: "8px 12px", marginBottom: 6,
    }}>
      {/* Name row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: $.blue }}>{name}</div>
          <div style={{ fontSize: 10, color: $.textMute, fontFamily: "monospace" }}>0x{myNodeId}</div>
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, color: $.blue,
          background: `${$.blue}15`, border: `1px solid ${$.blue}40`,
          padding: "2px 8px", borderRadius: 5,
        }}>USB</div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
        {/* TX packets */}
        <div style={{ background: $.bg, borderRadius: 6, padding: "6px 8px" }}>
          <div style={{ fontSize: 9, color: $.textMute, marginBottom: 2 }}>ОТПРАВЛЕНО</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: $.textPri }}>{txCount}
            <span style={{ fontSize: 10, color: $.textMute, marginLeft: 3 }}>пак.</span>
          </div>
        </div>

        {/* Best SNR from traceroute or actual RSSI */}
        {hasRssi ? (
          <div style={{ background: $.bg, borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: 9, color: $.textMute, marginBottom: 2 }}>RSSI (входящий)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: $.green }}>{myLink.rssi}
              <span style={{ fontSize: 10, color: $.textMute, marginLeft: 3 }}>dBm</span>
            </div>
          </div>
        ) : bestTrace ? (
          <div style={{ background: $.bg, borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: 9, color: $.textMute, marginBottom: 2 }}>SNR (трасс.)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: snrColor(bestTrace.snr) }}>
              {bestTrace.snr.toFixed(1)}
              <span style={{ fontSize: 10, color: $.textMute, marginLeft: 3 }}>dB</span>
            </div>
          </div>
        ) : (
          <div style={{ background: $.bg, borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontSize: 9, color: $.textMute, marginBottom: 2 }}>SNR (трасс.)</div>
            <div style={{ fontSize: 12, color: $.textMute, marginTop: 4 }}>нажми trace</div>
          </div>
        )}
      </div>

      {/* Traceroute SNR details */}
      {bestTrace && (
        <div style={{ fontSize: 10, color: $.textMute, background: $.bg, borderRadius: 5, padding: "4px 8px" }}>
          Лучший маршрут через{" "}
          <span style={{ color: $.textSec, fontFamily: "monospace" }}>
            {nodeNames?.[bestTrace.destId] || `0x${bestTrace.destId}`}
          </span>
          {" · SNR "}
          <span style={{ color: snrColor(bestTrace.snr), fontWeight: 600 }}>
            {bestTrace.snr.toFixed(1)} dB
          </span>
        </div>
      )}

      {!hasRssi && !bestTrace && (
        <div style={{ fontSize: 10, color: $.textMute, textAlign: "center", padding: "4px 0" }}>
          Нажми <b style={{ color: $.blue }}>трасс</b> на любой ноде для получения данных сигнала
        </div>
      )}
    </div>
  );
};

/* ─── App ─────────────────────────────────────────────────────── */
export default function App() {
  const [connected,   setConnected]   = useState(false);
  const [connecting,  setConnecting]  = useState(false);
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
  const [myNodeInfo,  setMyNodeInfo]  = useState(null); // {name, rssi, snr} from last heard
  const [focusId,     setFocusId]     = useState(null); // click node to filter chart
  const [maxRssi,     setMaxRssi]     = useState(null);
  const [flashId,     setFlashId]     = useState(null);
  const [traceNode,   setTraceNode]   = useState(null); // {id, name}
  const [traceResults, setTraceResults] = useState({});
  const [traceStatus,  setTraceStatus]  = useState({});

  // Refs for stale closure avoidance
  const focusIdRef   = useRef(focusId);
  const myNodeRef    = useRef(myNodeId);
  const nodeNamesRef = useRef(nodeNames);
  const flashTimer   = useRef(null);
  const logEndRef    = useRef(null);

  useEffect(() => { focusIdRef.current   = focusId;    }, [focusId]);
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

  /* ── device ref ─────────────────────────────────────────────── */
  const deviceRef = useRef(null);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      try { deviceRef.current?.disconnect?.(); } catch {}
    };
  }, []);

  /* ── serial via Meshtastic JS API ───────────────────────────── */
  const connectSerial = async () => {
    if (connected || deviceRef.current) return;
    setConnecting(true);
    try {
      const transport = await TransportWebSerial.create();
      const device = new MeshDevice(transport);
      deviceRef.current = device;

      // My node ID
      device.events.onMyNodeInfo.subscribe((info) => {
        if (info.myNodeNum) {
          const hexId = info.myNodeNum.toString(16).padStart(8, "0");
          setMyNodeId(hexId);
        }
      });

      // Node names from NodeInfo packets
      device.events.onNodeInfoPacket.subscribe((packet) => {
        // packet has: id (nodeNum), data.user.longName etc
        const num  = packet.data?.num ?? packet.id;
        const user = packet.data?.user;
        if (num) {
          const hexId = num.toString(16).padStart(8, "0");
          const name  = user?.longName || user?.shortName;
          if (name) setNodeNames(prev => ({ ...prev, [hexId]: name }));
        }
      });

      // Incoming RF packets with RSSI/SNR
      // onMeshPacket fires for all decoded packets with RSSI/SNR
      device.events.onMeshPacket.subscribe((packet) => {
        const rxRssi = packet.rxRssi;
        if (!rxRssi || rxRssi >= 0) return;
        const from   = packet.from?.toString(16).padStart(8, "0");
        const rssi   = rxRssi;
        const snr    = packet.rxSnr ?? 0;
        if (!from) return;

        const ts    = new Date().toLocaleTimeString();
        const tsFmt = ts.split(" ")[0] || ts;
        const hops  = packet.hopStart != null && packet.hopLimit != null
          ? packet.hopStart - packet.hopLimit : 0;

        setHistory(prev => [...prev.slice(-59), { time: tsFmt, rssi, snr, from }]);
        setPktCount(n => n + 1);
        setPktPerNode(prev => ({ ...prev, [from]: (prev[from] || 0) + 1 }));
        setLog(prev => [...prev.slice(-99),
          `${ts}  ·  ${resolveName(from)}  ·  RSSI ${rssi} dBm  ·  SNR ${snr.toFixed(2)} dB`]);

        setMaxRssi(prev => prev === null || rssi > prev ? rssi : prev);
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

        setFlashId(from);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashId(null), 500);
      });

      // Traceroute response — packet.from = destination we traced to
      device.events.onTraceRoutePacket.subscribe((packet) => {
        const data = packet.data;
        if (!data) return;
        // from = node that responded (the destination we traced)
        const destId = packet.from?.toString(16).padStart(8, "0");
        if (!destId) return;
        setTraceResults(prev => ({ ...prev, [destId]: data }));
        setTraceStatus(prev => ({ ...prev, [destId]: "done" }));
      });

      // Show connected immediately after subscriptions are set up
      setConnected(true);
      setConnecting(false);
      await device.configure();
    } catch (e) {
      console.error(e);
      setConnected(false);
      setConnecting(false);
    }
  };

  /* ── send traceroute ─────────────────────────────────────────── */
  const sendTraceroute = async (nodeId) => {
    const device = deviceRef.current;
    if (!device) return;
    const nodeNum = parseInt(nodeId, 16);
    setTraceStatus(prev => ({ ...prev, [nodeId]: "pending" }));
    // timeout — если нет ответа за 30 сек
    const timer = setTimeout(() => {
      setTraceStatus(prev => prev[nodeId] === "pending" ? { ...prev, [nodeId]: "timeout" } : prev);
    }, 30000);
    try {
      await device.traceRoute(nodeNum);
    } catch (e) {
      console.error("Traceroute error:", e);
      // error.error === 3 means NO_ROUTE / timeout from device
      const isTimeout = e?.error === 3 || e?.message?.includes("timed out");
      setTraceStatus(prev => ({ ...prev, [nodeId]: isTimeout ? "timeout" : "error" }));
      clearTimeout(timer);
    }
  };

  /* ── parse line ─────────────────────────────────────────────── */

  /* ── derived ──────────────────────────────────────────────────── */
  const focusHistory = focusId ? history.filter(h => h.from === focusId) : history;

  const sortedOrder = [...order].sort((a, b) =>
    parseFloat(links[b]?.rssi || -200) - parseFloat(links[a]?.rssi || -200)
  );
  // Local node card — show even without RSSI (connected via USB)
  const localNodeLink = myNodeId && (links[myNodeId] || {
    from: myNodeId,
    rssi: "—",
    snr: "—",
    lastSeen: "USB подключение",
    relays: [],
    hops: 0,
  });
  const localNode = localNodeLink;
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
            <div style={{ fontSize: 12, color: $.textMute, marginTop: 1 }}>Монитор LoRa сигнала v2.1</div>
          </div>
          {connected && (
            <div style={{
              marginLeft: 16, paddingLeft: 16,
              borderLeft: `1px solid ${$.border}`,
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: $.green, fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: $.green, animation: "pulse 2s infinite" }} />
                <span>Мониторинг</span>
              </div>

            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {connected ? (
            <>
              

              {/* My Node ID */}
              {false && (
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
              {focusId && (
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


            </>
          ) : connecting ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: $.amber, fontWeight: 600 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: $.amber, animation: "pulse 1s infinite" }} />
              Подключение…
            </div>
          ) : (
            <button onClick={connectSerial} style={{
              background: $.blue, color: "#fff", border: `1px solid ${$.blue}`,
              padding: "10px 22px", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 600, lineHeight: 1,
            }}>
              Подключить USB
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
          source={null}
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
            <AN>Активные RF линки</AN>
            <span style={{
              fontSize: 10, color: $.textMute, background: $.surface,
              padding: "2px 6px", borderRadius: 4, border: `1px solid ${$.border}`,
            }}>
              📶 По уровню сигнала
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
            {order.length === 0 ? (
              <div style={{
                border: `1px dashed ${$.border}`, borderRadius: 12,
                padding: "28px 16px", textAlign: "center",
                color: $.textMute, fontSize: 14,
              }}>
                Ожидание данных…
              </div>
            ) : (
              <>
                {/* Local node section */}
                {localNode && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: $.textMute,
                      textTransform: "uppercase", letterSpacing: "1px", marginBottom: 5,
                    }}>📡 Моя нода</div>
                    <LocalNodeCard
                      myNodeId={myNodeId}
                      nodeNames={nodeNames}
                      pktPerNode={pktPerNode}
                      traceResults={traceResults}
                      links={links}
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
                    }}>Удалённые ноды</div>
                    {remoteList.map(id => links[id] && (
                      <PN
                        key={id}
                        link={links[id]}
                        name={resolveName(id)}
                        prevRssi={prevLinks[id] ? parseFloat(prevLinks[id].rssi) : undefined}
                        isSelected={focusId === id}
                        onSelect={() => {
                          setFocusId(prev => prev === id ? null : id);
                          
                        }}
                        packetCount={pktPerNode[id] || 0}
                        onRename={n => renameNode(id, n)}
                        relays={links[id].relays}
                        nodeNames={nodeNames}
                        isFlashing={id === flashId}
                        onTrace={() => { setTraceNode({ id, name: resolveName(id) }); sendTraceroute(id); }}
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
            <AN>Динамика сигнала</AN>
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
                Хорошо ≥ −80 dBm
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

                <ReferenceLine yAxisId="rssi" y={-80} stroke={$.green} strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: "Хорошо", fill: $.green, fontSize: 11, position: "insideTopRight" }} />
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
        <AN>Лог телеметрии</AN>
        <div style={{ height: 90, overflowY: "auto", fontFamily: "monospace", fontSize: 12, color: $.textPri }}>
          {log.length === 0 && <div style={{ color: $.textMute, padding: "4px 0" }}>Нет данных…</div>}
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
          traceResult={traceResults[traceNode?.id]}
          traceStatus={traceStatus[traceNode?.id]}
          myNodeId={myNodeId}
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
