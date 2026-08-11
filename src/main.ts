import "./styles.css";
import {
  buildSwimView,
  cloneMessages,
  decodeFit,
  encodeFit,
  mergeLengths,
  previewMerge,
  validateEncoded,
  type FitDocument,
  type MutableMesg,
  type SwimLengthRow,
  type SwimView,
} from "./fit";

const elements = {
  emptyState: document.querySelector<HTMLElement>("#emptyState")!,
  workspace: document.querySelector<HTMLElement>("#workspace")!,
  dropZone: document.querySelector<HTMLButtonElement>("#dropZone")!,
  fileInput: document.querySelector<HTMLInputElement>("#fileInput")!,
  openAnother: document.querySelector<HTMLButtonElement>("#openAnotherButton")!,
  fileName: document.querySelector<HTMLElement>("#fileName")!,
  summaryCards: document.querySelector<HTMLElement>("#summaryCards")!,
  lengthRows: document.querySelector<HTMLTableSectionElement>("#lengthRows")!,
  selectionBar: document.querySelector<HTMLElement>("#selectionBar")!,
  selectionTitle: document.querySelector<HTMLElement>("#selectionTitle")!,
  selectionDetails: document.querySelector<HTMLElement>("#selectionDetails")!,
  mergeButton: document.querySelector<HTMLButtonElement>("#mergeButton")!,
  undoButton: document.querySelector<HTMLButtonElement>("#undoButton")!,
  exportButton: document.querySelector<HTMLButtonElement>("#exportButton")!,
  findSuspicious: document.querySelector<HTMLButtonElement>("#findSuspiciousButton")!,
  toast: document.querySelector<HTMLElement>("#toast")!,
};

let fitDocument: FitDocument | null = null;
let swimView: SwimView | null = null;
let selectedIds = new Set<string>();
let history: Array<{ messages: MutableMesg[]; revision: number }> = [];
let toastTimer: number | null = null;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberValue(message: MutableMesg, key: string, fallback = 0): number {
  const value = message[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatDuration(seconds: number, tenths = true): string {
  const safe = tenths
    ? Math.round(Math.max(0, seconds) * 10) / 10
    : Math.round(Math.max(0, seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(tenths ? 1 : 0).padStart(tenths ? 4 : 2, "0")}`;
}

function formatLongDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatPace(row: SwimLengthRow, poolLength: number): string {
  if (row.type === "idle" || poolLength <= 0) return "—";
  return formatDuration(row.time * 100 / poolLength, false);
}

function translateStroke(stroke: string): string {
  const names: Record<string, string> = {
    freestyle: "Кроль",
    backstroke: "На спине",
    breaststroke: "Брасс",
    butterfly: "Баттерфляй",
    drill: "Упражнение",
    mixed: "Смешанный",
    unknown: "Не определён",
  };
  return names[stroke] ?? stroke;
}

function showToast(message: string, error = false): void {
  if (toastTimer != null) window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 4200);
}

function renderSummary(view: SwimView): void {
  const activeCount = view.lengths.filter((length) => length.lengthType !== "idle").length;
  const sourceStatus = fitDocument?.sourceIntegrity ? "CRC корректен" : "Есть проблема с CRC";
  elements.summaryCards.innerHTML = `
    <div class="summary-card"><span>Дистанция</span><strong>${numberValue(view.session, "totalDistance")} <small>м</small></strong></div>
    <div class="summary-card"><span>Активные отрезки</span><strong>${activeCount}</strong></div>
    <div class="summary-card"><span>Время таймера</span><strong>${formatLongDuration(numberValue(view.session, "totalTimerTime"))}</strong></div>
    <div class="summary-card"><span>Бассейн</span><strong>${view.poolLength} <small>${escapeHtml(view.poolUnit)}</small></strong></div>
    <div class="summary-card integrity"><span>Исходный файл</span><strong>${sourceStatus}</strong></div>
  `;
}

function rowHtml(row: SwimLengthRow, groupLapNumber: number | null, poolLength: number): string {
  const selected = selectedIds.has(row.id);
  const swolf = row.type === "active" && row.strokes > 0 ? Math.round(row.time + row.strokes) : null;
  const rowLabel = row.type === "idle"
    ? "Отдых"
    : `${groupLapNumber}.${row.positionInLap + 1}`;
  return `
    <tr class="length-row ${row.type} ${selected ? "selected" : ""} ${row.suspicious ? "suspicious" : ""}" data-row-id="${row.id}">
      <td class="check-column">${row.type === "active"
        ? `<input type="checkbox" aria-label="Выбрать отрезок ${rowLabel}" ${selected ? "checked" : ""} />`
        : ""}</td>
      <td><span class="row-number">${rowLabel}</span></td>
      <td>${row.type === "active" ? `<span class="stroke-pill">${escapeHtml(translateStroke(row.stroke))}</span>` : "—"}</td>
      <td class="pace">${formatDuration(row.time)}</td>
      <td class="pace">${formatPace(row, poolLength)}</td>
      <td>${row.type === "active" && row.strokes > 0 ? row.strokes : "—"}</td>
      <td>${swolf ?? "—"}</td>
      <td>${row.suspicious ? '<span class="warning-tag">короткий</span>' : ""}</td>
    </tr>`;
}

function renderRows(view: SwimView): void {
  elements.lengthRows.innerHTML = view.groups.map((group) => {
    const totalTime = group.rows.reduce((total, row) => total + row.time, 0);
    const groupInfo = group.active
      ? `${group.rows.length} отр. · ${group.rows.length * view.poolLength} м · ${formatDuration(totalTime)}`
      : formatDuration(totalTime);
    return `
      <tr class="group-row"><td colspan="8">${group.label}<span>${groupInfo}</span></td></tr>
      ${group.rows.map((row) => rowHtml(row, group.lapNumber, view.poolLength)).join("")}
    `;
  }).join("");

  elements.lengthRows.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest<HTMLElement>("[data-row-id]");
      if (!row) return;
      const id = row.dataset.rowId!;
      if (checkbox.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      renderEditor();
    });
  });
}

function renderSelection(view: SwimView): void {
  const preview = previewMerge(view, selectedIds);
  elements.selectionBar.classList.toggle("valid", preview.valid);
  elements.selectionBar.classList.toggle("invalid", !preview.valid && preview.selected.length > 0);
  elements.mergeButton.disabled = !preview.valid;

  if (preview.valid) {
    elements.selectionTitle.textContent = `${preview.selected.length} отрезка станут одним`;
    elements.selectionDetails.textContent = `${preview.oldDistance} → ${preview.newDistance} м · ${formatDuration(preview.newTime)} · дистанция −${preview.removedDistance} м`;
  } else if (preview.selected.length > 0) {
    elements.selectionTitle.textContent = `${preview.selected.length} выбрано`;
    elements.selectionDetails.textContent = preview.reason ?? "Измените выбор";
  } else {
    elements.selectionTitle.textContent = "Выберите минимум два отрезка";
    elements.selectionDetails.textContent = "Они должны идти подряд внутри одного интервала";
  }
}

function renderEditor(): void {
  if (!fitDocument) return;
  swimView = buildSwimView(fitDocument);
  renderSummary(swimView);
  renderRows(swimView);
  renderSelection(swimView);
  elements.undoButton.disabled = history.length === 0;
  elements.fileName.textContent = fitDocument.fileName;
}

async function loadFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".fit")) {
    showToast("Выберите файл с расширением .fit", true);
    return;
  }
  try {
    elements.dropZone.setAttribute("disabled", "true");
    const bytes = new Uint8Array(await file.arrayBuffer());
    fitDocument = decodeFit(bytes, file.name);
    selectedIds = new Set();
    history = [];
    elements.emptyState.hidden = true;
    elements.workspace.hidden = false;
    renderEditor();
    const warnings = fitDocument.decodeErrors.length;
    showToast(warnings ? `Файл открыт с предупреждениями: ${warnings}` : "FIT-файл успешно открыт");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), true);
  } finally {
    elements.dropZone.removeAttribute("disabled");
    elements.fileInput.value = "";
  }
}

function resetWorkspace(): void {
  fitDocument = null;
  swimView = null;
  selectedIds = new Set();
  history = [];
  elements.workspace.hidden = true;
  elements.emptyState.hidden = false;
}

elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.openAnother.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => {
  const file = elements.fileInput.files?.[0];
  if (file) void loadFile(file);
});

for (const eventName of ["dragenter", "dragover"] as const) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"] as const) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
  });
}
elements.dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) void loadFile(file);
});

elements.mergeButton.addEventListener("click", () => {
  if (!fitDocument || !swimView) return;
  const preview = previewMerge(swimView, selectedIds);
  if (!preview.valid) return;
  try {
    history.push({ messages: cloneMessages(fitDocument.messages), revision: fitDocument.revision });
    mergeLengths(fitDocument, selectedIds);
    selectedIds = new Set();
    renderEditor();
    showToast(`Объединено. Дистанция уменьшена на ${preview.removedDistance} м.`);
  } catch (error) {
    history.pop();
    showToast(error instanceof Error ? error.message : String(error), true);
  }
});

elements.undoButton.addEventListener("click", () => {
  if (!fitDocument) return;
  const snapshot = history.pop();
  if (!snapshot) return;
  fitDocument.messages = snapshot.messages;
  fitDocument.revision = snapshot.revision;
  selectedIds = new Set();
  renderEditor();
  showToast("Последнее объединение отменено");
});

elements.findSuspicious.addEventListener("click", () => {
  if (!swimView) return;
  for (const group of swimView.groups) {
    for (let index = 0; index < group.rows.length - 1; index += 1) {
      const first = group.rows[index];
      const second = group.rows[index + 1];
      if (first.suspicious && second.suspicious && first.type === "active" && second.type === "active") {
        selectedIds = new Set([first.id, second.id]);
        renderEditor();
        document.querySelector(`[data-row-id="${first.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("Выбрана первая подозрительная пара — проверьте и объедините");
        return;
      }
    }
  }
  showToast("Явных коротких пар не найдено");
});

elements.exportButton.addEventListener("click", () => {
  if (!fitDocument) return;
  try {
    const bytes = encodeFit(fitDocument);
    const validation = validateEncoded(bytes);
    if (!validation.ok) {
      showToast(`Экспорт остановлен: ${validation.errors[0]}`, true);
      return;
    }
    const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fitDocument.fileName.replace(/\.fit$/i, "") + "_fixed.fit";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Файл проверен и сохранён · ${Math.round(bytes.byteLength / 1024)} КБ`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), true);
  }
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    elements.undoButton.click();
  }
  if (event.key === "Escape" && fitDocument && history.length === 0) resetWorkspace();
});
