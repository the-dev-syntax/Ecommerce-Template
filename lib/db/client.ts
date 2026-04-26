// this is a client to connect to MongoDb 
// This approach is taken from https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient, ServerApiVersion } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI   // Uniform Resource Identifier
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
  _mongoClient?: MongoClient
  _mongoClientPromise?: Promise<MongoClient>
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value is
  // preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = globalWithMongo._mongoClient.connect()
  }
  client = globalWithMongo._mongoClient
  clientPromise = globalWithMongo._mongoClientPromise!
} else {
  // In production, also cache to reuse connections within the same serverless container
  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = globalWithMongo._mongoClient.connect()
  }
  client = globalWithMongo._mongoClient
  clientPromise = globalWithMongo._mongoClientPromise!
}

// Export both the client and the promise for the MongoDBAdapter
export { clientPromise }
export default client
