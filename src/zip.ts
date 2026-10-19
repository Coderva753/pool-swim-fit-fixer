export interface ExtractedFitFile {
  bytes: Uint8Array;
  fileName: string;
}

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_EOCD_SEARCH = 65_557;
const MAX_FIT_SIZE = 64 * 1024 * 1024;

function zipError(message: string): never {
  throw new Error(message);
}

function requireRange(bytes: Uint8Array, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > bytes.byteLength) {
    zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
  const firstPossibleOffset = Math.max(0, bytes.byteLength - MAX_EOCD_SEARCH);
  for (let offset = bytes.byteLength - 22; offset >= firstPossibleOffset; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY
      && offset + 22 + view.getUint16(offset + 20, true) === bytes.byteLength) return offset;
  }
  return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(
      new DecompressionStream("deflate-raw" as CompressionFormat),
    );
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return zipError("Не удалось распаковать FIT-файл из ZIP-архива.");
  }
}

async function decompress(
  bytes: Uint8Array,
  method: number,
  expectedSize: number,
): Promise<Uint8Array> {
  let result: Uint8Array;
  if (method === 0) {
    result = bytes.slice();
  } else if (method === 8) {
    result = await inflateRaw(bytes);
  } else {
    return zipError("ZIP-архив использует неподдерживаемый способ сжатия.");
  }

  if (result.byteLength !== expectedSize) {
    return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
  }
  return result;
}

export async function extractFitFromZip(bytes: Uint8Array): Promise<ExtractedFitFile> {
  if (bytes.byteLength < 22) {
    return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes, view);
  requireRange(bytes, endOffset, 22);

  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount
    || entryCount === 0xffff || centralDirectoryOffset === 0xffffffff
    || centralDirectorySize === 0xffffffff) {
    return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
  }
  requireRange(bytes, centralDirectoryOffset, centralDirectorySize);
  if (centralDirectoryOffset + centralDirectorySize > endOffset) {
    return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
  }

  const decoder = new TextDecoder();
  const fitEntries: Array<{
    fileName: string;
    flags: number;
    method: number;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
  }> = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    requireRange(bytes, offset, 46);
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_FILE_HEADER) {
      return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
    }

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const entrySize = 46 + fileNameLength + extraLength + commentLength;
    requireRange(bytes, offset, entrySize);
    if (offset + entrySize > centralDirectoryOffset + centralDirectorySize) {
      return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
    }
    const fileName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));

    if (!fileName.endsWith("/") && fileName.toLowerCase().endsWith(".fit")) {
      fitEntries.push({ fileName, flags, method, compressedSize, uncompressedSize, localHeaderOffset });
    }
    offset += entrySize;
  }

  if (fitEntries.length === 0) return zipError("В ZIP-архиве не найден FIT-файл.");
  if (fitEntries.length > 1) return zipError("В ZIP-архиве должен быть только один FIT-файл.");

  const entry = fitEntries[0];
  if ((entry.flags & 0x1) !== 0) return zipError("ZIP-архив защищён паролем.");
  if (entry.uncompressedSize > MAX_FIT_SIZE) return zipError("FIT-файл в ZIP-архиве слишком большой.");
  requireRange(bytes, entry.localHeaderOffset, 30);
  if (view.getUint32(entry.localHeaderOffset, true) !== LOCAL_FILE_HEADER) {
    return zipError("ZIP-архив повреждён или имеет неподдерживаемый формат.");
  }

  const localFileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + 30 + localFileNameLength + localExtraLength;
  requireRange(bytes, dataOffset, entry.compressedSize);
  const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
  const fitBytes = await decompress(compressed, entry.method, entry.uncompressedSize);
  const fileName = entry.fileName.split(/[\\/]/).pop() ?? "activity.fit";
  return { bytes: fitBytes, fileName };
}
