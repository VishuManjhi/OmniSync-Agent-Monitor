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

      <div
        className="z-50 w-full max-w-xl rounded-lg p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-premium)'
        }}
      >
        {title && <div className="text-lg font-bold mb-3" style={{ color: 'var(--accent-yellow)' }}>{title}</div>}
        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{children}</div>
        {footer && <div className="mt-4 flex justify-end">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Modal;
