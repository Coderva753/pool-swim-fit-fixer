import { strict as assert } from "node:assert";
import { Profile } from "@garmin/fitsdk";
import { buildSwimView, type FitDocument, type MutableMesg } from "../src/fit";

function detect(lengths: Record<string, unknown>[]) {
  const document: FitDocument = {
    fileName: "synthetic.fit",
    sourceSize: 0,
    sourceIntegrity: true,
    profileVersion: { major: 21, minor: 208 },
    definitions: [],
    fieldDescriptions: {},
    decodeErrors: [],
    revision: 0,
    messages: [
      {
        mesgNum: Profile.MesgNum.SESSION,
        sport: "swimming",
        subSport: "lapSwimming",
        poolLength: 25,
      },
      { mesgNum: Profile.MesgNum.LAP, messageIndex: 0, firstLengthIndex: 0, numLengths: lengths.length },
      ...lengths.map((length, messageIndex) => ({
        mesgNum: Profile.MesgNum.LENGTH,
        messageIndex,
        lengthType: "active",
        swimStroke: "freestyle",
        totalTimerTime: 30,
        totalStrokes: 20,
        ...length,
      })),
    ] as MutableMesg[],
  };
  return buildSwimView(document).rows.map((row) => row.suspicious);
}

assert.deepEqual(
  detect([{}, {}, {}, { totalStrokes: 8 }, { totalStrokes: 10 }]),
  [false, false, false, true, true],
  "A split pair with normal times must be detected from low stroke counts alone",
);
assert.deepEqual(
  detect([{}, {}, {}, { totalTimerTime: 12 }, { totalTimerTime: 15 }]),
  [false, false, false, true, true],
  "Short times must still be detected even with normal stroke counts",
);
assert.deepEqual(
  detect([{}, {}, {}, { totalStrokes: 15 }, { totalTimerTime: 22 }]),
  [false, false, false, false, false],
  "Small changes in time and stroke counts must not be flagged",
);
assert.deepEqual(
  detect([
    {}, {}, {},
    { totalStrokes: 0, totalTimerTime: 1 },
    { totalStrokes: undefined, totalTimerTime: 1 },
    { lengthType: "idle", totalStrokes: 1, totalTimerTime: 1 },
  ]),
  [false, false, false, false, false, false],
  "Rest and lengths without stroke counts must remain excluded",
);
assert.deepEqual(
  detect([
    {}, {}, {}, {}, {},
    { swimStroke: "breaststroke", totalStrokes: 10 },
    { swimStroke: "breaststroke", totalStrokes: 10 },
    { swimStroke: "breaststroke", totalStrokes: 4 },
  ]),
  [false, false, false, false, false, false, false, true],
  "Stroke counts must be compared within the same swimming style",
);
assert.deepEqual(
  detect([{}, {}, {}, { totalStrokes: 100, totalTimerTime: 100 }]),
  [false, false, false, false],
  "One large outlier must not distort the typical values or be treated as a split",
);
assert.deepEqual(
  detect([{}, {}, {}, { totalStrokes: 14.4 }, { totalTimerTime: 21.6 }]),
  [false, false, false, false, false],
  "The 72% boundary is not suspicious unless the value is strictly below it",
);
assert.deepEqual(detect([]), [], "An empty activity must not produce candidates");
assert.deepEqual(
  detect([{ totalStrokes: 0 }, { totalStrokes: undefined }, { lengthType: "idle" }]),
  [false, false, false],
  "An activity without eligible active lengths must not produce candidates",
);
assert.deepEqual(
  detect([{ swimStroke: undefined }, { swimStroke: undefined }, { swimStroke: undefined, totalStrokes: 5 }]),
  [false, false, true],
  "Unknown styles must still support stroke-count detection",
);

console.log("Suspicious-length detection: 10 scenarios passed.");
