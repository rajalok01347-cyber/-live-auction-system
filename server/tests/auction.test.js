import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import { acceptBid, closeDue, snapshot, bindAuctionEvents, startAuctionCloser } from "../services/auction-engine.js";

let database, seller, bidders, closer;
const events = [];
test.before(async () => {
  database = await MongoMemoryServer.create({ binary: { systemBinary: path.resolve("local-data/mongodb-binaries/mongod.exe"), version: "7.0.14" }, instance: { ip: "127.0.0.1" } });
  await mongoose.connect(database.getUri("auction_tests"));
  const users = await User.create(Array.from({ length: 26 }, (_, i) => ({ name: `Test ${i}`, email: `test${i}@example.test`, password: "test-hash" })));
  [seller, ...bidders] = users;
  bindAuctionEvents({ to: () => ({ emit: (name, payload) => events.push({ name, payload }) }), emit: () => {} });
});
test.after(async () => { clearInterval(closer); await mongoose.disconnect(); await database?.stop(); });
async function listing(extra = {}) {
  return Product.create({ itemName: "Test auction", itemDescription: "Isolated test", itemCategory: "Other", startingPrice: 100, currentPrice: 100, increment: 10, seller: seller._id, itemImage: { public_id: "test", url: "/test.png" }, itemStartDate: new Date(Date.now() - 60000), itemEndDate: new Date(Date.now() + 60000), ...extra });
}
test("25 simultaneous equal bids accept exactly one and keep one audit record", async () => {
  const a = await listing();
  const result = await Promise.allSettled(bidders.map(b => acceptBid(String(a._id), String(b._id), 100)));
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  const state = await snapshot(a._id);
  assert.equal(state.bids.length, 1); assert.equal(state.currentPrice, 100);
});
test("different concurrent amounts keep increasing prices; final winner matches highest accepted bid", async () => {
  const a = await listing();
  await Promise.allSettled(bidders.map((b, i) => acceptBid(String(a._id), String(b._id), 100 + i * 10)));
  const stored = await Product.findById(a._id);
  for (let i = 1; i < stored.bids.length; i++) assert(stored.bids[i].bidAmount >= stored.bids[i-1].bidAmount + 10);
  await Product.updateOne({ _id: a._id }, { itemEndDate: new Date(Date.now() - 1) });
  await Promise.all([closeDue(), closeDue(), closeDue()]);
  const state = await snapshot(a._id);
  assert.equal(state.finalPrice, Math.max(...state.bids.map(b => b.bidAmount)));
  assert.equal(String(state.winner._id), String(state.bids[0].bidder._id));
  assert.equal(events.filter(e => e.name === "auction:ended" && String(e.payload.auction._id) === String(a._id)).length, 1);
});
test("self bids, invalid money, below-increment bids and pre-start bids are rejected", async () => {
  const a = await listing(); const uid=String(bidders[0]._id), id=String(a._id);
  await assert.rejects(acceptBid(id, String(seller._id), 100), { status: 403 });
  for (const n of [NaN, Infinity, -1, 0, 100.001]) await assert.rejects(acceptBid(id, uid, n), { status: 400 });
  await acceptBid(id, uid, 100);
  await assert.rejects(acceptBid(id, String(bidders[1]._id), 109), { status: 409 });
  await acceptBid(id, String(bidders[1]._id), 150); // No arbitrary maximum raise.
  const future=await listing({ itemStartDate: new Date(Date.now()+10000) });
  await assert.rejects(acceptBid(String(future._id),uid,100), { status: 409 });
});
test("decimal increment is enforced without accumulated rounding error", async () => {
  const a=await listing({ startingPrice: 0.1, currentPrice: 0.1, increment: 0.2 });const id=String(a._id);
  await acceptBid(id,String(bidders[0]._id),0.1);
  assert.equal((await snapshot(id)).minNextBid,0.3);
  await acceptBid(id,String(bidders[1]._id),0.3);
  await assert.rejects(acceptBid(id,String(bidders[0]._id),0.49),{status:409});
});
test("last-second bid is saved, timer closes without a read, all late bids fail", async () => {
  const a=await listing({ itemEndDate: new Date(Date.now()+1800) });const id=String(a._id);
  closer=startAuctionCloser();
  const accepted=await acceptBid(id,String(bidders[0]._id),100);
  assert.equal(accepted.currentPrice,100);
  await new Promise(r=>setTimeout(r,2400));
  const stored=await Product.findById(id);assert.equal(stored.closed,true);assert.equal(stored.finalPrice,100);
  await assert.rejects(acceptBid(id,String(bidders[1]._id),500),{status:409});
  assert.equal((await Product.findById(id)).bids.length,1);
});
test("no-bid closure has no winner or price and deadline-equal bids cannot enter", async () => {
  const a=await listing({ itemEndDate:new Date() });const id=String(a._id);
  await assert.rejects(acceptBid(id,String(bidders[0]._id),100),{status:409});
  await closeDue();const state=await snapshot(id);
  assert.equal(state.closed,true);assert.equal(state.winner,null);assert.equal(state.finalPrice,null);assert.equal(state.isSold,false);
});
