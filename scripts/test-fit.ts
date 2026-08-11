import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import {
  buildSwimView,
  decodeFit,
  encodeFit,
  mergeLengths,
  previewMerge,
  validateEncoded,
} from "../src/fit";

const source = new Uint8Array(readFileSync("23931263419_ACTIVITY.fit"));
const document = decodeFit(source, "23931263419_ACTIVITY.fit");
const initial = buildSwimView(document);
const initialDistance = initial.session.totalDistance;

assert.equal(document.sourceIntegrity, true, "Исходный CRC должен быть корректным");
assert.equal(initial.poolLength, 50);
assert.equal(initial.lengths.length, 74);
assert.equal(initial.session.totalDistance, 3050);
assert.equal(initial.session.numActiveLengths, 61);

const untouchedBytes = encodeFit(document);
const untouchedValidation = validateEncoded(untouchedBytes);
assert.equal(untouchedValidation.ok, true, untouchedValidation.errors.join("; "));
const untouched = decodeFit(untouchedBytes, "untouched.fit");
assert.equal(untouched.messages.length, document.messages.length, "При round-trip потеряны сообщения");

const selection = new Set(["length-6", "length-7"]);
const preview = previewMerge(initial, selection);
assert.equal(preview.valid, true);
assert.equal(preview.removedDistance, 50);
mergeLengths(document, selection);

const changed = buildSwimView(document);
const merged = changed.lengths.find((length) => length.messageIndex === 6);
const affectedLap = changed.laps.find((lap) => lap.messageIndex === 3);
assert.ok(merged);
assert.ok(affectedLap);
assert.equal(merged.totalTimerTime, 62.137);
assert.equal(merged.totalStrokes, 25);
assert.equal(affectedLap.numLengths, 1);
assert.equal(affectedLap.totalDistance, 50);
assert.equal(affectedLap.field73, 87);
assert.equal(affectedLap.field90, 250);
assert.equal(changed.session.totalDistance, 3000);
assert.equal(changed.session.numActiveLengths, 60);
assert.equal(changed.lengths.length, 73);

const fixedBytes = encodeFit(document);
const validation = validateEncoded(fixedBytes);
assert.equal(validation.ok, true, validation.errors.join("; "));
const fixed = decodeFit(fixedBytes, "fixed.fit");
const fixedView = buildSwimView(fixed);
assert.equal(fixedView.session.totalDistance, 3000);
assert.equal(fixedView.session.numActiveLengths, 60);
assert.equal(fixedView.lengths.length, 73);
assert.equal(fixed.decodeErrors.length, 0);

console.log(JSON.stringify({
  sourceBytes: source.byteLength,
  untouchedBytes: untouchedBytes.byteLength,
  fixedBytes: fixedBytes.byteLength,
  sourceMessages: initial.lengths.length,
  fixedLengths: fixedView.lengths.length,
  sourceDistance: initialDistance,
  fixedDistance: fixedView.session.totalDistance,
  integrity: validation.ok,
}, null, 2));
