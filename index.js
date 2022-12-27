import DHT from 'bittorrent-dht'
import ed from 'ed25519-supercop'
import { serialize } from 'v8'
import fs from 'fs';
import createDebug from 'debug';

const debug = createDebug('dhtfs');

/** Create persistent connection to DHT on port. */
export function newDHT(port) {
    const dht = new DHT({ verify: ed.verify })

    dht.listen(port, function () {
        debug('now listening');
    })

    dht.on('peer', function (peer, _infoHash, from) {
        debug('found potential peer ' + peer.host + ':' + peer.port + ' through ' + from.address + ':' + from.port);
    })

    return dht;
}

export const MAX_FILE_SIZE = 100 * 1024;

/** Read filename and return array of chunk buffer slices. */
export function chunkFileByName(filename) {
    const stats = fs.statSync(filename);
    if (!stats.isFile()) {
        throw "Not a file";
    }
    if (stats.size > MAX_FILE_SIZE) {
        throw "File too big";
    }

    // All three of fs.readFile(), fs.readFileSync() and fsPromises.readFile() read the full content of the file in memory before returning the data.
    // If the encoding option is specified then this function returns a string. Otherwise it returns a buffer.
    // So don't pass "ascii" or "utf-8".
    const data = fs.readFileSync(filename);

    return chunkBuffer(data);
}

export const chunkSize = 900;

/**
 *  Split a buffer into 900 byte chunks - 900 is variable.
 *  Each chunk will be put with 20 byte hash of the next chunk prepended.
 *  Returns an array of chunk buffer slices.
 */
export function chunkBuffer(buf) {
    const chunks = [];
    for (let start = 0, end = chunkSize; start < buf.length; start += chunkSize, end += chunkSize) {
        chunks.push(buf.slice(start, end));
    }
    return chunks;
}

/** Return hex string without 0x. */
export function hashToHexString(hash) {
    const nibbles = [];
    hash.forEach(byte => {
        nibbles.push(byte >> 4); // high nibble
        nibbles.push(byte % 16); // low nibble
    });
    return nibbles.map(nib => nib.toString(16)).join('');
}

/** Reverse of hashToHexString. */
export function hashFromHexString(str) {
    if (str.length != 40) {
        throw "Expected 40 char string without 0x";
    }
    const bytes = [];
    for (let i = 0; i < 20; i++) {
        bytes.push(16 * parseInt(str[i * 2], 16) + parseInt(str[i * 2 + 1], 16));
    }
    return Buffer.from(bytes);
}

/** Return promised put. */
export function putPromise(dht, payload) {
    return new Promise(function (resolve, reject) {
        function wrapResolveReject(err, hash) {
            if (err) {
                reject(new Error(err));
            }
            debug("got hash ", hash, hashToHexString(hash));
            resolve(hash);
        }
        const opts = { v: payload }; // our version doesn't support any opts. "If you only specify opts.v, the content is considered immutable and the hash will just be the hash of the content."
        dht.put(opts, wrapResolveReject);
    });
}

/** Return promised get. */
export function getChunkPromise(dht, hash) {
    return new Promise(function (resolve, reject) {
        function wrapResolveReject(err, res) {
            if (err) {
                debug("get rejected: ", err);
                return reject(new Error(err));
            }
            if (res == null) {
                debug("null result");
                return reject("get returned null result");
            }
            // debug("got: ", res, res.v.toString());
            // dht.put(res, function () {
            //     // re-added the key/value pair to be nice
            // })
            resolve({ nextHash: res.v.slice(0, 20), chunk: res.v.slice(20, 20 + chunkSize) });
        }
        dht.get(hash, wrapResolveReject);
    });
}

/** Store chunks in reverse and link to each chunk with the 1st 20 bytes as a hash to the next. Returns hashes with initial first. */
export async function storeChunks(dht, chunks) {
    const chunksCopy = chunks.map(chunk => Buffer.from(chunk));
    const sentinalHash = Buffer.alloc(20);
    let chunk = chunksCopy.pop(); // Start from end and link in reverse

    let hash = await putPromise(dht, Buffer.concat([sentinalHash, chunk]));
    const hashes = [hash];

    while (chunksCopy.length) {
        chunk = chunksCopy.pop();
        hash = await putPromise(dht, Buffer.concat([hash, chunk]));
        hashes.unshift(hash);
    }

    return hashes;
}

/** Store bytes from filename as linked chunks. Returns hashes with initial first. */
export async function storeFileByName(dht, filename) {
    return await storeChunks(dht, chunkFileByName(filename));
}

export const SENTINAL_HEX = '0000000000000000000000000000000000000000';

/** Fetches all linked chunks starting from hash and returns a single Buffer. */
export async function fetchFile(dht, hash) {
    let nextHash = hash, chunk;
    const chunks = [];
    while (SENTINAL_HEX != hashToHexString(nextHash)) {
        try {
            ({ nextHash, chunk } = await getChunkPromise(dht, nextHash));
        } catch (err) {
            debug("Caught, will retry: ", err);
            await new Promise(function (resolve, _reject) {
                setTimeout(resolve, 5000);
            });
            ({ nextHash, chunk } = await getChunkPromise(dht, nextHash));
        }
        chunks.push(chunk);
        debug("nextHash: ", hashToHexString(nextHash));
        debug("chunk text: ", chunk.toString());
    }
    return Buffer.concat(chunks);
}
