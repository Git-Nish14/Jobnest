interface AtelierStatsCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  bgClass: string;
  footer: React.ReactNode;
}

export function AtelierStatsCard({ label, value, icon, bgClass, footer }: AtelierStatsCardProps) {
  return (
    <div className={`db-stat-card h-full ${bgClass}`}>
      <div>
        <div className="text-[#99462a] dark:text-[#ccff00] mb-4">{icon}</div>
        <p className="db-stat-label">{label}</p>
        <p className="db-stat-value">{value}</p>
      </div>
      <div className="mt-8">{footer}</div>
    </div>
  );
}
