import { MongoClient, ObjectId } from 'mongodb';

const DEFAULT_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_DB_NAME = 'restroDB';

const uri = process.env.MONGODB_URI || DEFAULT_URI;
const dbName = process.env.MONGODB_DB || DEFAULT_DB_NAME;

let client;
let db;

export async function getDb() {
  if (db) return db;

  if (!client) {
    client = new MongoClient(uri);
  }

  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }

  db = client.db(dbName);
  return db;
}

export { ObjectId };

