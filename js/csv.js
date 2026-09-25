import { colombiaDay } from "./format-date.js";

const BOM = "﻿";
const SEPARATOR = ";";
const EOL = "\r\n";
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Evita que Excel ejecute el texto como fórmula (CSV injection). Los números reales no se tocan.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => csvCell(column.header)).join(SEPARATOR);
  const lines = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(SEPARATOR));
  return BOM + [header, ...lines].join(EOL);
}

export function csvFilename({ desde, hasta }, today = new Date()) {
  if (!desde && !hasta) return `ordenes_${colombiaDay(today)}.csv`;
  return `ordenes_${desde || "inicio"}_${hasta || "hoy"}.csv`;
}
