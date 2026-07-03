interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({
  icon = '📋',
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-4xl mb-4 opacity-50">{icon}</span>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      {description && (
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">{description}</p>
      )}
    </div>
  );
}
