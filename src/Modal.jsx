import React, { useEffect, useId, useRef } from "react";
import { X } from "@phosphor-icons/react/dist/csr/X";
export function Modal({ title, onClose, children, className = "" }) {
  const ref = useRef();
  const titleId = useId();
  useEffect(() => {
    const prior = document.activeElement;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      className={className}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const bounds = ref.current.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <button className="close" aria-label="Close dialog" onClick={onClose}>
        <X size={22} />
      </button>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
