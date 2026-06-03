export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmStyle = 'danger',
  onConfirm,
  onClose,
}) {
  const btnStyle = confirmStyle === 'danger'
    ? 'bg-rose-500 hover:bg-rose-600 text-white'
    : 'bg-jade-500 hover:bg-jade-600 text-white';

  return (
    <div
      className="fixed inset-0 bg-ink-900/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h3 className="font-display text-lg text-ink-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-ink-500 text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm border border-ink-200 text-ink-600
                       rounded-xl hover:bg-ink-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 px-4 py-2.5 text-sm rounded-xl transition-colors font-medium ${btnStyle}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}