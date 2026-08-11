import "./styles.css";
import { initializeLanguage, localizeCoreMessage, t, type TranslationKey } from "./i18n";
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
  const names: Record<string, TranslationKey> = {
    freestyle: "strokeFreestyle",
    backstroke: "strokeBackstroke",
    breaststroke: "strokeBreaststroke",
    butterfly: "strokeButterfly",
    drill: "strokeDrill",
    mixed: "strokeMixed",
    unknown: "strokeUnknown",
  };
  const key = names[stroke];
  return key ? t(key) : stroke;
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
  const sourceStatus = fitDocument?.sourceIntegrity ? t("crcOk") : t("crcProblem");
  const poolUnit = view.poolUnit === "ярд" ? t("yards") : t("meters");
  elements.summaryCards.innerHTML = `
    <div class="summary-card"><span>${t("summaryDistance")}</span><strong>${numberValue(view.session, "totalDistance")} <small>${t("meters")}</small></strong></div>
    <div class="summary-card"><span>${t("summaryActiveLengths")}</span><strong>${activeCount}</strong></div>
    <div class="summary-card"><span>${t("summaryTimerTime")}</span><strong>${formatLongDuration(numberValue(view.session, "totalTimerTime"))}</strong></div>
    <div class="summary-card"><span>${t("summaryPool")}</span><strong>${view.poolLength} <small>${poolUnit}</small></strong></div>
    <div class="summary-card integrity"><span>${t("summarySourceFile")}</span><strong>${sourceStatus}</strong></div>
  `;
}

function rowHtml(row: SwimLengthRow, groupLapNumber: number | null, poolLength: number): string {
  const selected = selectedIds.has(row.id);
  const swolf = row.type === "active" && row.strokes > 0 ? Math.round(row.time + row.strokes) : null;
  const rowLabel = row.type === "idle"
    ? t("rest")
    : `${groupLapNumber}.${row.positionInLap + 1}`;
  return `
    <tr class="length-row ${row.type} ${selected ? "selected" : ""} ${row.suspicious ? "suspicious" : ""}" data-row-id="${row.id}">
      <td class="check-column">${row.type === "active"
        ? `<input type="checkbox" aria-label="${escapeHtml(t("selectLength", { label: rowLabel }))}" ${selected ? "checked" : ""} />`
        : ""}</td>
      <td><span class="row-number">${rowLabel}</span></td>
      <td>${row.type === "active" ? `<span class="stroke-pill">${escapeHtml(translateStroke(row.stroke))}</span>` : "—"}</td>
      <td class="pace">${formatDuration(row.time)}</td>
      <td class="pace">${formatPace(row, poolLength)}</td>
      <td>${row.type === "active" && row.strokes > 0 ? row.strokes : "—"}</td>
      <td>${swolf ?? "—"}</td>
      <td>${row.suspicious ? `<span class="warning-tag">${t("shortTag")}</span>` : ""}</td>
    </tr>`;
}

function renderRows(view: SwimView): void {
  elements.lengthRows.innerHTML = view.groups.map((group) => {
    const totalTime = group.rows.reduce((total, row) => total + row.time, 0);
    const groupInfo = group.active
      ? `${group.rows.length} ${t("lengthsAbbr")} · ${group.rows.length * view.poolLength} ${t("meters")} · ${formatDuration(totalTime)}`
      : formatDuration(totalTime);
    const groupLabel = group.active ? `${t("interval")} ${group.lapNumber}` : t("rest");
    return `
      <tr class="group-row"><td colspan="8">${groupLabel}<span>${groupInfo}</span></td></tr>
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
    elements.selectionTitle.textContent = t("selectionWillMerge", { count: preview.selected.length });
    elements.selectionDetails.textContent = t("selectionDistance", {
      oldDistance: preview.oldDistance,
      newDistance: preview.newDistance,
      time: formatDuration(preview.newTime),
      removedDistance: preview.removedDistance,
    });
  } else if (preview.selected.length > 0) {
    elements.selectionTitle.textContent = t("selectionSelected", { count: preview.selected.length });
    elements.selectionDetails.textContent = preview.reason
      ? localizeCoreMessage(preview.reason)
      : t("changeSelection");
  } else {
    elements.selectionTitle.textContent = t("selectAtLeastTwo");
    elements.selectionDetails.textContent = t("adjacentSameInterval");
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
    showToast(t("errorFitExtension"), true);
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
    showToast(warnings ? t("fileOpenedWarnings", { count: warnings }) : t("fileOpened"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showToast(localizeCoreMessage(message), true);
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
  elements.fileName.textContent = t("defaultFileName");
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
    showToast(t("mergeSuccess", { distance: preview.removedDistance }));
  } catch (error) {
    history.pop();
    const message = error instanceof Error ? error.message : String(error);
    showToast(localizeCoreMessage(message), true);
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
  showToast(t("undoSuccess"));
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
        showToast(t("suspiciousSelected"));
        return;
      }
    }
  }
  showToast(t("noSuspicious"));
});

elements.exportButton.addEventListener("click", () => {
  if (!fitDocument) return;
  try {
    const bytes = encodeFit(fitDocument);
    const validation = validateEncoded(bytes);
    if (!validation.ok) {
      showToast(t("exportStopped", { error: localizeCoreMessage(validation.errors[0]) }), true);
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
    showToast(t("fileSaved", { size: Math.round(bytes.byteLength / 1024) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showToast(localizeCoreMessage(message), true);
  }
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    elements.undoButton.click();
  }
  if (event.key === "Escape" && fitDocument && history.length === 0) resetWorkspace();
});

initializeLanguage(() => {
  elements.toast.classList.remove("visible");
  if (fitDocument) renderEditor();
  else elements.fileName.textContent = t("defaultFileName");
});
