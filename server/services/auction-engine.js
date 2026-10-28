import mongoose from "mongoose";
import Product from "../models/product.model.js";

let io;
export const bindAuctionEvents = (socketServer) => { io = socketServer; };
const fail = (status, message) => Object.assign(new Error(message), { status });
export const validMoney = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1e9 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
export function serializeAuction(document) {
  const a = document.toObject ? document.toObject() : document;
  a.increment ??= 1;
  a.closed ??= false;
  a.version = (a.bids?.length || 0) * 2 + (a.closed ? 1 : 0);
  a.serverNow = Date.now();
  a.minNextBid = a.bids?.length ? Math.round((a.currentPrice + a.increment) * 100) / 100 : a.startingPrice;
  a.bids = [...(a.bids || [])].reverse();
  return a;
}
export async function snapshot(id) {
  const a = await Product.findById(id).populate("seller", "name").populate("bids.bidder", "name").populate("winner", "name");
  return a ? serializeAuction(a) : null;
}
function publish(auction, kind, extra = {}) {
  io?.to(String(auction._id)).emit(kind, { auction, ...extra });
  io?.emit("auction:changed", { auctionId: String(auction._id), version: auction.version, serverNow: auction.serverNow });
}

// Both closing and bidding use database time inside the atomic write. A delayed
// request cannot be accepted after the deadline, even if it was validated earlier.
export async function closeDue() {
  const candidates = await Product.find({ closed: { $ne: true }, $expr: { $lte: ["$itemEndDate", "$$NOW"] } }).select("_id").lean();
  for (const { _id } of candidates) {
    const closed = await Product.findOneAndUpdate({ _id, closed: { $ne: true }, $expr: { $lte: ["$itemEndDate", "$$NOW"] } }, [{ $set: {
      closed: true,
      winner: { $ifNull: [{ $arrayElemAt: ["$bids.bidder", -1] }, null] },
      finalPrice: { $cond: [{ $gt: [{ $size: "$bids" }, 0] }, "$currentPrice", null] },
      isSold: { $gt: [{ $size: "$bids" }, 0] },
      closedAt: "$$NOW",
    } }], { new: true });
    if (closed) publish(await snapshot(_id), "auction:ended");
  }
}
export function startAuctionCloser() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await closeDue(); } catch (error) { console.error("Auction closing failed:", error.message); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 500);
  timer.unref();
  return timer;
}
export async function acceptBid(id, userId, amount) {
  if (!mongoose.isValidObjectId(id)) throw fail(404, "Auction not found");
  if (!validMoney(amount)) throw fail(400, "Enter a positive amount with at most two decimal places");
  await closeDue();
  const before = await Product.findById(id);
  if (!before) throw fail(404, "Auction not found");
  if (String(before.seller) === String(userId)) throw fail(403, "You cannot bid on your own auction");
  if (before.closed || before.itemEndDate <= new Date()) throw fail(409, "Auction has ended");
  if (before.itemStartDate > new Date()) throw fail(409, "Auction has not started yet");
  const minimum = before.bids.length ? Math.round((before.currentPrice + (before.increment || 1)) * 100) / 100 : before.startingPrice;
  if (amount < minimum) throw fail(409, `Bid must be at least Rs ${minimum}`);
  const changed = await Product.findOneAndUpdate({
    _id: id, seller: { $ne: new mongoose.Types.ObjectId(userId) }, closed: { $ne: true }, currentPrice: before.currentPrice,
    $expr: { $and: [
      { $lte: ["$itemStartDate", "$$NOW"] }, { $gt: ["$itemEndDate", "$$NOW"] },
      { $eq: [{ $size: "$bids" }, before.bids.length] },
    ] },
  }, [{ $set: {
    currentPrice: amount,
    bids: { $concatArrays: ["$bids", [{ _id: new mongoose.Types.ObjectId(), bidder: new mongoose.Types.ObjectId(userId), bidAmount: amount, bidTime: "$$NOW" }]] },
  } }], { new: true });
  if (!changed) throw fail(409, "Auction changed or ended. Check the latest price and try again.");
  const auction = await snapshot(id);
  publish(auction, "auction:bidPlaced", { bidderId: userId, bidAmount: amount });
  return auction;
}
