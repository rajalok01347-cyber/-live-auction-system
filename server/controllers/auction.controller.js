import { acceptBid, snapshot, validMoney } from "../services/auction-engine.js";
import Product from "../models/product.model.js";
import mongoose from "mongoose";
import Upload from "../models/upload.model.js";

export const createAuction = async (req, res) => {
  try {
    const {
      itemName,
      startingPrice,
      increment,
      itemDescription,
      itemCategory,
      itemStartDate,
      itemEndDate,
      formId,
      public_id,
      secure_url,
    } = req.body;

    const start = itemStartDate ? new Date(itemStartDate) : new Date();
    const end = new Date(itemEndDate);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || end <= new Date()) {
      return res
        .status(400)
        .json({ message: "Auction end date must be after start date" });
    }

    if (!validMoney(Number(startingPrice)) || !validMoney(Number(increment))) {
      return res.status(400).json({ message: "Start price and increment must be positive amounts with at most two decimal places" });
    }
    const upload = await Upload.findOne({ formId });

    if (!upload) {
      return res.status(400).json({
        message: "Invalid upload session",
      });
    }

    if (!public_id || !secure_url) {
      return res.status(400).json({
        message: "Image is required",
      });
    }

    const newAuction = new Product({
      itemName,
      startingPrice,
      increment,
      currentPrice: startingPrice,
      itemDescription,
      itemCategory,
      itemImage: {
        public_id,
        url: secure_url,
      },
      itemStartDate: start,
      itemEndDate: end,
      seller: req.user.id,
    });
    await newAuction.save();

    upload.status = "used";
    await upload.save();

    res
      .status(201)
      .json({ message: "Auction created successfully", newAuction });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating auction", error: error.message });
  }
};

export const showAuction = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = { itemEndDate: { $gt: new Date() } };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(
        "itemName itemDescription currentPrice bids itemStartDate itemEndDate increment closed finalPrice itemCategory itemImage seller",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const formatted = auction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      itemStartDate: item.itemStartDate,
      itemEndDate: item.itemEndDate,
      serverNow: Date.now(),
      increment: item.increment || 1,
      closed: item.closed,
      finalPrice: item.finalPrice,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    res.status(200).json({
      auctions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const auctionById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Auction not found" });
    const auction = await snapshot(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    res.json(auction);
  } catch (error) { res.status(500).json({ message: "Could not load auction" }); }
};

export const placeBid = async (req, res) => {
  try {
    const auction = await acceptBid(req.params.id, req.user.id, Number(req.body.bidAmount));
    res.json({ message: "Bid placed successfully", auction });
  } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};

export const dashboardData = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const dateNow = new Date();
    const stats = await Product.aggregate([
      {
        $facet: {
          totalAuctions: [{ $count: "count" }],
          userAuctionCount: [
            { $match: { seller: userObjectId } },
            { $count: "count" },
          ],
          activeAuctions: [
            {
              $match: {
                itemStartDate: { $lte: dateNow },
                itemEndDate: { $gte: dateNow },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalAuctions = stats[0].totalAuctions[0]?.count || 0;
    const userAuctionCount = stats[0].userAuctionCount[0]?.count || 0;
    const activeAuctions = stats[0].activeAuctions[0]?.count || 0;

    const globalAuction = await Product.find({ itemEndDate: { $gt: dateNow } })
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .limit(4);
    const latestAuctions = globalAuction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      itemStartDate: item.itemStartDate,
      itemEndDate: item.itemEndDate,
      serverNow: Date.now(),
      increment: item.increment || 1,
      closed: item.closed,
      finalPrice: item.finalPrice,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    const userAuction = await Product.find({ seller: userObjectId })
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .limit(4);
    const latestUserAuctions = userAuction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      itemStartDate: item.itemStartDate,
      itemEndDate: item.itemEndDate,
      serverNow: Date.now(),
      increment: item.increment || 1,
      closed: item.closed,
      finalPrice: item.finalPrice,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    return res.status(200).json({
      totalAuctions,
      userAuctionCount,
      activeAuctions,
      latestAuctions,
      latestUserAuctions,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error getting dashboard data", error: error.message });
  }
};

export const myAuction = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = { seller: req.user.id };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(
        "itemName itemDescription currentPrice bids itemStartDate itemEndDate increment closed finalPrice itemCategory itemImage seller",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const formatted = auction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      itemStartDate: item.itemStartDate,
      itemEndDate: item.itemEndDate,
      serverNow: Date.now(),
      increment: item.increment || 1,
      closed: item.closed,
      finalPrice: item.finalPrice,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    res.status(200).json({
      auctions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const myBids = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const filter = { "bids.bidder": userId };
    const tab = req.query.status || "active";
    if (!["all", "active", "won", "lost"].includes(tab)) return res.status(400).json({ message: "Invalid dashboard filter" });
    if (tab === "active") filter.closed = { $ne: true };
    if (tab === "won") { filter.closed = true; filter.winner = userId; }
    if (tab === "lost") { filter.closed = true; filter.winner = { $ne: userId }; }
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .populate("winner", "name")
      .select(
        "itemName itemDescription currentPrice bids itemStartDate itemEndDate increment closed finalPrice itemCategory itemImage seller winner isSold",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formatted = auction.map((item) => {
      const isExpired = item.closed;
      return {
        _id: item._id,
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        currentPrice: item.currentPrice,
        bidsCount: item.bids.length,
        itemStartDate: item.itemStartDate,
      itemEndDate: item.itemEndDate,
      serverNow: Date.now(),
      increment: item.increment || 1,
      closed: item.closed,
      finalPrice: item.finalPrice,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
        itemCategory: item.itemCategory,
        sellerName: item.seller.name,
        itemPhoto: item.itemImage?.url,
        isExpired,
        finalPrice: item.finalPrice,
        outcome: item.closed ? (String(item.winner?._id) === String(userId) ? "won" : "lost") : "active",
        leading: String(item.bids.at(-1)?.bidder) === String(userId),
        winner: item.winner
          ? { _id: item.winner._id, name: item.winner.name }
          : null,
        isSold: item.isSold,
      };
    });

    res.status(200).json({
      auctions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching my bids", error: error.message });
  }
};
