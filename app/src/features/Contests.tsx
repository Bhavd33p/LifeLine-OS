import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Contest {
  title: string; startTime: number; url: string; platform: 'LeetCode' | 'Codeforces';
}

function formatContestTime(ms: number) {
  const diff = ms - Date.now();
  const hours = diff / 3600000;
  const rel = hours < 1 ? `in ${Math.max(1, Math.round(diff / 60000))}m`
    : hours < 24 ? `in ${Math.round(hours)}h`
    : `in ${Math.round(hours / 24)}d`;
  const abs = new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `${abs} · ${rel}`;
}

export function Contests() {
  const [state, setState] = useState<'loading' | 'error' | Contest[]>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lcRes, cfRes] = await Promise.all([
          fetch('https://competeapi.vercel.app/contests/leetcode/'),
          fetch('https://competeapi.vercel.app/contests/codeforces/'),
        ]);
        if (!lcRes.ok || !cfRes.ok) throw new Error('bad response');
        const lcData = await lcRes.json();
        const cfData = await cfRes.json();
        const lc: Contest[] = (lcData?.data?.topTwoContests ?? []).map((c: any) => ({
          title: c.title, startTime: c.startTime * 1000,
          url: 'https://leetcode.com/contest/', platform: 'LeetCode',
        }));
        const cf: Contest[] = (Array.isArray(cfData) ? cfData : [])
          .filter((c: any) => c.startTime > Date.now())
          .sort((a: any, b: any) => a.startTime - b.startTime)
          .slice(0, 4)
          .map((c: any) => ({
            title: c.title, startTime: c.startTime,
            url: c.url || 'https://codeforces.com/contests', platform: 'Codeforces',
          }));
        if (!cancelled) setState([...lc, ...cf].sort((a, b) => a.startTime - b.startTime));
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card className="gap-2 p-4">
      <h2 className="text-sm font-semibold">Upcoming contests</h2>

      {state === 'loading' && (
        <p className="text-sm text-muted-foreground">Loading live contest schedule...</p>
      )}

      {/* A failed fetch is never shown as "no contests" — that would read as a
          fact about the schedule rather than about the network. */}
      {state === 'error' && (
        <p className="text-sm text-muted-foreground">
          Could not load the live schedule. Check{' '}
          <a className="underline" href="https://leetcode.com/contest/" target="_blank" rel="noopener">LeetCode</a>
          {' or '}
          <a className="underline" href="https://codeforces.com/contests" target="_blank" rel="noopener">Codeforces</a>
          {' '}directly.
        </p>
      )}

      {Array.isArray(state) && state.length === 0 && (
        <p className="text-sm text-muted-foreground">No upcoming contests found.</p>
      )}

      {Array.isArray(state) && state.map((c) => (
        <a key={`${c.platform}-${c.title}`} href={c.url} target="_blank" rel="noopener"
          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
          <span className="min-w-0 truncate">{c.title}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatContestTime(c.startTime)}
            </span>
            <Badge variant="secondary" className="text-[10px]">{c.platform}</Badge>
          </span>
        </a>
      ))}
    </Card>
  );
}
