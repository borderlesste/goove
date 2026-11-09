import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCT_ORDER_KEY,
  PRODUCT_RETURN_DELAY,
  shuffleProductIds,
} from "./productShuffle";

export function useProductOrder(products) {
  const [ids, setIds] = useState([]);
  const [rotation, setRotation] = useState(0);
  const previous = useRef([]);
  const applied = useRef(null);
  const awaySince = useRef(null);
  const pending = useRef(false);
  const signature = JSON.stringify(
    products.map((product) => product.id).sort(),
  );

  useLayoutEffect(() => {
    const source = JSON.parse(signature);
    const key = `${rotation}:${signature}`;
    if (!source.length || applied.current === key) return;
    applied.current = key;
    let prior = previous.current;
    if (!prior.length) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(PRODUCT_ORDER_KEY));
        if (Array.isArray(saved)) prior = saved;
      } catch {
        /* Shuffling works even when session storage is unavailable. */
      }
    }
    const next = shuffleProductIds(source, prior);
    previous.current = next;
    setIds(next);
    try {
      sessionStorage.setItem(PRODUCT_ORDER_KEY, JSON.stringify(next));
    } catch {
      /* Keep the order in memory. */
    }
  }, [signature, rotation]);

  useEffect(() => {
    const rotate = () => {
      if (document.querySelector("dialog[open]")) {
        pending.current = true;
        return;
      }
      pending.current = false;
      setRotation((value) => value + 1);
    };
    const leave = () => {
      awaySince.current ??= Date.now();
    };
    const returnToPage = () => {
      if (document.hidden || awaySince.current === null) return;
      const elapsed = Date.now() - awaySince.current;
      awaySince.current = null;
      if (elapsed >= PRODUCT_RETURN_DELAY) rotate();
    };
    const visibility = () => (document.hidden ? leave() : returnToPage());
    const afterModal = () => {
      if (pending.current) rotate();
    };
    if (document.hidden) leave();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", returnToPage);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", returnToPage);
    window.addEventListener("goove:modal-closed", afterModal);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", returnToPage);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", returnToPage);
      window.removeEventListener("goove:modal-closed", afterModal);
    };
  }, []);

  return useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const existing = new Set(ids);
    return [
      ...ids.map((id) => byId.get(id)).filter(Boolean),
      ...products.filter((product) => !existing.has(product.id)),
    ];
  }, [products, ids]);
}
