export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="list-empty">
      {Icon && (
        <div className="list-empty-icon" aria-hidden>
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="list-empty-title">{title}</h3>
      {description && <p className="list-empty-desc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary mt-5" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
