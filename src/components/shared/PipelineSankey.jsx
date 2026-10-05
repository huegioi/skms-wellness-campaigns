import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * PipelineSankey — a three-column flow view (Source → Stage → Outcome).
 *
 * Dependency-free SVG. Every record flows through exactly one node per column,
 * so all three columns sum to the same total. Reads each record's CURRENT
 * state — the app does not keep stage history, so this is a snapshot, not a
 * history of moves.
 *
 * Props
 *   records       array of entity rows
 *   classify(r)   → { source: {key,label}, stage: {key,label}, outcome: {key,label} }
 *   stageOrder    array of stage keys in display order (unknown keys sort last)
 *   outcomes      [{ key, label, color }] — fixed order + status color per outcome
 *   metrics       [{ key, label, value(r), format(n) }] — first is default
 *   noun          { one: 'client', many: 'clients' }
 *   recordLabel(r) / recordSub(r)   — row text in the drill-down list
 *   onSelectRecord(r)               — opens the record's detail view
 */

// Categorical slots (validated reference palette, fixed order — never cycled).
const SOURCE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
const OTHER_COLOR = '#898781';
const STAGE_NODE_COLOR = '#52514e';
const MAX_SOURCES = 6;

const NODE_W = 12;
const NODE_GAP = 10;
const LABEL_ROOM = 215;

function useWidth(ref) {
  const [w, setW] = useState(900);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const cw = entries[0]?.contentRect?.width;
      if (cw) setW(cw);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function buildGraph(records, classify, stageOrder, outcomes, valueOf) {
  // 1. classify + value every record
  const rows = records.map(r => ({ r, c: classify(r), v: Math.max(0, Number(valueOf(r)) || 0) }));

  // 2. sources: rank by record count, keep top N, fold the rest into "Other"
  const srcCount = {};
  const srcLabel = {};
  for (const { c } of rows) {
    srcCount[c.source.key] = (srcCount[c.source.key] || 0) + 1;
    srcLabel[c.source.key] = c.source.label;
  }
  const ranked = Object.keys(srcCount).sort((a, b) => srcCount[b] - srcCount[a]);
  const keep = new Set(ranked.slice(0, ranked.length > MAX_SOURCES ? MAX_SOURCES - 1 : MAX_SOURCES));
  for (const row of rows) {
    if (!keep.has(row.c.source.key)) row.c = { ...row.c, source: { key: '__other__', label: 'Other' } };
  }
  const sourceKeys = ranked.filter(k => keep.has(k));
  if (rows.some(x => x.c.source.key === '__other__')) { sourceKeys.push('__other__'); srcLabel.__other__ = 'Other'; }
  const sourceColor = {};
  sourceKeys.forEach((k, i) => { sourceColor[k] = k === '__other__' ? OTHER_COLOR : SOURCE_COLORS[i]; });

  // 3. nodes per column
  const nodes = {};
  const addNode = (col, key, label, color) => {
    const id = `${col}:${key}`;
    if (!nodes[id]) nodes[id] = { id, col, key, label, color, value: 0, count: 0, records: [] };
    return nodes[id];
  };
  const links = {};
  const addLink = (a, b, srcKey, row) => {
    const id = `${a.id}→${b.id}`;
    if (!links[id]) links[id] = { id, source: a, target: b, srcKey, value: 0, count: 0, records: [] };
    links[id].value += row.v; links[id].count += 1; links[id].records.push(row.r);
  };
  const outcomeMeta = Object.fromEntries(outcomes.map(o => [o.key, o]));

  for (const row of rows) {
    const { source, stage, outcome } = row.c;
    const s = addNode(0, source.key, srcLabel[source.key] || source.label, sourceColor[source.key]);
    const t = addNode(1, stage.key, stage.label, STAGE_NODE_COLOR);
    const o = addNode(2, outcome.key, outcomeMeta[outcome.key]?.label || outcome.label, outcomeMeta[outcome.key]?.color || OTHER_COLOR);
    for (const n of [s, t, o]) { n.value += row.v; n.count += 1; n.records.push(row.r); }
    addLink(s, t, source.key, row);
    addLink(t, o, source.key, row); // keep source identity on the second hop too
  }

  // 4. order nodes in each column
  const stageIdx = k => { const i = stageOrder.indexOf(k); return i === -1 ? 999 : i; };
  const outcomeIdx = k => { const i = outcomes.findIndex(o => o.key === k); return i === -1 ? 999 : i; };
  const cols = [0, 1, 2].map(col => Object.values(nodes).filter(n => n.col === col && n.value > 0));
  cols[0].sort((a, b) => sourceKeys.indexOf(a.key) - sourceKeys.indexOf(b.key));
  cols[1].sort((a, b) => stageIdx(a.key) - stageIdx(b.key));
  cols[2].sort((a, b) => outcomeIdx(a.key) - outcomeIdx(b.key));

  return { cols, links: Object.values(links).filter(l => l.value > 0), sourceKeys, sourceColor, srcLabel };
}

function layout(graph, width, height) {
  const { cols, links } = graph;
  const total = cols[0].reduce((s, n) => s + n.value, 0);
  if (!total) return null;
  // one scale for every column (same total) — fit the busiest column
  const ky = Math.min(...cols.map(c => (height - NODE_GAP * Math.max(0, c.length - 1)) / total));
  const innerW = Math.max(200, width - LABEL_ROOM * 2);
  const colX = [LABEL_ROOM, LABEL_ROOM + innerW / 2 - NODE_W / 2, LABEL_ROOM + innerW - NODE_W];

  cols.forEach((col, ci) => {
    const used = col.reduce((s, n) => s + n.value * ky, 0) + NODE_GAP * Math.max(0, col.length - 1);
    let y = (height - used) / 2;
    for (const n of col) {
      n.x0 = colX[ci]; n.x1 = colX[ci] + NODE_W;
      n.y0 = y; n.h = Math.max(1, n.value * ky); n.y1 = y + n.h;
      y = n.y1 + NODE_GAP;
    }
  });

  // stack link bands inside each node, ordered by the far end's position (fewer crossings)
  const out = {}; const inn = {};
  for (const l of links) { (out[l.source.id] ||= []).push(l); (inn[l.target.id] ||= []).push(l); }
  for (const list of Object.values(out)) {
    list.sort((a, b) => a.target.y0 - b.target.y0 || a.srcKey.localeCompare(b.srcKey));
    let y = list[0].source.y0;
    for (const l of list) { l.w = l.value * ky; l.sy = y + l.w / 2; y += l.w; }
  }
  for (const list of Object.values(inn)) {
    list.sort((a, b) => a.source.y0 - b.source.y0 || a.srcKey.localeCompare(b.srcKey));
    let y = list[0].target.y0;
    for (const l of list) { l.ty = y + l.w / 2; y += l.w; }
  }
  return { total };
}

function linkPath(l) {
  const x0 = l.source.x1, x1 = l.target.x0, xm = (x0 + x1) / 2;
  return `M${x0},${l.sy}C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty}`;
}

export default function PipelineSankey({
  records, classify, stageOrder = [], outcomes = [], metrics, noun = { one: 'record', many: 'records' },
  recordLabel = r => r.name, recordSub, onSelectRecord, title = 'Pipeline flow', accent = '#264d44',
}) {
  const cardRef = useRef(null);
  const wrapRef = useRef(null);
  const width = Math.max(640, useWidth(cardRef));
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const metric = metrics.find(m => m.key === metricKey) || metrics[0];
  const [hover, setHover] = useState(null);   // { kind, item, x, y }
  const [focus, setFocus] = useState(null);   // node or link the user clicked
  const [showTable, setShowTable] = useState(false);

  const graph = useMemo(
    () => buildGraph(records, classify, stageOrder, outcomes, metric.value),
    [records, classify, stageOrder, outcomes, metric]
  );
  const busiest = Math.max(...graph.cols.map(c => c.length), 1);
  const height = Math.max(360, busiest * 34);
  const lay = useMemo(() => layout(graph, width, height), [graph, width, height]);

  // reset drill-down when the data or metric changes underneath it
  useEffect(() => { setFocus(null); }, [records.length, metricKey]);

  const fmt = metric.format || (n => n.toLocaleString());
  const countText = n => `${n} ${n === 1 ? noun.one : noun.many}`;
  const pct = v => (lay?.total ? Math.round((v / lay.total) * 100) : 0);

  const isLit = l => {
    const f = hover?.item || focus;
    if (!f) return true;
    if (f.col !== undefined) return l.source.id === f.id || l.target.id === f.id || (f.col === 0 && l.srcKey === f.key);
    return l.id === f.id || (l.srcKey === f.srcKey && (l.source.id === f.target.id || l.target.id === f.source.id));
  };

  const onMove = (e, kind, item) => {
    const box = wrapRef.current.getBoundingClientRect();
    setHover({ kind, item, x: e.clientX - box.left + wrapRef.current.scrollLeft, y: e.clientY - box.top });
  };

  const focusRecords = focus ? focus.records : [];
  const focusTitle = focus
    ? (focus.col !== undefined ? focus.label : `${focus.source.label} → ${focus.target.label}`)
    : null;

  if (records.length === 0) {
    return <div className="bg-white rounded-xl p-12 text-center shadow text-gray-500">No {noun.many} to show in the flow view.</div>;
  }

  return (
    <div ref={cardRef} className="bg-white rounded-xl shadow p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Where {noun.many} came from → where they sit now → how it's going. {countText(records.length)}
            {metric.key !== 'count' && lay ? ` · ${fmt(lay.total)} total` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metrics.length > 1 && (
            <div className="flex border rounded-lg overflow-hidden text-xs">
              {metrics.map(m => (
                <button key={m.key} onClick={() => setMetricKey(m.key)}
                  className={`px-2.5 py-1.5 font-medium ${metricKey === m.key ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  style={metricKey === m.key ? { background: accent } : undefined}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowTable(s => !s)} className="text-xs px-2.5 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50">
            {showTable ? 'Show chart' : 'Show as table'}
          </button>
        </div>
      </div>

      {!showTable && lay && (
        <>
          <div ref={wrapRef} className="relative overflow-x-auto" onMouseLeave={() => setHover(null)}>
            <svg width={width} height={height + 28} role="img" aria-label={`${title}: source to stage to outcome`}>
              <g fontSize="11" fill="#898781" fontWeight="600" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <text x={graph.cols[0][0]?.x1 ?? 0} y={12} textAnchor="end">Source</text>
                <text x={(graph.cols[1][0]?.x0 ?? 0) + NODE_W / 2} y={12} textAnchor="middle">Current stage</text>
                <text x={graph.cols[2][0]?.x0 ?? width} y={12}>Outcome</text>
              </g>
              <g transform="translate(0,24)">
                {/* links */}
                <g fill="none">
                  {graph.links.map(l => (
                    <path key={l.id} d={linkPath(l)} stroke={graph.sourceColor[l.srcKey]}
                      strokeWidth={Math.max(1.5, l.w)}
                      strokeOpacity={isLit(l) ? (hover?.item === l ? 0.65 : 0.38) : 0.07}
                      style={{ cursor: 'pointer', transition: 'stroke-opacity 120ms' }}
                      onMouseMove={e => onMove(e, 'link', l)}
                      onClick={() => setFocus(f => (f === l ? null : l))} />
                  ))}
                </g>
                {/* nodes */}
                {graph.cols.flat().map(n => {
                  // sources label to the left, outcomes to the right — both sit in clear space;
                  // stage labels sit over the links, so they get a white halo
                  const labelRight = n.col !== 0;
                  const lx = labelRight ? n.x1 + 6 : n.x0 - 6;
                  const dim = (hover?.item || focus) && !(hover?.item === n || focus === n);
                  return (
                    <g key={n.id} style={{ cursor: 'pointer' }}
                      onMouseMove={e => onMove(e, 'node', n)}
                      onClick={() => setFocus(f => (f === n ? null : n))}>
                      {/* generous hit target */}
                      <rect x={n.x0 - 4} y={n.y0 - 3} width={NODE_W + 8} height={n.h + 6} fill="transparent" />
                      <rect x={n.x0} y={n.y0} width={NODE_W} height={n.h} rx={3} fill={n.color}
                        stroke={focus === n ? '#0b0b0b' : 'none'} strokeWidth={1.5} />
                      <text x={lx} y={n.y0 + n.h / 2} dy="0.35em" textAnchor={labelRight ? 'start' : 'end'}
                        fontSize="12" fill={dim ? '#898781' : '#0b0b0b'}
                        stroke="#ffffff" strokeWidth={n.col === 1 ? 4 : 0} paintOrder="stroke" strokeLinejoin="round">
                        <tspan fontWeight="600">{n.label}</tspan>
                        <tspan fill="#52514e"> {metric.key === 'count' ? n.count : fmt(n.value)}</tspan>
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {hover && (
              <div className="pointer-events-none absolute z-10 bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs"
                style={{ left: Math.min(hover.x + 14, width - 230), top: Math.max(0, hover.y - 10), width: 220 }}>
                {hover.kind === 'node' ? (
                  <>
                    <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: hover.item.color }} />
                      {hover.item.label}
                    </div>
                    <div className="text-gray-600 mt-1">{countText(hover.item.count)} · {pct(hover.item.value)}% of total</div>
                    {metric.key !== 'count' && <div className="text-gray-600">{fmt(hover.item.value)}</div>}
                    <div className="text-gray-400 mt-1">Click to list them</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: graph.sourceColor[hover.item.srcKey] }} />
                      {graph.srcLabel[hover.item.srcKey]}
                    </div>
                    <div className="text-gray-700 mt-1">{hover.item.source.label} → {hover.item.target.label}</div>
                    <div className="text-gray-600">{countText(hover.item.count)}{metric.key !== 'count' ? ` · ${fmt(hover.item.value)}` : ''}</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Source legend (identity never rides on color alone — nodes are labeled too) */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
            {graph.sourceKeys.map(k => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: graph.sourceColor[k] }} />
                {graph.srcLabel[k]}
              </span>
            ))}
          </div>
          {metric.key !== 'count' && graph.links.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">No {metric.label.toLowerCase()} recorded yet for these {noun.many}.</p>
          )}
        </>
      )}
      {!showTable && !lay && (
        <p className="text-sm text-gray-500 py-10 text-center">No {metric.label.toLowerCase()} recorded yet for these {noun.many} — switch back to Count.</p>
      )}

      {/* Table view */}
      {showTable && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                <th className="py-2 pr-3">Source</th><th className="py-2 pr-3">Current stage</th><th className="py-2 pr-3">Outcome</th>
                <th className="py-2 pr-3 text-right">{noun.many[0].toUpperCase() + noun.many.slice(1)}</th>
                {metric.key !== 'count' && <th className="py-2 text-right">{metric.label}</th>}
              </tr>
            </thead>
            <tbody>
              {tableRows(records, classify, graph, stageOrder, outcomes, metric).map(row => (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3">{row.source}</td><td className="py-1.5 pr-3">{row.stage}</td><td className="py-1.5 pr-3">{row.outcome}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.count}</td>
                  {metric.key !== 'count' && <td className="py-1.5 text-right tabular-nums">{fmt(row.value)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down list */}
      {focus && !showTable && (
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">{focusTitle} · {countText(focusRecords.length)}</h3>
            <button onClick={() => setFocus(null)} className="text-xs text-gray-500 hover:text-gray-800">Clear</button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-72 overflow-y-auto">
            {focusRecords.map(r => (
              <button key={r.id} onClick={() => onSelectRecord?.(r)}
                className="text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50">
                <div className="text-sm font-medium text-gray-900 truncate">{recordLabel(r)}</div>
                {recordSub && <div className="text-xs text-gray-500 truncate">{recordSub(r)}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-3">
        Snapshot of each {noun.one}'s current stage — the app doesn't keep stage history, so this shows where things stand today, not every move along the way.
      </p>
    </div>
  );
}

function tableRows(records, classify, graph, stageOrder, outcomes, metric) {
  const map = {};
  for (const r of records) {
    const c = classify(r);
    const srcKey = graph.sourceKeys.includes(c.source.key) ? c.source.key : '__other__';
    const key = `${srcKey}|${c.stage.key}|${c.outcome.key}`;
    if (!map[key]) {
      map[key] = {
        key, srcKey, stageKey: c.stage.key, outKey: c.outcome.key,
        source: graph.srcLabel[srcKey] || c.source.label, stage: c.stage.label,
        outcome: outcomes.find(o => o.key === c.outcome.key)?.label || c.outcome.label, count: 0, value: 0,
      };
    }
    map[key].count += 1; map[key].value += Math.max(0, Number(metric.value(r)) || 0);
  }
  const si = k => { const i = stageOrder.indexOf(k); return i === -1 ? 999 : i; };
  return Object.values(map).sort((a, b) =>
    graph.sourceKeys.indexOf(a.srcKey) - graph.sourceKeys.indexOf(b.srcKey) || si(a.stageKey) - si(b.stageKey));
}
