// this is a client to connect to MongoDb 
// This approach is taken from https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient, ServerApiVersion } from 'mongodb'

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
}

// Cache the MongoClient promise in both dev and production
// In serverless environments, the module scope persists across invocations
// within the same container, so this provides connection reuse
const globalWithMongo = global as typeof globalThis & { 
  _mongoClientPromise?: Promise<MongoClient>
}

// Lazy getter - only creates connection when actually accessed
// This prevents errors during build/static generation when MONGODB_URI may not be available
let clientPromise: Promise<MongoClient>

if (!globalWithMongo._mongoClientPromise) {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    // During build time, create a dummy promise that will be replaced at runtime
    // This prevents build failures when env vars aren't available
    clientPromise = new Promise(() => {}) as Promise<MongoClient>
  } else {
    const client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
    clientPromise = globalWithMongo._mongoClientPromise
  }
} else {
  clientPromise = globalWithMongo._mongoClientPromise
}

// Export the promise for the MongoDBAdapter
export { clientPromise }
