import React from 'react';
import { Info } from 'lucide-react';

export interface ToastData {
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastProps {
  toast: ToastData | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[90] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div
        className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl shadow-black/50 border backdrop-blur-md ${
          toast.type === 'error'
            ? 'bg-rose-950/80 border-rose-500/30 text-rose-200'
            : 'bg-slate-800/90 border-slate-700 text-slate-100'
        }`}
      >
        <Info
          className={`w-5 h-5 ${
            toast.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
          }`}
        />
        <p className="font-medium text-sm">{toast.message}</p>
      </div>
    </div>
  );
};