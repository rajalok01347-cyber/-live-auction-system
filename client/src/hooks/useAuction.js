import { useAuctionEvents } from "./useAuctionEvents.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAuctions,
  getMyAuctions,
  getMyBids,
  viewAuction,
  placeBid,
  createAuction,
  dashboardStats,
} from "../services/auction.service.js";

export const useGetAuctions = (page = 1) => {
  useAuctionEvents();
  return useQuery({
    queryKey: ["auctions", page],
    queryFn: () => getAuctions({ page }),
    keepPreviousData: true,
    refetchInterval: 3000,
  });
};

export const useGetMyAuctions = (page = 1) => {
  useAuctionEvents();
  return useQuery({
    queryKey: ["myAuctions", page],
    queryFn: () => getMyAuctions({ page }),
    keepPreviousData: true,
    refetchInterval: 3000,
  });
};

export const useGetMyBids = (page = 1, status = "active") => {
  useAuctionEvents();
  return useQuery({
    queryKey: ["myBids", page, status],
    queryFn: () => getMyBids({ page, status }),
    keepPreviousData: true,
    refetchInterval: 3000,
  });
};

export const useViewAuction = (id) => {
  return useQuery({
    queryKey: ["auction", id],
    queryFn: () => viewAuction(id),
    enabled: !!id,
    refetchInterval: 2000,
    structuralSharing: (oldData, newData) => oldData?._id === newData?._id && oldData.version > newData.version ? oldData : newData,
  });
};

export const usePlaceBid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bidAmount, id }) => placeBid({ bidAmount, id }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["auction", variables.id], (old) => old?.version > data.auction.version ? old : data.auction);
      queryClient.invalidateQueries({ queryKey: ["auction", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["myAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["myBids"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
};

export const useCreateAuction = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createAuction(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["myAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      options.onSuccess?.(...args);
    },
    onError: options.onError,
  });
};

export const useDashboardStats = () => {
  useAuctionEvents();
  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: dashboardStats,
  });
};

// Prefetch helpers
export const usePrefetchHandlers = () => {
  const queryClient = useQueryClient();

  const prefetchAuction = (id) => {
    queryClient.prefetchQuery({
      queryKey: ["auction", id],
      queryFn: () => viewAuction(id),
      staleTime: 30_000,
    });
  };

  const prefetchAuctions = (page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ["auctions", page],
      queryFn: () => getAuctions({ page }),
      staleTime: 30_000,
    });
  };

  const prefetchMyAuctions = (page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ["myAuctions", page],
      queryFn: () => getMyAuctions({ page }),
      staleTime: 30_000,
    });
  };

  const prefetchMyBids = (page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ["myBids", page, status],
      queryFn: () => getMyBids({ page, status }),
      staleTime: 30_000,
    });
  };

  const prefetchDashboard = () => {
    queryClient.prefetchQuery({
      queryKey: ["dashboardStats"],
      queryFn: dashboardStats,
      staleTime: 30_000,
    });
  };

  return {
    prefetchAuction,
    prefetchAuctions,
    prefetchMyAuctions,
    prefetchMyBids,
    prefetchDashboard,
  };
};
