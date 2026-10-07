import { Skeleton } from '../../components/ui/feedback';
import { Panel } from '../../components/ui/layout';

function PanelSkeleton({ rows, bars }: { rows: number; bars?: boolean }) {
  return (
    <Panel>
      <div className="flex h-11 items-center border-b border-line px-4">
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="grid gap-4 px-4 py-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid gap-2">
            <div className="flex items-center justify-between gap-6">
              <Skeleton className="h-3.5 max-w-48 flex-1" />
              <Skeleton className="h-3.5 w-6 shrink-0" />
            </div>
            {bars && <Skeleton className="h-1.5" />}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Same grid as the loaded dashboard, so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="grid gap-2 py-1.5">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={4} bars />
        <PanelSkeleton rows={4} bars />
        <PanelSkeleton rows={5} bars />
        <PanelSkeleton rows={5} bars />
        <div className="lg:col-span-2">
          <Panel>
            <div className="flex h-11 items-center border-b border-line px-4">
              <Skeleton className="h-3.5 w-24" />
            </div>
            <div className="px-4 py-4">
              <Skeleton className="h-[216px] w-full" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
