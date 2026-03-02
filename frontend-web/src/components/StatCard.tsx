type StatCardProps = {
  title: string;
  value: string | number;
  tone?: 'default' | 'warning' | 'critical';
};

export function StatCard({ title, value, tone = 'default' }: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`}>
      <p className="stat-title">{title}</p>
      <p className="stat-value">{value}</p>
    </article>
  );
}
