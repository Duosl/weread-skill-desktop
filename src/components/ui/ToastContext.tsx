import { createContext, useCallback, useEffect, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "info" | "error" | "warn";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
};

let nextId = 0;

type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 3000) => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, type, message, duration }]);
    },
    [],
  );

  const toast = useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      addToast(type, message, duration);
    },
    [addToast],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {items.map((item) => (
          <ToastItem key={item.id} item={item} onClose={() => removeToast(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

type ToastItemProps = {
  item: ToastItem;
  onClose: () => void;
};

function ToastItem({ item, onClose }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (item.duration > 0) {
      timerRef.current = setTimeout(onClose, item.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.duration, onClose]);

  return (
    <div className={`toast toast-${item.type}`} role="alert">
      <div className="toast-progress" style={{ animationDuration: `${item.duration}ms` }} />
      <span className="toast-message">{item.message}</span>
      <button type="button" className="toast-close" aria-label="关闭提示" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
