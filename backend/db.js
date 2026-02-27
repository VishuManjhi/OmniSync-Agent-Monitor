import mongoose from 'mongoose';

const DEFAULT_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_DB_NAME = 'restroDB';

const uri = process.env.MONGODB_URI || DEFAULT_URI;
const dbName = process.env.MONGODB_DB || DEFAULT_DB_NAME;

function buildMongoConnectionUri(baseUri, databaseName) {
  try {
    const parsed = new URL(baseUri);
    const hasDbInUri = parsed.pathname && parsed.pathname !== '/';

    if (hasDbInUri) {
      if (process.env.MONGODB_DB) {
        parsed.pathname = `/${databaseName}`;
        return parsed.toString();
      }
      return baseUri;
    }

    parsed.pathname = `/${databaseName}`;
    return parsed.toString();
  } catch {
    const trimmed = String(baseUri).replace(/\/+$/, '');
    const hasDbInUri = /\/[^/?]+$/.test(trimmed);
    return hasDbInUri ? trimmed : `${trimmed}/${databaseName}`;
  }
}

const connectionUri = buildMongoConnectionUri(uri, dbName);

let isConnected = false;

export async function connectDb() {
  if (isConnected) return;

  try {
    await mongoose.connect(connectionUri, {
      // Mongoose 6+ options are simplified, but we add these for clarity
      autoIndex: true,
    });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB: ${dbName}`);
  } catch (err) {
    console.error('[DB] MongoDB connection error:', err);
    throw err;
  }
}

// Keeping getDb for backward compatibility during migration
export async function getDb() {
  await connectDb();
  return mongoose.connection.db;
}

export const ObjectId = mongoose.Types.ObjectId;

