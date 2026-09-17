// PageCard — standard white card container for detail/edit content.
// Fresh copy of Navigator's helper; same class hooks, different repo.

export default function PageCard({ children, className = '', style }) {
  return (
    <div className={`profile-card ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
