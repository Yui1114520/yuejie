export function NewsSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="sk-hero shimmer" />
      <div className="sk-section-head">
        <div className="sk-title shimmer" />
        <div className="sk-sub shimmer" />
      </div>
      <div className="sk-rail">
        {[0, 1, 2].map((index) => (
          <div key={index} className="sk-card">
            <div className="sk-card-media shimmer" />
            <div className="sk-line shimmer" />
            <div className="sk-line short shimmer" />
          </div>
        ))}
      </div>
      <div className="sk-section-head">
        <div className="sk-title shimmer" />
        <div className="sk-sub shimmer" />
      </div>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="sk-row">
          <div className="sk-row-main">
            <div className="sk-line shimmer" />
            <div className="sk-line short shimmer" />
            <div className="sk-line tiny shimmer" />
          </div>
          <div className="sk-thumb shimmer" />
        </div>
      ))}
    </div>
  );
}
