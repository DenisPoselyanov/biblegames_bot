import { useEffect } from 'react';
import { Dialog } from 'react-vant';
import { haptic } from '../lib/telegram';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (open) haptic.impact('light');
  }, [open]);

  return (
    <Dialog
      visible={open}
      title={title}
      message={message}
      showCancelButton
      confirmButtonText={confirmText}
      cancelButtonText={cancelText}
      confirmButtonColor="var(--gold)"
      closeOnClickOverlay={false}
      onConfirm={() => {
        haptic.impact('medium');
        onConfirm();
      }}
      onCancel={() => {
        haptic.impact('light');
        onCancel();
      }}
      onClose={onCancel}
    />
  );
}
