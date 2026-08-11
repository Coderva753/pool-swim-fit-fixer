import {
  Decoder,
  Encoder,
  Profile,
  Stream,
  Utils,
  type FieldDescription,
  type Mesg,
  type MesgDefinition,
} from "@garmin/fitsdk";

export type MutableMesg = Mesg & Record<string, unknown> & { mesgNum: number };

export interface FitDocument {
  fileName: string;
  sourceSize: number;
  sourceIntegrity: boolean;
  profileVersion: { major: number; minor: number };
  messages: MutableMesg[];
  definitions: MesgDefinition[];
  fieldDescriptions: Record<number, FieldDescription>;
  decodeErrors: Error[];
  revision: number;
}

export interface SwimLengthRow {
  id: string;
  message: MutableMesg;
  lap: MutableMesg;
  lapNumber: number;
  positionInLap: number;
  globalPosition: number;
  index: number;
  type: "active" | "idle";
  time: number;
  strokes: number;
  cadence: number;
  stroke: string;
  suspicious: boolean;
}

export interface SwimLapGroup {
  lap: MutableMesg;
  label: string;
  lapNumber: number | null;
  rows: SwimLengthRow[];
  active: boolean;
}

export interface SwimView {
  session: MutableMesg;
  poolLength: number;
  poolUnit: string;
  lengths: MutableMesg[];
  laps: MutableMesg[];
  rows: SwimLengthRow[];
  groups: SwimLapGroup[];
}

export interface MergePreview {
  valid: boolean;
  reason?: string;
  selected: SwimLengthRow[];
  oldDistance: number;
  newDistance: number;
  oldTime: number;
  newTime: number;
  removedDistance: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  size: number;
}

const MESG_NUM = {
  session: Profile.MesgNum.SESSION,
  lap: Profile.MesgNum.LAP,
  length: Profile.MesgNum.LENGTH,
  record: Profile.MesgNum.RECORD,
} as const;

function freshBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function numberValue(message: MutableMesg, key: string, fallback = 0): number {
  const value = message[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function dateValue(message: MutableMesg, key: string): Date | null {
  const value = message[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function sum(messages: MutableMesg[], key: string): number {
  return messages.reduce((total, message) => total + numberValue(message, key), 0);
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function hasOwn(message: MutableMesg, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(message, key);
}

/** Add fields from a newer/private FIT profile so the official encoder can preserve them. */
export function registerMessageDefinition(definition: MesgDefinition): void {
  const profile = Profile as unknown as {
    messages: Record<number, {
      num: number;
      name: string;
      messagesKey: string;
      fields: Record<number, Record<string, unknown>>;
    }>;
  };
  const messageNumber = definition.globalMessageNumber;
  let messageProfile = profile.messages[messageNumber];

  if (messageProfile == null) {
    messageProfile = {
      num: messageNumber,
      name: `mesg${messageNumber}`,
      messagesKey: `mesg${messageNumber}Mesgs`,
      fields: {},
    };
    profile.messages[messageNumber] = messageProfile;
  }

  for (const field of definition.fieldDefinitions) {
    if (messageProfile.fields[field.fieldDefinitionNumber] != null) continue;
    const type = (Utils.BaseTypeToFieldType as Record<number, string>)[field.baseType];
    messageProfile.fields[field.fieldDefinitionNumber] = {
      num: field.fieldDefinitionNumber,
      name: `field${field.fieldDefinitionNumber}`,
      type,
      baseType: type,
      array: field.size / field.baseTypeSize > 1,
      scale: 1,
      offset: 0,
      units: "",
      bits: [],
      components: [],
      isAccumulated: false,
      hasComponents: false,
      subFields: [],
    };
  }
}

export function decodeFit(bytes: Uint8Array, fileName: string): FitDocument {
  const sourceIntegrity = new Decoder(Stream.fromArrayBuffer(freshBuffer(bytes))).checkIntegrity();
  const messages: MutableMesg[] = [];
  const definitions: MesgDefinition[] = [];
  const fieldDescriptions: Record<number, FieldDescription> = {};
  const decoder = new Decoder(Stream.fromArrayBuffer(freshBuffer(bytes)));

  if (!decoder.isFIT()) throw new Error("Файл не имеет корректного заголовка FIT.");

  const result = decoder.read({
    expandComponents: false,
    expandSubFields: false,
    mergeHeartRates: false,
    includeUnknownData: false,
    mesgDefinitionListener: (definition) => {
      registerMessageDefinition(definition);
      definitions.push(definition);
    },
    fieldDescriptionListener: (key, developerDataIdMesg, fieldDescriptionMesg) => {
      fieldDescriptions[key] = { developerDataIdMesg, fieldDescriptionMesg };
    },
    mesgListener: (mesgNum, message) => {
      messages.push(Object.assign(message, { mesgNum }) as MutableMesg);
    },
  });

  const document: FitDocument = {
    fileName,
    sourceSize: bytes.byteLength,
    sourceIntegrity,
    profileVersion: result.profileVersion,
    messages,
    definitions,
    fieldDescriptions,
    decodeErrors: result.errors,
    revision: 0,
  };

  // Fail early: this MVP edits one pool-swimming session at a time.
  buildSwimView(document);
  return document;
}

function messageIndex(message: MutableMesg): number {
  return numberValue(message, "messageIndex", Number.MAX_SAFE_INTEGER);
}

function lengthType(message: MutableMesg): "active" | "idle" {
  return message.lengthType === "idle" ? "idle" : "active";
}

function lapLengths(lap: MutableMesg, lengthsByIndex: Map<number, MutableMesg>): MutableMesg[] {
  const first = numberValue(lap, "firstLengthIndex", -1);
  const count = numberValue(lap, "numLengths", 0);
  if (first < 0) return [];

  if (count > 0) {
    return Array.from({ length: count }, (_, offset) => lengthsByIndex.get(first + offset))
      .filter((length): length is MutableMesg => length != null);
  }

  const possibleIdle = lengthsByIndex.get(first);
  return possibleIdle && lengthType(possibleIdle) === "idle" ? [possibleIdle] : [];
}

export function buildSwimView(document: FitDocument): SwimView {
  const sessions = document.messages.filter((message) => message.mesgNum === MESG_NUM.session);
  const poolSessions = sessions.filter((message) =>
    message.sport === "swimming" && message.subSport === "lapSwimming");

  if (poolSessions.length !== 1) {
    throw new Error(poolSessions.length === 0
      ? "В файле не найдена сессия плавания в бассейне."
      : "Пока поддерживается FIT-файл ровно с одной сессией плавания в бассейне.");
  }

  const session = poolSessions[0];
  const poolLength = numberValue(session, "poolLength");
  if (poolLength <= 0) throw new Error("В Session отсутствует корректная длина бассейна.");

  const lengths = document.messages
    .filter((message) => message.mesgNum === MESG_NUM.length)
    .sort((left, right) => messageIndex(left) - messageIndex(right));
  const laps = document.messages
    .filter((message) => message.mesgNum === MESG_NUM.lap)
    .sort((left, right) => messageIndex(left) - messageIndex(right));
  const lengthsByIndex = new Map(lengths.map((length) => [messageIndex(length), length]));
  const activeTimes = lengths
    .filter((length) => lengthType(length) === "active" && numberValue(length, "totalStrokes") > 0)
    .map((length) => numberValue(length, "totalTimerTime"))
    .sort((left, right) => left - right);
  const medianTime = activeTimes.length
    ? activeTimes[Math.floor(activeTimes.length / 2)]
    : 0;

  const rows: SwimLengthRow[] = [];
  const groups: SwimLapGroup[] = [];
  let activeLapNumber = 0;

  for (const lap of laps) {
    const groupLengths = lapLengths(lap, lengthsByIndex);
    const active = groupLengths.some((length) => lengthType(length) === "active");
    if (active) activeLapNumber += 1;
    const group: SwimLapGroup = {
      lap,
      active,
      lapNumber: active ? activeLapNumber : null,
      label: active ? `Интервал ${activeLapNumber}` : "Отдых",
      rows: [],
    };

    groupLengths.forEach((length, position) => {
      const type = lengthType(length);
      const row: SwimLengthRow = {
        id: `length-${messageIndex(length)}`,
        message: length,
        lap,
        lapNumber: activeLapNumber,
        positionInLap: position,
        globalPosition: rows.length,
        index: messageIndex(length),
        type,
        time: numberValue(length, "totalTimerTime"),
        strokes: numberValue(length, "totalStrokes"),
        cadence: numberValue(length, "avgSwimmingCadence"),
        stroke: typeof length.swimStroke === "string" ? length.swimStroke : "unknown",
        suspicious: type === "active" && medianTime > 0
          && numberValue(length, "totalStrokes") > 0
          && numberValue(length, "totalTimerTime") < medianTime * 0.72,
      };
      group.rows.push(row);
      rows.push(row);
    });
    if (group.rows.length) groups.push(group);
  }

  return {
    session,
    poolLength,
    poolUnit: session.poolLengthUnit === "statute" ? "ярд" : "м",
    lengths,
    laps,
    rows,
    groups,
  };
}

export function previewMerge(view: SwimView, selectedIds: Set<string>): MergePreview {
  const selected = view.rows
    .filter((row) => selectedIds.has(row.id))
    .sort((left, right) => left.globalPosition - right.globalPosition);
  const invalid = (reason: string): MergePreview => ({
    valid: false,
    reason,
    selected,
    oldDistance: selected.length * view.poolLength,
    newDistance: view.poolLength,
    oldTime: selected.reduce((total, row) => total + row.time, 0),
    newTime: selected.reduce((total, row) => total + row.time, 0),
    removedDistance: Math.max(0, selected.length - 1) * view.poolLength,
  });

  if (selected.length < 2) return invalid("Выберите минимум два отрезка.");
  if (selected.some((row) => row.type !== "active")) return invalid("Отдых объединять нельзя.");
  if (selected.some((row) => row.lap !== selected[0].lap)) {
    return invalid("Отрезки должны находиться внутри одного интервала.");
  }
  for (let index = 1; index < selected.length; index += 1) {
    if (selected[index].globalPosition !== selected[index - 1].globalPosition + 1) {
      return invalid("Выбранные отрезки должны идти подряд.");
    }
  }

  return {
    valid: true,
    selected,
    oldDistance: selected.length * view.poolLength,
    newDistance: view.poolLength,
    oldTime: selected.reduce((total, row) => total + row.time, 0),
    newTime: selected.reduce((total, row) => total + row.time, 0),
    removedDistance: (selected.length - 1) * view.poolLength,
  };
}

function updateLapMetrics(lap: MutableMesg, lengths: MutableMesg[], poolLength: number): void {
  const active = lengths.filter((length) => lengthType(length) === "active");
  const strokeLengths = active.filter((length) => numberValue(length, "totalStrokes") > 0);
  const totalStrokes = sum(active, "totalStrokes");
  const totalDistance = active.length * poolLength;
  const timerTime = sum(active, "totalTimerTime");

  lap.numLengths = active.length;
  lap.numActiveLengths = active.length;
  lap.totalDistance = totalDistance;
  lap.totalCycles = totalStrokes;
  lap.enhancedAvgSpeed = timerTime > 0 ? round(totalDistance / timerTime) : 0;
  lap.enhancedMaxSpeed = active.length
    ? round(Math.max(...active.map((length) => numberValue(length, "avgSpeed"))))
    : 0;
  lap.avgCadence = Math.round(average(strokeLengths
    .map((length) => numberValue(length, "avgSwimmingCadence"))
    .filter((value) => value > 0)));

  if (hasOwn(lap, "field73")) {
    lap.field73 = strokeLengths.length
      ? Math.round(average(strokeLengths.map((length) =>
        numberValue(length, "totalTimerTime") + numberValue(length, "totalStrokes"))))
      : 0;
  }
  if (hasOwn(lap, "field90")) {
    lap.field90 = strokeLengths.length
      ? Math.round(average(strokeLengths.map((length) => numberValue(length, "totalStrokes"))) * 10)
      : 0;
  }
}

function updateSessionMetrics(session: MutableMesg, lengths: MutableMesg[], poolLength: number): void {
  const active = lengths.filter((length) => lengthType(length) === "active");
  const strokeLengths = active.filter((length) => numberValue(length, "totalStrokes") > 0);
  const paceLengths = strokeLengths.length ? strokeLengths : active;
  const paceTime = sum(paceLengths, "totalTimerTime");

  session.numLengths = active.length;
  session.numActiveLengths = active.length;
  session.totalDistance = active.length * poolLength;
  session.totalCycles = sum(active, "totalStrokes");
  session.enhancedAvgSpeed = paceTime > 0 ? round((paceLengths.length * poolLength) / paceTime) : 0;
  session.enhancedMaxSpeed = active.length
    ? round(Math.max(...active.map((length) => numberValue(length, "avgSpeed"))))
    : 0;
  session.avgCadence = Math.round(average(strokeLengths
    .map((length) => numberValue(length, "avgSwimmingCadence"))
    .filter((value) => value > 0)));

  if (hasOwn(session, "field79")) {
    session.field79 = strokeLengths.length
      ? Math.round(average(strokeLengths.map((length) => numberValue(length, "totalStrokes"))) * 10)
      : 0;
  }
  if (hasOwn(session, "field80")) {
    session.field80 = strokeLengths.length
      ? Math.round(average(strokeLengths.map((length) =>
        numberValue(length, "totalTimerTime") + numberValue(length, "totalStrokes"))))
      : 0;
  }
}

export function mergeLengths(document: FitDocument, selectedIds: Set<string>): void {
  const view = buildSwimView(document);
  const preview = previewMerge(view, selectedIds);
  if (!preview.valid) throw new Error(preview.reason ?? "Невозможно объединить выбранные отрезки.");

  const selected = preview.selected;
  const first = selected[0].message;
  const last = selected[selected.length - 1].message;
  const removed = selected.slice(1).map((row) => row.message);
  const removedSet = new Set(removed);
  const removedIndexes = removed.map(messageIndex).sort((left, right) => left - right);
  const removedStarts = removed
    .map((message) => dateValue(message, "startTime"))
    .filter((date): date is Date => date != null)
    .map((date) => date.getTime());

  const timerTime = sum(selected.map((row) => row.message), "totalTimerTime");
  const elapsedTime = sum(selected.map((row) => row.message), "totalElapsedTime");
  const strokes = sum(selected.map((row) => row.message), "totalStrokes");
  const calories = sum(selected.map((row) => row.message), "totalCalories");
  const knownStrokes = selected
    .map((row) => row.message.swimStroke)
    .filter((stroke): stroke is string => typeof stroke === "string" && stroke !== "unknown");
  const distinctStrokes = new Set(knownStrokes);

  first.timestamp = last.timestamp;
  first.totalElapsedTime = round(elapsedTime);
  first.totalTimerTime = round(timerTime);
  first.totalStrokes = strokes;
  first.totalCalories = calories;
  first.avgSpeed = timerTime > 0 ? round(view.poolLength / timerTime) : 0;
  first.avgSwimmingCadence = timerTime > 0 ? Math.round(strokes * 60 / timerTime) : 0;
  if (distinctStrokes.size === 1) first.swimStroke = [...distinctStrokes][0];
  else if (distinctStrokes.size > 1) first.swimStroke = "mixed";

  // Shift cumulative record distances after each removed false turn.
  for (const message of document.messages) {
    if (message.mesgNum !== MESG_NUM.record || typeof message.distance !== "number") continue;
    const timestamp = dateValue(message, "timestamp")?.getTime();
    if (timestamp == null) continue;
    const passedFalseTurns = removedStarts.filter((start) => timestamp >= start).length;
    if (passedFalseTurns > 0) {
      message.distance = Math.max(0, round(message.distance - passedFalseTurns * view.poolLength));
    }
  }

  document.messages = document.messages.filter((message) => !removedSet.has(message));

  const currentLengths = document.messages
    .filter((message) => message.mesgNum === MESG_NUM.length)
    .sort((left, right) => messageIndex(left) - messageIndex(right));
  currentLengths.forEach((length, index) => { length.messageIndex = index; });

  // firstLengthIndex is an absolute index into all Length messages.
  for (const lap of view.laps) {
    const oldFirst = numberValue(lap, "firstLengthIndex", -1);
    if (oldFirst >= 0) {
      lap.firstLengthIndex = oldFirst - removedIndexes.filter((index) => index < oldFirst).length;
    }
  }

  const affectedLap = selected[0].lap;
  affectedLap.numLengths = Math.max(0, numberValue(affectedLap, "numLengths") - removed.length);
  affectedLap.numActiveLengths = Math.max(0, numberValue(affectedLap, "numActiveLengths") - removed.length);

  const lengthsByIndex = new Map(currentLengths.map((length) => [messageIndex(length), length]));
  for (const lap of view.laps) {
    updateLapMetrics(lap, lapLengths(lap, lengthsByIndex), view.poolLength);
  }
  updateSessionMetrics(view.session, currentLengths, view.poolLength);
  document.revision += 1;
}

export function cloneMessages(messages: MutableMesg[]): MutableMesg[] {
  return structuredClone(messages) as MutableMesg[];
}

export function encodeFit(document: FitDocument): Uint8Array {
  document.definitions.forEach(registerMessageDefinition);
  const encoder = new Encoder({ fieldDescriptions: document.fieldDescriptions });
  for (const message of document.messages) encoder.writeMesg(message);
  return encoder.close();
}

export function validateEncoded(bytes: Uint8Array): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const integrity = new Decoder(Stream.fromArrayBuffer(freshBuffer(bytes))).checkIntegrity();
  if (!integrity) errors.push("Не прошла проверка заголовка, размера или CRC.");

  try {
    const decoded = decodeFit(bytes, "validation.fit");
    errors.push(...decoded.decodeErrors.map((error) => error.message));
    const view = buildSwimView(decoded);
    const active = view.lengths.filter((length) => lengthType(length) === "active");
    const expectedDistance = active.length * view.poolLength;
    const sessionDistance = numberValue(view.session, "totalDistance");
    if (Math.abs(sessionDistance - expectedDistance) > 0.01) {
      errors.push(`Session.totalDistance=${sessionDistance}, ожидалось ${expectedDistance}.`);
    }
    view.lengths.forEach((length, index) => {
      if (messageIndex(length) !== index) errors.push("Индексы Length не являются непрерывными.");
    });
    const lapDistance = view.laps.reduce((total, lap) => total + numberValue(lap, "totalDistance"), 0);
    if (Math.abs(lapDistance - sessionDistance) > 0.01) {
      errors.push(`Сумма дистанций Lap=${lapDistance}, Session=${sessionDistance}.`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { ok: errors.length === 0, errors, warnings, size: bytes.byteLength };
}
