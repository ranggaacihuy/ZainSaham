import { Button, Modal } from './ui';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Ya, lanjutkan',
  cancelText = 'Batal',
  isDanger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Memproses…' : confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-muted">{message}</p>
    </Modal>
  );
}
