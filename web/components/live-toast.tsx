"use client";

import { useEffect, useState } from "react";

export type ToastItem = {
  id: number;
  type: "gasto" | "ingreso";
  label: string;
  amount: string;
};

let _setToasts: React.Dispatch<React.SetStateAction<ToastItem[]>> | null = null;
let _nextId = 1;

export function pushToast(item: Omit<ToastItem, "id">) {
  if (!_setToasts) return;
  const id = _nextId++;
  _setToasts((prev) => [...prev, { ...item, id }]);
  setTimeout(() => {
    _setToasts?.((prev) => prev.filter((t) => t.id !== id));
  }, 4500);
}

export function LiveToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _setToasts = setToasts;
    return () => {
      _setToasts = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="live-toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`live-toast live-toast--${t.type}`}
          role="status"
        >
          <span className="live-toast-icon">
            {t.type === "gasto" ? "↑" : "↓"}
          </span>
          <div className="live-toast-body">
            <span className="live-toast-label">{t.label}</span>
            <span className="live-toast-amount">{t.amount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
