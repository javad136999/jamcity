export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-jam-green border-t-transparent" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({
  icon = "🌿",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fade-in flex flex-col items-center justify-center gap-3 rounded-xl2 glass px-6 py-16 text-center shadow-soft">
      <span className="text-4xl">{icon}</span>
      <p className="text-base font-bold text-slate-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="fade-in flex items-center gap-2 rounded-xl2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl2 glass shadow-soft">
      <div className="skeleton h-40 w-full" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}
