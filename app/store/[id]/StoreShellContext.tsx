"use client";

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";

type StoreShellValue = {
  storeName: string;
  setStoreName: (n: string) => void;
  isOwner: boolean;
  setIsOwner: (v: boolean) => void;
  storeId: string;
  setStoreId: (id: string) => void;
  userName: string | null;
  setUserName: (n: string | null) => void;
  userId: string | null;
  setUserId: (id: string | null) => void;
  isGuest: boolean;
  setIsGuest: (v: boolean) => void;
  cartCount: number;
  setCartCount: (n: number) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  deliveryLabel: string;
  setDeliveryLabel: (l: string) => void;
  showNav: boolean;
  setShowNav: (v: boolean) => void;
  onOpenCart: () => void;
  registerOpenCart: (fn: () => void) => void;
  onOpenAddress: () => void;
  registerOpenAddress: (fn: () => void) => void;
};

const StoreShellContext = createContext<StoreShellValue | null>(null);

export function useStoreShell() {
  const ctx = useContext(StoreShellContext);
  if (!ctx) throw new Error("useStoreShell must be inside StoreShellProvider");
  return ctx;
}

export function StoreShellProvider({ children }: { children: ReactNode }) {
  const [storeName, setStoreName] = useState("Store");
  const [isOwner, setIsOwner] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryLabel, setDeliveryLabel] = useState("Set address");
  const [showNav, setShowNav] = useState(true);

  const cartRef = useRef<(() => void) | null>(null);
  const addressRef = useRef<(() => void) | null>(null);

  const registerOpenCart = useCallback((fn: () => void) => { cartRef.current = fn; }, []);
  const registerOpenAddress = useCallback((fn: () => void) => { addressRef.current = fn; }, []);
  const onOpenCart = useCallback(() => cartRef.current?.(), []);
  const onOpenAddress = useCallback(() => addressRef.current?.(), []);

  return (
    <StoreShellContext.Provider value={{
      storeName, setStoreName,
      isOwner, setIsOwner,
      storeId, setStoreId,
      userName, setUserName,
      userId, setUserId,
      isGuest, setIsGuest,
      cartCount, setCartCount,
      searchQuery, setSearchQuery,
      deliveryLabel, setDeliveryLabel,
      showNav, setShowNav,
      onOpenCart, registerOpenCart,
      onOpenAddress, registerOpenAddress,
    }}>
      {children}
    </StoreShellContext.Provider>
  );
}
