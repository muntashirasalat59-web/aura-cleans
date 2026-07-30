export default function FormActions({ submitLabel, onCancel, extra, submitDisabled = false }) {
  return (
    <div className="form-actions">
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-lg" disabled={submitDisabled}>
          {submitLabel}
        </button>
        {extra}
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}
