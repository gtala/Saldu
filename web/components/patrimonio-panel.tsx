"use client";

import * as d3 from "d3";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtArs, fmtUsd } from "@/lib/gastos-format";
import type { PatrimonioData, PatrimonioSnapshot } from "@/lib/gastos-types";

const HIDDEN = "••••••";

function mask(value: string, hidden: boolean) {
  return hidden ? HIDDEN : value;
}

function snapshotKey(d: PatrimonioSnapshot) {
  return `${d.fecha}|${d.fechaSort}`;
}

function rowDate(d: PatrimonioSnapshot): Date {
  if (d.fechaSort) return new Date(d.fechaSort);
  const x = Date.parse(d.fecha);
  return Number.isNaN(x) ? new Date() : new Date(x);
}

function DetailCard({
  snap,
  onClose,
  isHidden,
}: {
  snap: PatrimonioSnapshot;
  onClose: () => void;
  isHidden: boolean;
}) {
  const refs: string[] = [];
  if (!isHidden) {
    if (Number(snap.btcCantidad || 0) > 0)
      refs.push(
        `BTC cantidad: ${Number(snap.btcCantidad).toLocaleString("es-AR", { maximumFractionDigits: 8 })}`
      );
    if (Number(snap.btcSpot || 0) > 0)
      refs.push(`BTC precio snapshot: ${fmtUsd(snap.btcSpot)}`);
    if (Number(snap.autoArs || 0) > 0)
      refs.push(`Auto ARS (referencia): ${fmtArs(snap.autoArs)}`);
  }

  const v = (val: number) => mask(fmtUsd(val), isHidden);

  return (
    <div className="patrimonio-detail">
      <div className="patrimonio-detail-head">
        <div>
          <div className="patrimonio-detail-title">
            Composición snapshot {snap.fecha}
          </div>
          <div className="patrimonio-detail-meta">
            Desglose de activos y pasivos
          </div>
        </div>
        <button
          type="button"
          className="patrimonio-detail-close"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
      <div className="patrimonio-detail-grid">
        <div className="patrimonio-kv">
          <span className="k">Neto USD</span>
          <strong className="v">{v(snap.netoUsd ?? 0)}</strong>
        </div>
        <div className="patrimonio-kv">
          <span className="k">USD líquido</span>
          <span className="v">{v(snap.usdLiquido ?? 0)}</span>
        </div>
        <div className="patrimonio-kv">
          <span className="k">BTC valor USD</span>
          <span className="v">{v(snap.btcValorUsd ?? 0)}</span>
        </div>
        <div className="patrimonio-kv">
          <span className="k">Auto USD</span>
          <span className="v">{v(snap.autoUsd ?? 0)}</span>
        </div>
        <div className="patrimonio-kv">
          <span className="k">NEXO + stable</span>
          <span className="v">{v(snap.nexoUsd ?? 0)}</span>
        </div>
        <div className="patrimonio-kv">
          <span className="k">Deuda USD (resta)</span>
          <span className="v">- {v(snap.deudaUsd ?? 0)}</span>
        </div>
      </div>
      {snap.notas?.trim() ? (
        <div className="patrimonio-detail-note">
          <strong>Notas:</strong> {isHidden ? HIDDEN : snap.notas.trim()}
        </div>
      ) : null}
      {refs.length > 0 ? (
        <div className="patrimonio-detail-ref">
          <strong>Referencia:</strong> {refs.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

export function PatrimonioPanel({ data }: { data: PatrimonioData }) {
  const chartHostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [isHidden, setIsHidden] = useState(true);

  const { snapshots = [], error } = data;

  // restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("selectedSnapshotKey") || "";
      setSelectedKey(saved);
      const h = localStorage.getItem("patrimonioHidden");
      setIsHidden(h !== "false");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHidden = useCallback(() => {
    setIsHidden((prev) => {
      const next = !prev;
      try { localStorage.setItem("patrimonioHidden", String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(key);
    try {
      if (key) localStorage.setItem("selectedSnapshotKey", key);
      else localStorage.removeItem("selectedSnapshotKey");
    } catch {
      /* ignore */
    }
  }, []);

  const handleClose = useCallback(() => {
    handleSelect("");
  }, [handleSelect]);

  // auto-select last snapshot on mount when nothing is saved
  useEffect(() => {
    if (snapshots.length === 0) return;
    const last = snapshots[snapshots.length - 1];
    const lastKey = snapshotKey(last);
    setSelectedKey((prev) => {
      if (prev && snapshots.some((s) => snapshotKey(s) === prev)) return prev;
      return lastKey;
    });
  }, [snapshots]);

  // D3 chart
  useEffect(() => {
    const host = chartHostRef.current;
    const wrap = wrapRef.current;
    if (!host || !wrap || snapshots.length === 0) return;

    host.innerHTML = "";

    const chartW = Math.max(280, wrap.clientWidth - 32);
    const margin = { top: 10, right: 12, bottom: 34, left: 52 };
    const innerW = chartW - margin.left - margin.right;
    const innerH = 200;
    const h = innerH + margin.top + margin.bottom;

    const dates = snapshots.map(rowDate);
    let x0 = d3.min(dates) as Date;
    let x1 = d3.max(dates) as Date;
    if (x0.getTime() === x1.getTime()) {
      x0 = d3.timeDay.offset(x0, -10);
      x1 = d3.timeDay.offset(x1, 10);
    }

    const yMax = d3.max(snapshots, (d) => d.netoUsd) || 1;
    const yMin = Math.min(0, d3.min(snapshots, (d) => d.netoUsd) ?? 0);

    const xScale = d3.scaleTime().domain([x0, x1]).range([0, innerW]);
    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax * 1.08])
      .nice()
      .range([innerH, 0]);

    const line = d3
      .line<PatrimonioSnapshot>()
      .x((d) => xScale(rowDate(d)))
      .y((d) => yScale(d.netoUsd))
      .curve(d3.curveMonotoneX);

    const svg = d3
      .create("svg")
      .attr("viewBox", `0 0 ${chartW} ${h}`)
      .attr("width", chartW)
      .attr("height", h);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("class", "patrimonio-axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(Math.min(6, snapshots.length + 2))
          .tickFormat((v) => d3.timeFormat("%d/%m/%y")(v as Date))
      );

    g.append("g")
      .attr("class", "patrimonio-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((v) => `${((v as number) / 1000).toFixed(0)}k`)
      );

    g.append("path")
      .datum(snapshots)
      .attr("class", "patrimonio-line")
      .attr("d", line);

    g.selectAll<SVGCircleElement, PatrimonioSnapshot>("circle.pt")
      .data(snapshots)
      .join("circle")
      .attr("class", (d) => {
        const key = snapshotKey(d);
        return `patrimonio-dot${key === selectedKey ? " is-selected" : ""}`;
      })
      .attr("r", 5)
      .attr("cx", (d) => xScale(rowDate(d)))
      .attr("cy", (d) => yScale(d.netoUsd))
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `Snapshot ${d.fecha}, neto ${fmtUsd(d.netoUsd ?? 0)}`)
      .attr("data-snapshot-key", (d) => snapshotKey(d))
      .on("click", (_event, d) => handleSelect(snapshotKey(d)))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect(snapshotKey(d));
        }
      });

    host.appendChild(svg.node()!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, selectedKey]);

  // error / empty states
  if (error === "sin_pestana_patrimonio" && snapshots.length === 0) {
    return (
      <section className="patrimonio-panel" aria-label="Patrimonio">
        <h2>Patrimonio</h2>
        <p className="pat-sub">
          No se encontró la pestaña <strong>Patrimonio</strong> en la planilla.
          Creala con el script o a mano para ver la evolución.
        </p>
      </section>
    );
  }

  if (error && snapshots.length === 0) {
    return (
      <section className="patrimonio-panel" aria-label="Patrimonio">
        <h2>Patrimonio</h2>
        <p className="pat-sub">{error}</p>
      </section>
    );
  }

  if (snapshots.length === 0) {
    return (
      <section className="patrimonio-panel" aria-label="Patrimonio">
        <h2>Patrimonio</h2>
        <p className="pat-sub">
          Todavía no hay filas de snapshot en la pestaña Patrimonio.
        </p>
      </section>
    );
  }

  const last = snapshots[snapshots.length - 1];
  const selectedSnap = snapshots.find((s) => snapshotKey(s) === selectedKey) ?? null;
  const reversedSnaps = [...snapshots].reverse();

  const v = (val: number) => mask(fmtUsd(val), isHidden);

  return (
    <section
      className={`patrimonio-panel${isHidden ? " is-values-hidden" : ""}`}
      aria-label="Patrimonio en USD"
      ref={wrapRef}
    >
      <div className="patrimonio-panel-header">
        <h2>Patrimonio (USD)</h2>
        <button
          type="button"
          className="patrimonio-eye-btn"
          onClick={toggleHidden}
          aria-label={isHidden ? "Mostrar valores" : "Ocultar valores"}
          title={isHidden ? "Mostrar valores" : "Ocultar valores"}
        >
          {isHidden ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>
      <p className="pat-sub">
        Datos de la pestaña <strong>Patrimonio</strong>. El gráfico muestra el{" "}
        <strong>patrimonio neto</strong> por fecha de snapshot; hacé click en un
        punto para ver la composición.
      </p>
      <div className="patrimonio-latest">
        Último snapshot ({last.fecha}):{" "}
        <strong>{v(last.netoUsd ?? 0)}</strong> neto
      </div>
      <div className="patrimonio-chart-wrap">
        <div ref={chartHostRef} />
      </div>
      {selectedSnap ? (
        <DetailCard snap={selectedSnap} onClose={handleClose} isHidden={isHidden} />
      ) : null}
      <div className="patrimonio-table-wrap">
        <table className="patrimonio-table" aria-label="Historial de snapshots">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Neto USD</th>
              <th>USD líq.</th>
              <th>BTC USD</th>
              <th>Auto USD</th>
              <th>NEXO</th>
              <th>Deuda</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {reversedSnaps.map((d) => {
              const key = snapshotKey(d);
              const note = d.notas || "";
              return (
                <tr
                  key={key}
                  className={`pat-row${key === selectedKey ? " is-selected" : ""}`}
                  onClick={() => handleSelect(key)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{d.fecha}</td>
                  <td>{v(d.netoUsd ?? 0)}</td>
                  <td>{v(d.usdLiquido ?? 0)}</td>
                  <td>{v(d.btcValorUsd ?? 0)}</td>
                  <td>{v(d.autoUsd ?? 0)}</td>
                  <td>{v(d.nexoUsd ?? 0)}</td>
                  <td>{v(d.deudaUsd ?? 0)}</td>
                  <td className="note" title={isHidden ? "" : note}>
                    {isHidden ? HIDDEN : (note.length > 80 ? `${note.slice(0, 80)}…` : note)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
