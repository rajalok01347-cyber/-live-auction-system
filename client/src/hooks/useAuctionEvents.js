import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket } from "../config/socket.js";

export function useAuctionEvents() {
  const client = useQueryClient();
  useEffect(() => {
    const socket = connectSocket();
    let pending;
    const refresh = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        for (const name of ["auctions", "myAuctions", "myBids", "dashboardStats"]) client.invalidateQueries({ queryKey: [name] });
      }, 100);
    };
    socket.on("auction:changed", refresh);
    socket.on("connect", refresh);
    return () => { clearTimeout(pending); socket.off("auction:changed", refresh); socket.off("connect", refresh); };
  }, [client]);
}
