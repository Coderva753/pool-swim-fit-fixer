import fs from "node:fs";
import { Decoder, Stream } from "@garmin/fitsdk";

const { messages } = new Decoder(Stream.fromBuffer(fs.readFileSync(process.argv[2] ?? "23931263419_ACTIVITY.fit"))).read({
  expandComponents: false,
  expandSubFields: false,
  mergeHeartRates: false,
  includeUnknownData: true,
});

for (const lap of messages.lapMesgs ?? []) {
  const start = new Date(lap.startTime).getTime();
  const end = start + (lap.totalElapsedTime ?? 0) * 1000 + 1000;
  const lengths = (messages.lengthMesgs ?? []).filter((length) => {
    const timestamp = new Date(length.startTime).getTime();
    return timestamp >= start && timestamp < end;
  });
  console.log(JSON.stringify({
    lap: lap.messageIndex,
    first: lap.firstLengthIndex,
    count: lap.numLengths,
    distance: lap.totalDistance,
    fields: { 73: lap[73], 90: lap[90], 155: lap[155], 162: lap[162] },
    lengths: lengths.map((length) => ({
      index: length.messageIndex,
      type: length.lengthType,
      time: length.totalTimerTime,
      strokes: length.totalStrokes,
      cadence: length.avgSwimmingCadence,
      stroke: length.swimStroke,
    })),
  }));
}
