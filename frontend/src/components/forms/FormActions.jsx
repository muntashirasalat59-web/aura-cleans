export default function FormActions({
  submitLabel,
  onCancel,
  extra,
  submitDisabled = false,
  showCancel = true,
}) {
  return (
    <div className="form-actions">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {showCancel && onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-lg">
            Cancel
          </button>
        )}
        {extra}
        <button type="submit" className="btn btn-primary btn-lg" disabled={submitDisabled}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}