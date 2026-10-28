import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function seedLocal() {
  const password = await bcrypt.hash("DemoAuction123!", 10);
  const users = {};
  for (const [name, email, role] of [["Demo Seller", "seller@example.test", "user"], ["Demo Bidder", "bidder@example.test", "user"], ["Demo Admin", "admin@example.test", "admin"]]) {
    users[name] = await User.findOneAndUpdate({ email }, { $setOnInsert: { name, email, password, role } }, { upsert: true, new: true });
  }
  if (await Product.countDocuments()) return;
  const directory = path.resolve("local-data", "uploads");
  await mkdir(directory, { recursive: true });
  const items = [["Mechanical Keyboard", "Electronics", 500, "#4f46e5", "⌨"], ["Vintage Camera", "Collectibles", 1500, "#0f766e", "CAMERA"], ["Acoustic Guitar", "Musical Instruments", 2500, "#b45309", "GUITAR"]];
  for (const [title, category, price, color, icon] of items) {
    const filename = title.toLowerCase().replaceAll(" ", "-") + ".svg";
    await writeFile(path.join(directory, filename), `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650"><rect width="900" height="650" fill="${color}"/><circle cx="450" cy="270" r="170" fill="white" opacity=".12"/><text x="450" y="290" text-anchor="middle" font-family="Arial" font-size="64" fill="white">${icon}</text><text x="450" y="520" text-anchor="middle" font-family="Arial" font-size="40" fill="white">${title}</text></svg>`);
    await Product.create({ itemName: title, itemDescription: "Local demo item. Try placing a bid, or log in as the seller to create your own listing.", itemCategory: category, startingPrice: price, currentPrice: price, increment: 10, seller: users["Demo Seller"]._id, itemStartDate: new Date(Date.now() - 60000), itemEndDate: new Date(Date.now() + 24 * 3600000), itemImage: { public_id: filename, url: `http://localhost:${process.env.PORT}/local-images/${filename}` } });
  }
}
