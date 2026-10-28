import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import net from "node:net";

const dataPath = path.resolve("local-data");
await mkdir(path.join(dataPath, "database"), { recursive: true });
process.env.MONGOMS_DOWNLOAD_DIR = path.join(dataPath, "mongodb-binaries");
process.env.LOCAL_DEMO = "true";
process.env.NODE_ENV = "development";
process.env.PORT = "4001";
process.env.ORIGIN = "http://localhost:5173";
process.env.RESEND_API_KEY = "re_local_demo_disabled";
try { process.env.JWT_SECRET = await readFile(path.join(dataPath, "jwt-secret"), "utf8"); }
catch { process.env.JWT_SECRET = randomBytes(32).toString("hex"); await writeFile(path.join(dataPath, "jwt-secret"), process.env.JWT_SECRET); }

const existingDatabase = await new Promise(resolve => {
  const connection = net.connect(27027, "127.0.0.1");
  connection.once("connect", () => { connection.destroy(); resolve(true); });
  connection.once("error", () => resolve(false));
});
const mongo = existingDatabase ? null : await MongoMemoryServer.create({
  binary: { version: "7.0.14", systemBinary: path.join(dataPath, "mongodb-binaries", "mongod.exe") },
  instance: { ip: "127.0.0.1", port: 27027, dbPath: path.join(dataPath, "database"), storageEngine: "wiredTiger" },
});
process.env.MONGO_URL = mongo ? mongo.getUri("auction_local") : "mongodb://127.0.0.1:27027/auction_local";
const { connectDB } = await import("../config/db.config.js");
await connectDB();
const { default: Product } = await import("../models/product.model.js");
await Product.updateMany({ "itemImage.url": /^http:\/\/localhost:4000\/local-images\// }, [{ $set: { "itemImage.url": { $replaceOne: { input: "$itemImage.url", find: "localhost:4000", replacement: "localhost:4001" } } } }]);
await (await import("./seed.js")).seedLocal();
await import("../server.js");
console.log("Local demo ready. Login: bidder@example.test / DemoAuction123!");
// mongodb-memory-server's parent monitor stops its database when this process exits.
