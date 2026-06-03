import React from 'react';

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function EditModal({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="edit-modal-backdrop">
      <div className="edit-modal-shell">
        <div className="edit-modal-head">
          <strong>{title || 'Ndrysho pozicionin'}</strong>
          <button className="card" onClick={onClose}>Mbyll</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default EditModal;
