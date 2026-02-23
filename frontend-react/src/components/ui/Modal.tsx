import React from 'react';
import { createPortal } from 'react-dom';

const Modal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, onOpenChange, title, children, footer }) => {
  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={() => onOpenChange(false)} />

      <div className="z-50 w-full max-w-xl bg-gray-900 rounded-lg p-6 shadow-lg">
        {title && <div className="text-lg font-bold text-yellow-400 mb-3">{title}</div>}
        <div className="text-sm text-gray-100">{children}</div>
        {footer && <div className="mt-4 flex justify-end">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Modal;
