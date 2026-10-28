import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useCreateAuction } from "../hooks/useAuction.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import {
  getUploadSignature,
  uploadImageToCloudinary,
} from "../services/auction.service.js";

export const CreateAuction = () => {
  useDocumentTitle("Create Auction");
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const uploadedMetaRef = useRef({
    formId: "",
    public_id: "",
    secure_url: "",
  });

  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const [formData, setFormData] = useState({
    itemName: "",
    itemDescription: "",
    itemCategory: "",
    startingPrice: "",
    increment: "1",
    itemStartDate: "",
    itemEndDate: "",
  });

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const { mutate, isPending } = useCreateAuction({
    onSuccess: (data) => {
      setFormData({
        itemName: "",
        itemDescription: "",
        itemCategory: "",
        startingPrice: "",
    increment: "1",
        itemStartDate: "",
        itemEndDate: "",
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = "";
      setPreviewUrl("");
      setSelectedFileName("");
      setUploadProgress(0);
      setIsUploading(false);
      uploadedMetaRef.current = { formId: "", public_id: "", secure_url: "" };
      if (fileInputRef.current) fileInputRef.current.value = "";

      setError("");
      navigate(`/auction/${data.newAuction._id}`);
    },
    onError: (err) =>
      setError(err?.response?.data?.message || "Something went wrong"),
  });

  const categories = [
    "Electronics",
    "Antiques",
    "Art",
    "Books",
    "Clothing",
    "Collectibles",
    "Home & Garden",
    "Jewelry",
    "Musical Instruments",
    "Sports",
    "Toys",
    "Vehicles",
    "Other",
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const clearUploadedImage = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = "";
    setPreviewUrl("");
    setSelectedFileName("");
    setUploadProgress(0);
    setIsUploading(false);

    uploadedMetaRef.current = {
      formId: "",
      public_id: "",
      secure_url: "",
    };

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (fileSizeMB > 5) {
      setError("File size must be less than 5 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError("");

    // Instant local preview via ref-backed object URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const localPreview = URL.createObjectURL(file);
    previewUrlRef.current = localPreview;
    setPreviewUrl(localPreview);
    setSelectedFileName(file.name);

    // Reset previous upload metadata and begin upload UI
    uploadedMetaRef.current = { formId: "", public_id: "", secure_url: "" };
    setUploadProgress(0);
    setIsUploading(true);

    try {
      const signatureRes = await getUploadSignature();
      const signatureData = signatureRes?.data;

      if (!signatureData?.formId) {
        throw new Error("Failed to initialize upload session");
      }

      const uploadRes = await uploadImageToCloudinary({
        file,
        signatureData,
        onProgress: (percent) => setUploadProgress(percent),
      });

      const public_id = uploadRes?.public_id;
      const secure_url = uploadRes?.secure_url;

      if (!public_id || !secure_url) {
        throw new Error("Cloud upload failed");
      }

      // Keep cloud metadata in ref (no extra save endpoint call)
      uploadedMetaRef.current = {
        formId: signatureData.formId,
        public_id,
        secure_url,
      };

      setUploadProgress(100);
    } catch (err) {
      uploadedMetaRef.current = { formId: "", public_id: "", secure_url: "" };
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Image upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const uploadMeta = uploadedMetaRef.current;
    if (!uploadMeta.formId || !uploadMeta.public_id || !uploadMeta.secure_url) {
      setError(
        isUploading
          ? "Image upload is in progress. Please wait."
          : "Please upload an image first.",
      );
      return;
    }

    const start = new Date(formData.itemStartDate);
    const end = new Date(formData.itemEndDate);

    if (end <= start) {
      setError("End date must be after start date.");
      return;
    }

    mutate({
      ...formData,
      startingPrice: Number(formData.startingPrice),
      increment: Number(formData.increment),
      itemStartDate: start.toISOString(),
      itemEndDate: end.toISOString(),
      formId: uploadMeta.formId,
      public_id: uploadMeta.public_id,
      secure_url: uploadMeta.secure_url,
    });
  };

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);

  const maxStart = new Date();
  maxStart.setDate(maxStart.getDate() + 15);
  const maxStartDate = new Date(+maxStart - maxStart.getTimezoneOffset() * 60000).toISOString().slice(0,16);

  let maxEndDate = "";
  if (formData.itemStartDate) {
    const end = new Date(formData.itemStartDate);
    end.setDate(end.getDate() + 15);
    maxEndDate = new Date(+end - end.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  }

  const inputClasses =
    "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition";

  const submitDisabled = isPending || isUploading;

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <button
          onClick={() => navigate(-1)}
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition mb-6 group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Auction</h1>
          <p className="text-sm text-gray-400 mt-1">List an item for bidding</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="itemName"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Item Name
                </label>
                <input
                  type="text"
                  id="itemName"
                  name="itemName"
                  value={formData.itemName}
                  onChange={handleInputChange}
                  className={inputClasses}
                  placeholder="e.g. Vintage mechanical watch"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="itemDescription"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="itemDescription"
                  name="itemDescription"
                  value={formData.itemDescription}
                  onChange={handleInputChange}
                  rows={4}
                  className={`${inputClasses} resize-vertical`}
                  placeholder="Describe condition, features, and any relevant details"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="itemCategory"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="itemCategory"
                    name="itemCategory"
                    value={formData.itemCategory}
                    onChange={handleInputChange}
                    className={inputClasses}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="startingPrice"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Starting Price (Rs)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      Rs
                    </span>
                    <input
                      type="number"
                      id="startingPrice"
                      name="startingPrice"
                      value={formData.startingPrice}
                      onChange={handleInputChange}
                      min="0.01"
                      step="0.01"
                      className={`${inputClasses} pl-10`}
                      placeholder="100"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label htmlFor="increment" className="block text-sm font-medium text-gray-700 mb-1.5">Minimum bid increment (Rs)</label>
                <input id="increment" name="increment" type="number" min="0.01" step="0.01" value={formData.increment} onChange={handleInputChange} className={inputClasses} required />
                <p className="mt-2 text-xs text-gray-500">English auction. First bid may equal the starting price; later bids must meet this increment. Bidding closes at the stated end time.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="itemStartDate"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    id="itemStartDate"
                    name="itemStartDate"
                    min={today}
                    value={formData.itemStartDate}
                    max={maxStartDate}
                    onChange={handleInputChange}
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="itemEndDate"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    id="itemEndDate"
                    name="itemEndDate"
                    value={formData.itemEndDate}
                    onChange={handleInputChange}
                    min={formData.itemStartDate}
                    max={maxEndDate}
                    className={inputClasses}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Photo
                </label>

                {!previewUrl ? (
                  <label
                    htmlFor="itemPhoto"
                    className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100/60 hover:border-gray-300 transition-colors"
                  >
                    <svg
                      className="w-8 h-8 text-gray-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm text-gray-400">
                      Click to upload image
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Max 5 MB</p>
                    <input
                      type="file"
                      id="itemPhoto"
                      name="itemPhoto"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                ) : (
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-44 h-44 object-cover rounded-2xl border border-gray-200"
                    />

                    <button
                      type="button"
                      onClick={clearUploadedImage}
                      className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-red-50 hover:border-red-200 transition"
                    >
                      <svg
                        className="w-4 h-4 text-gray-500 hover:text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    <div className="mt-3 w-44">
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                        <span className="truncate pr-2">
                          {selectedFileName}
                        </span>
                        <span className="tabular-nums">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            uploadProgress === 100
                              ? "bg-emerald-500"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {isUploading
                          ? "Uploading to Cloudinary..."
                          : uploadProgress === 100
                            ? "Upload complete"
                            : "Ready"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
                    submitDisabled
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.97] shadow-sm shadow-indigo-200"
                  }`}
                >
                  {isUploading
                    ? "Uploading..."
                    : isPending
                      ? "Creating..."
                      : "Create Auction"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <HelpSection />
      </div>
    </div>
  );
};

export const HelpSection = () => {
  const tips = [
    "Use clear, high-quality photos showing your item from multiple angles",
    "Write detailed descriptions including condition, dimensions, and flaws",
    "Set a reasonable starting price to attract bidders",
    "3-7 day auction duration typically works best",
    "Select the most accurate category to help buyers find your item",
  ];

  return (
    <div className="mt-6 bg-amber-50/60 border border-amber-100 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-amber-800 mb-3">
        Tips for a successful listing
      </h3>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
            <span className="text-amber-400 mt-0.5">&#10148;</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
};
