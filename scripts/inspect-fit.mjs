import fs from "node:fs";
import { Decoder, Profile, Stream } from "@garmin/fitsdk";

const filename = process.argv[2] ?? "23931263419_ACTIVITY.fit";
const bytes = fs.readFileSync(filename);
const decoder = new Decoder(Stream.fromBuffer(bytes));
const ordered = [];
const definitions = [];
const developerFields = [];

const result = decoder.read({
  expandComponents: false,
  expandSubFields: false,
  mergeHeartRates: false,
  includeUnknownData: true,
  mesgListener: (mesgNum, message) => {
    ordered.push({ mesgNum, name: Profile.types.mesgNum[mesgNum] ?? `unknown_${mesgNum}`, message });
  },
  mesgDefinitionListener: (definition) => definitions.push(definition),
  fieldDescriptionListener: (key, developerDataIdMesg, fieldDescriptionMesg) => {
    developerFields.push({ key, developerDataIdMesg, fieldDescriptionMesg });
  },
});

const counts = Object.groupBy(ordered, (entry) => entry.name);
console.log(JSON.stringify({
  filename,
  size: bytes.length,
  isFIT: decoder.isFIT(),
  integrity: decoder.checkIntegrity(),
  errors: result.errors,
  definitions: definitions.length,
  developerFields: developerFields.length,
  counts: Object.fromEntries(Object.entries(counts).map(([name, entries]) => [name, entries.length])),
  relevant: ordered.filter(({ name }) => ["length", "lap", "session", "activity"].includes(name)),
  recordSample: ordered.filter(({ name }) => name === "record").slice(0, 8),
}, null, 2));
