import fs from 'node:fs';
import zlib from 'node:zlib';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import StreamJson from 'stream-json';

const { parser } = StreamJson;
const file = process.argv[2];
const gzip = process.argv.includes('--gzip');
if (!file) throw new Error('file_required');

let tokenCount = 0;
const sink = new Writable({
  objectMode: true,
  write(_token, _encoding, callback) {
    tokenCount += 1;
    callback();
  },
});

const source = fs.createReadStream(file, { highWaterMark: 64 * 1024 });
if (gzip) await pipeline(source, zlib.createGunzip(), parser(), sink);
else await pipeline(source, parser(), sink);
if (tokenCount === 0) throw new Error('empty_json');
