# DHTfs
## A file storage protocol on top of Bittorrent's DHT

DHTfs is a file storage protocol on top of BitTorrent’s DHT. Posting files is permissionless and the network has the censorship resistant properties of BitTorrent. Every file can be retrieved with a 20 byte hash. While this implementation uses BitTorrent it could be configured to use any other similar global DHT.

DHT stands for distributed hash table (not Dihydrotestosterone
): “a distributed system that provides a lookup service similar to a hash table: key–value pairs are stored in a DHT, and any participating node can efficiently retrieve the value associated with a given key. The main advantage of a DHT is that nodes can be added or removed with minimum work around re-distributing keys. Keys are unique identifiers which map to particular values, which in turn can be anything from addresses, to documents, to arbitrary data.”

DHTfs takes advantage of this property to store files as linked chunks of data within the DHT. Each successive chunk is linked to the previous by a hash. Similar chunks of data may be shared across files. Due to the nature of the network it is not recommended for storing large files and there's a soft limit of 100k per file. 

## Example

`DEBUG=dhtfs node example.js`

Run this simple example to enable debugging, connect to the DHT, store this README file on DHTfs, then retrieve it via the final hash, and print out the results which should be this README.

For a quieter example run: `node example.js`