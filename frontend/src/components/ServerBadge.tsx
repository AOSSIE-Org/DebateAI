import { isOfficial, serverLabel, getServer, resetServer } from '@/lib/server';

export default function ServerBadge() {
  if (isOfficial()) return null;
  const invalid = !getServer();
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm">
      <span className={`size-1.5 rounded-full ${invalid ? 'bg-red-500' : 'bg-amber-500'}`} />
      <span>{invalid ? serverLabel() : `Custom server: ${serverLabel()}`}</span>
      <button
        type="button"
        className="underline text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
        onClick={() => {
          resetServer();
          window.location.href = '/';
        }}
      >
        Use official server
      </button>
    </div>
  );
}
