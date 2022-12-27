const dhtfs = await import('./index.js');

const dht = dhtfs.newDHT(20000);
// You may need to wait to connect
await new Promise((resolve, reject) => setTimeout(resolve, 2500));

const hashes = await dhtfs.storeFileByName(dht, 'README.md');
console.log("file uploaded, final hash: ", dhtfs.hashToHexString(hashes[0]));

const buf = await dhtfs.fetchFile(dht, hashes[0]);
console.log(buf.toString());

dht.destroy();