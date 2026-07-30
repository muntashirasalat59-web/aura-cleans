export default function FormShell({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="form-elevated">
      <div className="form-elevated-header">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="form-icon-wrap">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="form-title">{title}</h3>
            <div className="form-title-accent" aria-hidden />
            {subtitle && <p className="form-subtitle">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="form-elevated-body">{children}</div>
    </div>
  );
}
