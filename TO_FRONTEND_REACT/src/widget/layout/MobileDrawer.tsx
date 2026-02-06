type MobileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-4">
        <button
          onClick={onClose}
          className="px-3 py-2 border rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}
