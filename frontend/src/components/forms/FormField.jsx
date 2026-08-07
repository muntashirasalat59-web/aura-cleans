export function FormField({ label, required, children, className = '', error, warning, hint, htmlFor }) {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="field-required">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : null}
      {!error && warning ? <p className="field-warning">{warning}</p> : null}
      {!error && !warning && hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function inputClassName(error, className = '') {
  return `input input-premium ${error ? 'input-error' : ''} ${className}`.trim();
}

export function formControlProps(className = '', error = false) {
  return { className: inputClassName(error, className) };
}
