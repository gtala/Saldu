"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import {
  compactCategoryName,
  formatMoneyArs,
  heatFill,
  microCategoryName,
} from "@/lib/gastos-format";
import type { MonthCategory, MonthPayload } from "@/lib/gastos-types";

type Props = {
  month: MonthPayload | null;
  currency: "ARS" | "USD";
  ventaCripto: number | null;
  selectedCategory: string;
  onSelectCategory: (name: string) => void;
};

export function ExpensesTreemap({
  month,
  currency,
  ventaCripto,
  selectedCategory,
  onSelectCategory,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 360, h: 320, narrow: false });

  useEffect(() => {
    const onWin = () => {
      setDims((d) => ({
        ...d,
        narrow: typeof window !== "undefined" && window.innerWidth <= 640,
      }));
    };
    onWin();
    window.addEventListener("resize", onWin);
    return () => window.removeEventListener("resize", onWin);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cr = el.getBoundingClientRect();
      const w = Math.max(260, Math.floor(cr.width));
      const narrow = window.innerWidth <= 640;
      const h = narrow
        ? Math.min(400, Math.max(220, Math.floor(window.innerHeight * 0.34)))
        : Math.min(520, Math.max(300, Math.floor(window.innerHeight * 0.46)));
      setDims({ w, h, narrow });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const rootEl = hostRef.current;
    if (!rootEl || !month) return;

    const detailHint = rootEl.parentElement?.querySelector(".treemap-hint");
    if (detailHint) detailHint.remove();

    if (!month.categories || month.categories.length === 0) {
      rootEl.innerHTML =
        '<p class="g-empty text-muted-foreground p-6 text-center text-sm">No hay categorías con datos en este mes.</p>';
      return;
    }

    const cats = month.categories.filter((c: MonthCategory) => c.total > 0);
    if (cats.length === 0) {
      rootEl.innerHTML =
        '<p class="g-empty text-muted-foreground p-6 text-center text-sm">Montos en cero.</p>';
      return;
    }

    const totalCats =
      d3.sum(cats, (d) => Number(d.total || 0)) || 0;
    function pctOfTotal(v: number) {
      if (!totalCats || totalCats <= 0) return 0;
      return Math.round((Number(v || 0) / totalCats) * 100);
    }

    const maxV = d3.max(cats, (d) => d.total) || 1;
    const w = dims.w;
    const h = dims.h;

    type Root = { children: MonthCategory[] };
    const hierarchy = d3
      .hierarchy<Root | MonthCategory>({ children: cats } as Root)
      .sum((d: Root | MonthCategory) =>
        "total" in d && typeof d.total === "number" ? d.total : 0
      )
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap<Root | MonthCategory>().size([w, h]).paddingOuter(8).paddingInner(4).round(true)(
      hierarchy
    );

    const leaves = hierarchy.leaves() as d3.HierarchyRectangularNode<MonthCategory>[];

    const svg = d3
      .create("svg")
      .attr("id", "treemap-root")
      .attr("viewBox", `0 0 ${w} ${h}`)
      .attr("width", w)
      .attr("height", h)
      .attr("role", "img")
      .attr("aria-label", "Treemap de gastos por categoría");

    const g = svg
      .selectAll("g.cell")
      .data(leaves)
      .join("g")
      .attr("class", "g-cell")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `Ver detalle de ${d.data.name || "categoría"}`);

    g.append("title").text((d) => {
      const n = d.data.name || "";
      const t = formatMoneyArs(d.data.total, currency, ventaCripto);
      const p = pctOfTotal(d.data.total);
      const m = d.data.rowCount ? ` · ${d.data.rowCount} movimientos` : "";
      return `${n} — ${t} · ${p}%${m}`;
    });

    const rects = g
      .append("rect")
      .attr("class", "g-cell-rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("fill", (d) => heatFill(d.data.total, maxV))
      .attr("stroke", "rgba(255,255,255,0.1)")
      .attr("stroke-width", 1)
      .classed("is-selected", (d) => (d.data.name || "") === selectedCategory);

    g.each(function (d) {
      const cw = d.x1 - d.x0;
      const ch = d.y1 - d.y0;
      const gEl = this as SVGGElement;
      if (cw < 26 || ch < 22) return;
      const area = cw * ch;
      const pad = Math.min(12, Math.max(4, Math.min(cw, ch) * 0.07));
      const iw = Math.max(0, cw - pad * 2);
      const ih = Math.max(0, ch - pad * 2);
      const fs = Math.min(72, Math.max(6.8, Math.sqrt(area) / 4.1));
      const fsAmount = Math.max(6.6, Math.min(24, fs * 0.36));
      const fsMeta = Math.max(6.2, Math.min(14, fs * 0.25));
      const microMode = area < 3600 || iw < 54 || ih < 36;
      const compactMode = !microMode && (area < 8400 || iw < 86 || ih < 56);
      const showAmount = ih > 24 && iw > 42;
      const showMeta = ih > 72 && iw > 105;

      const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
      fo.setAttribute("x", String(pad));
      fo.setAttribute("y", String(pad));
      fo.setAttribute("width", String(iw));
      fo.setAttribute("height", String(ih));

      const box = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      box.style.width = "100%";
      box.style.height = "100%";
      box.style.overflow = "hidden";
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.justifyContent = microMode ? "center" : "flex-start";
      box.style.alignItems = microMode ? "center" : "stretch";
      box.style.boxSizing = "border-box";
      box.style.gap = microMode ? "1px" : "2px";
      box.style.fontFamily = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
      if (microMode) box.style.textAlign = "center";

      const nameEl = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      nameEl.textContent = microMode
        ? microCategoryName(d.data.name || "")
        : compactCategoryName(d.data.name || "", cw, ch);
      nameEl.style.fontWeight = "700";
      nameEl.style.fontSize = `${microMode ? Math.max(6.1, fs * 0.68) : compactMode ? Math.max(7.6, fs * 0.84) : fs}px`;
      nameEl.style.color = "rgba(255,255,255,0.96)";
      nameEl.style.lineHeight = "1";
      nameEl.style.whiteSpace = "nowrap";
      nameEl.style.overflow = "hidden";
      nameEl.style.textOverflow = "ellipsis";
      if (microMode) nameEl.style.maxWidth = "100%";
      box.appendChild(nameEl);

      if (showAmount) {
        const amtEl = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
        amtEl.textContent = microMode || compactMode
          ? `${pctOfTotal(d.data.total)}%`
          : `${formatMoneyArs(d.data.total, currency, ventaCripto)} · ${pctOfTotal(d.data.total)}%`;
        amtEl.style.fontSize = `${microMode ? Math.max(6.2, fsAmount * 0.95) : compactMode ? Math.max(7.2, fsAmount * 1.02) : fsAmount}px`;
        amtEl.style.color = "rgba(255,255,255,0.8)";
        amtEl.style.fontVariantNumeric = "tabular-nums";
        amtEl.style.whiteSpace = "nowrap";
        amtEl.style.overflow = "hidden";
        amtEl.style.textOverflow = "ellipsis";
        if (microMode) amtEl.style.maxWidth = "100%";
        box.appendChild(amtEl);
      }

      if (!microMode && !compactMode && showMeta && d.data.rowCount) {
        const movEl = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
        movEl.textContent = `${d.data.rowCount} mov.`;
        movEl.style.fontSize = `${fsMeta}px`;
        movEl.style.color = "rgba(255,255,255,0.72)";
        movEl.style.whiteSpace = "nowrap";
        movEl.style.overflow = "hidden";
        movEl.style.textOverflow = "ellipsis";
        box.appendChild(movEl);
      }

      fo.appendChild(box);
      gEl.appendChild(fo);
    });

    function selectCategory(name: string) {
      onSelectCategory(name);
      rects.classed("is-selected", (d) => (d.data.name || "") === name);
    }

    g.on("click", (_event, d) => selectCategory(d.data.name || ""));
    g.on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCategory(d.data.name || "");
      }
    });

    rootEl.innerHTML = "";
    const node = svg.node();
    if (node) rootEl.appendChild(node);

    rects.classed("is-selected", (d) => (d.data.name || "") === selectedCategory);

    if (!month.hasCategoryColumn) {
      const hint = document.createElement("p");
      hint.className =
        "treemap-hint text-muted-foreground mt-3 text-xs leading-relaxed";
      hint.innerHTML =
        "No hay columna <strong>Categoría</strong> en la planilla: todo se agrupa como una sola categoría.";
      rootEl.parentElement?.appendChild(hint);
    }
  }, [
    month,
    dims.w,
    dims.h,
    dims.narrow,
    currency,
    ventaCripto,
    selectedCategory,
    onSelectCategory,
  ]);

  if (!month) return null;

  return (
    <div ref={wrapRef} className="treemap-wrap-dashboard w-full">
      <div ref={hostRef} className="treemap-host-dashboard min-h-[240px] w-full" />
    </div>
  );
}
