import { useGetCommissionStats, useGetCommission } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Percent, Search, Hotel, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetCommissionStats();
  const { data: commission, isLoading: commLoading } = useGetCommission();

  const isLoading = statsLoading || commLoading;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="heading-dashboard">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-2">Key metrics and commission settings at a glance.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-searches">{stats?.totalSearches ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Platform-wide queries</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hotels Served</CardTitle>
              <Hotel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-hotels-served">{stats?.totalHotelsServed ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique hotel results displayed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Commission</CardTitle>
              <Percent className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary" data-testid="text-current-commission">{commission?.percent ?? 0}%</div>
              {commission?.updatedAt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {format(new Date(commission.updatedAt), "PPp")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.lastSearchAt && (
        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-foreground">Recent Activity</p>
              <p className="text-sm text-muted-foreground" data-testid="text-last-search">
                Last search processed at {format(new Date(stats.lastSearchAt), "PPp")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commission Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Original Price</span>
                <span className="font-mono">30 000 DA</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Commission ({commission?.percent ?? 0}%)</span>
                <span className="font-mono text-accent">+ {((commission?.percent ?? 0) / 100 * 30000).toLocaleString("fr-DZ")} DA</span>
              </div>
              <div className="flex justify-between items-center py-2 font-bold text-lg">
                <span>Final Price</span>
                <span className="text-primary" data-testid="text-preview-final">{Math.round(30000 * (1 + (commission?.percent ?? 0) / 100)).toLocaleString("fr-DZ")} DA</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
