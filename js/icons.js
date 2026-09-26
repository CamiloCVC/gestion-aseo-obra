import { createIcons, Eye, Pencil, Trash2, CheckCircle2, History, Camera, ChevronRight, Download, X, RotateCcw } from "https://cdn.jsdelivr.net/npm/lucide@1.47.0/+esm";

const ICONS = { Eye, Pencil, Trash2, CheckCircle2, History, Camera, ChevronRight, Download, X, RotateCcw };

export function renderIcons() {
  createIcons({ icons: ICONS, attrs: { "stroke-width": 1.75 } });
}
