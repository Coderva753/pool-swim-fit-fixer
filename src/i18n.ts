export type Language = "en" | "ru";

const translations = {
  en: {
    pageTitle: "PoolFix — repair incorrectly split pool lengths",
    languageSelector: "Language",
    privacy: "Runs locally · your data never leaves the browser",
    heroTitle: "Put the lost<br /><em>turn</em> back in place",
    heroLead: "Open a pool-swim activity, merge incorrectly split lengths, and download the repaired FIT file.",
    pointNoRegistration: "No sign-up",
    pointNoCloud: "No cloud upload",
    pointSourceUnchanged: "Original file stays unchanged",
    dropTitle: "Drop your FIT file here",
    dropHint: "or click to choose a file",
    dropSupport: "Pool Swimming activities are supported",
    otherFile: "Another file",
    currentWorkout: "CURRENT ACTIVITY",
    defaultFileName: "Activity.fit",
    undo: "Undo",
    download: "Download repaired FIT",
    editorTitle: "Pool lengths",
    editorLead: "Select adjacent incorrect parts within the same interval.",
    findSuspicious: "Find suspicious lengths",
    selectAtLeastTwo: "Select at least two lengths",
    adjacentSameInterval: "They must be adjacent within the same interval",
    merge: "Merge",
    columnLength: "Length",
    columnStroke: "Stroke",
    columnTime: "Time",
    columnPace: "Pace / 100 m",
    columnStrokes: "Strokes",
    footer: "PoolFix uses the official Garmin FIT SDK to read, write, and validate CRC.",
    strokeFreestyle: "Freestyle",
    strokeBackstroke: "Backstroke",
    strokeBreaststroke: "Breaststroke",
    strokeButterfly: "Butterfly",
    strokeDrill: "Drill",
    strokeMixed: "Mixed",
    strokeUnknown: "Unknown",
    summaryDistance: "Distance",
    summaryActiveLengths: "Active lengths",
    summaryTimerTime: "Timer time",
    summaryPool: "Pool",
    summarySourceFile: "Original file",
    crcOk: "CRC is valid",
    crcProblem: "CRC problem detected",
    meters: "m",
    yards: "yd",
    rest: "Rest",
    selectLength: "Select length {label}",
    shortTag: "short",
    interval: "Interval",
    lengthsAbbr: "lengths",
    selectionWillMerge: "{count} lengths will become one",
    selectionSelected: "{count} selected",
    selectionDistance: "{oldDistance} → {newDistance} m · {time} · distance −{removedDistance} m",
    changeSelection: "Change the selection",
    errorFitExtension: "Choose a file with the .fit extension",
    fileOpened: "FIT file opened successfully",
    fileOpenedWarnings: "File opened with warnings: {count}",
    mergeSuccess: "Merged. Distance reduced by {distance} m.",
    undoSuccess: "Last merge undone",
    suspiciousSelected: "The first suspicious pair is selected — review it, then merge",
    noSuspicious: "No obvious short pairs found",
    exportStopped: "Export stopped: {error}",
    fileSaved: "File validated and saved · {size} KB",
    errorInvalidHeader: "The file does not have a valid FIT header.",
    errorNoPoolSession: "No pool-swimming session was found in the file.",
    errorMultiplePoolSessions: "Only FIT files with exactly one pool-swimming session are currently supported.",
    errorMissingPoolLength: "The Session message does not contain a valid pool length.",
    errorSelectTwo: "Select at least two lengths.",
    errorMergeRest: "Rest periods cannot be merged.",
    errorSameInterval: "The lengths must be within the same interval.",
    errorAdjacent: "The selected lengths must be adjacent.",
    errorCannotMerge: "The selected lengths cannot be merged.",
    errorIntegrity: "Header, file size, or CRC validation failed.",
    errorLengthIndexes: "Length indexes are not continuous.",
  },
  ru: {
    pageTitle: "PoolFix — исправление плавательных FIT-файлов",
    languageSelector: "Язык",
    privacy: "Работает локально · данные никуда не отправляются",
    heroTitle: "Верните потерянный<br /><em>разворот</em> на место",
    heroLead: "Откройте тренировку, объедините ошибочно разбитые отрезки и скачайте исправленный FIT-файл.",
    pointNoRegistration: "Без регистрации",
    pointNoCloud: "Без загрузки в облако",
    pointSourceUnchanged: "Исходник не меняется",
    dropTitle: "Перетащите FIT-файл",
    dropHint: "или нажмите, чтобы выбрать",
    dropSupport: "Поддерживаются тренировки Lap Swimming",
    otherFile: "Другой файл",
    currentWorkout: "ТЕКУЩАЯ ТРЕНИРОВКА",
    defaultFileName: "Тренировка.fit",
    undo: "Отменить",
    download: "Скачать исправленный FIT",
    editorTitle: "Отрезки тренировки",
    editorLead: "Выберите соседние ошибочные части внутри одного интервала.",
    findSuspicious: "Найти подозрительные",
    selectAtLeastTwo: "Выберите минимум два отрезка",
    adjacentSameInterval: "Они должны идти подряд внутри одного интервала",
    merge: "Объединить",
    columnLength: "Отрезок",
    columnStroke: "Стиль",
    columnTime: "Время",
    columnPace: "Темп / 100 м",
    columnStrokes: "Гребки",
    footer: "PoolFix использует официальный Garmin FIT SDK для чтения, записи и проверки CRC.",
    strokeFreestyle: "Кроль",
    strokeBackstroke: "На спине",
    strokeBreaststroke: "Брасс",
    strokeButterfly: "Баттерфляй",
    strokeDrill: "Упражнение",
    strokeMixed: "Смешанный",
    strokeUnknown: "Не определён",
    summaryDistance: "Дистанция",
    summaryActiveLengths: "Активные отрезки",
    summaryTimerTime: "Время таймера",
    summaryPool: "Бассейн",
    summarySourceFile: "Исходный файл",
    crcOk: "CRC корректен",
    crcProblem: "Есть проблема с CRC",
    meters: "м",
    yards: "ярд",
    rest: "Отдых",
    selectLength: "Выбрать отрезок {label}",
    shortTag: "короткий",
    interval: "Интервал",
    lengthsAbbr: "отр.",
    selectionWillMerge: "{count} отрезка станут одним",
    selectionSelected: "{count} выбрано",
    selectionDistance: "{oldDistance} → {newDistance} м · {time} · дистанция −{removedDistance} м",
    changeSelection: "Измените выбор",
    errorFitExtension: "Выберите файл с расширением .fit",
    fileOpened: "FIT-файл успешно открыт",
    fileOpenedWarnings: "Файл открыт с предупреждениями: {count}",
    mergeSuccess: "Объединено. Дистанция уменьшена на {distance} м.",
    undoSuccess: "Последнее объединение отменено",
    suspiciousSelected: "Выбрана первая подозрительная пара — проверьте и объедините",
    noSuspicious: "Явных коротких пар не найдено",
    exportStopped: "Экспорт остановлен: {error}",
    fileSaved: "Файл проверен и сохранён · {size} КБ",
    errorInvalidHeader: "Файл не имеет корректного заголовка FIT.",
    errorNoPoolSession: "В файле не найдена сессия плавания в бассейне.",
    errorMultiplePoolSessions: "Пока поддерживается FIT-файл ровно с одной сессией плавания в бассейне.",
    errorMissingPoolLength: "В Session отсутствует корректная длина бассейна.",
    errorSelectTwo: "Выберите минимум два отрезка.",
    errorMergeRest: "Отдых объединять нельзя.",
    errorSameInterval: "Отрезки должны находиться внутри одного интервала.",
    errorAdjacent: "Выбранные отрезки должны идти подряд.",
    errorCannotMerge: "Невозможно объединить выбранные отрезки.",
    errorIntegrity: "Не прошла проверка заголовка, размера или CRC.",
    errorLengthIndexes: "Индексы Length не являются непрерывными.",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

function languageValue(value: string | null): Language | null {
  return value === "en" || value === "ru" ? value : null;
}

function queryLanguage(): Language | null {
  return languageValue(new URL(window.location.href).searchParams.get("lang"));
}

function readStoredLanguage(): Language | null {
  try {
    return languageValue(window.localStorage.getItem("poolfix-language"));
  } catch {
    return null;
  }
}

function rememberLanguage(language: Language): void {
  try {
    window.localStorage.setItem("poolfix-language", language);
  } catch {
    // Local storage can be unavailable when the standalone HTML is opened from disk.
  }
}

let currentLanguage: Language = queryLanguage()
  ?? readStoredLanguage()
  ?? (navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en");

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
  let result: string = translations[currentLanguage][key];
  for (const [name, value] of Object.entries(values)) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result;
}

function applyStaticTranslations(): void {
  document.documentElement.lang = currentLanguage;
  document.title = t("pageTitle");
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n as TranslationKey);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml as TranslationKey);
  });

  const switcher = document.querySelector<HTMLElement>("#languageSwitch");
  const englishButton = document.querySelector<HTMLButtonElement>("#langEnButton");
  const russianButton = document.querySelector<HTMLButtonElement>("#langRuButton");
  switcher?.setAttribute("aria-label", t("languageSelector"));
  englishButton?.setAttribute("aria-pressed", String(currentLanguage === "en"));
  russianButton?.setAttribute("aria-pressed", String(currentLanguage === "ru"));
}

export function initializeLanguage(onChange: () => void): void {
  const selectLanguage = (language: Language) => {
    if (language === currentLanguage) return;
    currentLanguage = language;
    rememberLanguage(language);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState(null, "", url);
    applyStaticTranslations();
    onChange();
  };

  document.querySelector<HTMLButtonElement>("#langEnButton")
    ?.addEventListener("click", () => selectLanguage("en"));
  document.querySelector<HTMLButtonElement>("#langRuButton")
    ?.addEventListener("click", () => selectLanguage("ru"));

  if (queryLanguage()) rememberLanguage(currentLanguage);
  applyStaticTranslations();
}

const coreMessageKeys: Record<string, TranslationKey> = {
  "Файл не имеет корректного заголовка FIT.": "errorInvalidHeader",
  "В файле не найдена сессия плавания в бассейне.": "errorNoPoolSession",
  "Пока поддерживается FIT-файл ровно с одной сессией плавания в бассейне.": "errorMultiplePoolSessions",
  "В Session отсутствует корректная длина бассейна.": "errorMissingPoolLength",
  "Выберите минимум два отрезка.": "errorSelectTwo",
  "Отдых объединять нельзя.": "errorMergeRest",
  "Отрезки должны находиться внутри одного интервала.": "errorSameInterval",
  "Выбранные отрезки должны идти подряд.": "errorAdjacent",
  "Невозможно объединить выбранные отрезки.": "errorCannotMerge",
  "Не прошла проверка заголовка, размера или CRC.": "errorIntegrity",
  "Индексы Length не являются непрерывными.": "errorLengthIndexes",
};

export function localizeCoreMessage(message: string): string {
  const key = coreMessageKeys[message];
  if (key) return t(key);
  if (currentLanguage === "ru") return message;

  const sessionDistance = message.match(/^Session\.totalDistance=(.+), ожидалось (.+)\.$/);
  if (sessionDistance) {
    return `Session.totalDistance=${sessionDistance[1]}, expected ${sessionDistance[2]}.`;
  }
  const lapDistance = message.match(/^Сумма дистанций Lap=(.+), Session=(.+)\.$/);
  if (lapDistance) {
    return `Sum of Lap distances=${lapDistance[1]}, Session=${lapDistance[2]}.`;
  }
  return message;
}
