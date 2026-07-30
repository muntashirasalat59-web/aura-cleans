export function FormField({ label, required, children, className = '' }) {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="field-required">*</span>}
        </span>
      )}
      {children}
    </div>
  );
}

export function formControlProps(className = '') {
  return { className: `input input-premium ${className}`.trim() };
}
