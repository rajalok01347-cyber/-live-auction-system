import axios from "axios";
import { api } from "../config/api.js";

// getting list of all auction
export const getAuctions = async ({ page = 1, limit = 12 } = {}) => {
  const res = await api.get(`/auction?page=${page}&limit=${limit}`);
  return res.data;
};

// getting list of my auctions
export const getMyAuctions = async ({ page = 1, limit = 12 } = {}) => {
  const res = await api.get(`/auction/myauction?page=${page}&limit=${limit}`);
  return res.data;
};

// getting list of auctions user has bid on
export const getMyBids = async ({ page = 1, limit = 12, status = "active" } = {}) => {
  const res = await api.get(`/auction/mybids?page=${page}&limit=${limit}&status=${status}`);
  return res.data;
};

// getting single auction using _id
export const viewAuction = async (id) => {
  const res = await api.get(`/auction/${id}`);
  return res.data;
};

// placing bid for auction
export const placeBid = async ({ bidAmount, id }) => {
  const res = await api.post(`/auction/${id}/bid`, { bidAmount });
  return res.data;
};

// creating new auction (expects already-uploaded Cloudinary metadata)
export const createAuction = async (data) => {
  const payload = {
    itemName: data.itemName,
    startingPrice: data.startingPrice,
    increment: data.increment,
    itemDescription: data.itemDescription,
    itemCategory: data.itemCategory,
    itemStartDate: data.itemStartDate,
    itemEndDate: data.itemEndDate,
    formId: data.formId,
    public_id: data.public_id,
    secure_url: data.secure_url,
  };

  const res = await api.post(`/auction`, payload);
  return res.data;
};

// request signed upload params from backend
export const getUploadSignature = async () => {
  const res = await api.get(`/upload/signature`);
  return res.data;
};

// upload file directly to Cloudinary using signed params
// onProgress: optional callback receiving integer percent (0-100)
export const uploadImageToCloudinary = async ({
  file,
  signatureData,
  onProgress,
}) => {
  if (signatureData.local) {
    const res = await api.post(`/upload/local?formId=${encodeURIComponent(signatureData.formId)}`, file, {
      headers: { "Content-Type": file.type },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round(event.loaded * 100 / event.total));
      },
    });
    return res.data;
  }
  const cloudinaryFormData = new FormData();
  cloudinaryFormData.append("file", file);
  cloudinaryFormData.append("api_key", signatureData.apiKey);
  cloudinaryFormData.append("timestamp", signatureData.timestamp);
  cloudinaryFormData.append("signature", signatureData.signature);
  cloudinaryFormData.append("folder", signatureData.folder);

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;

  const res = await axios.post(cloudinaryUrl, cloudinaryFormData, {
    withCredentials: false,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (typeof onProgress !== "function") return;
      const total = progressEvent.total || 0;
      if (!total) return;
      const percent = Math.round((progressEvent.loaded * 100) / total);
      onProgress(percent);
    },
  });

  return res.data;
};

// getting dashboard stats
export const dashboardStats = async () => {
  const res = await api.get(`/auction/stats`);
  return res.data;
};
