function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
    </article>
  );
}

export default StatCard;
