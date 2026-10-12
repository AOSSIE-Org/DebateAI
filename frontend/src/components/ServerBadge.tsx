import { isOfficial, serverLabel, getServer, resetServer } from '@/lib/server';

export default function ServerBadge() {
  let official = true;
  try {
    official = isOfficial();
  } catch {
    official = true;
  }
  if (official) return null;

  let invalid = false;
  try {
    invalid = !getServer();
  } catch {
    invalid = true;
  }

  const label = invalid ? serverLabel() : `Custom server: ${serverLabel()}`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm">
      <span className={`size-1.5 shrink-0 rounded-full ${invalid ? 'bg-red-500' : 'bg-amber-500'}`} />
      <span className="max-w-[140px] truncate sm:max-w-[200px]" title={label}>
        {label}
      </span>
      <button
        type="button"
        className="underline text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1 shrink-0"
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
