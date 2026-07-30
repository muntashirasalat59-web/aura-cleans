export default function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="segmented-control" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`segmented-item ${value === opt.value ? 'segmented-item-active' : 'segmented-item-inactive'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
