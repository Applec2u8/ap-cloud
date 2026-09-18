import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Eye, RefreshCw, Smartphone, Monitor, Package, Code2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RepoStats {
  repoId: string;
  repoName: string;
  views: number;
  releaseViews: number;
  sourceDownloads: number;
  binaryDownloads: number;
}

interface VersionStat { version: string; count: number; }
interface DeviceStat  { deviceName: string; browser: string; os: string; deviceType: string; count: number; }

// ─── Helper ───────────────────────────────────────────────────────────────────
function deviceIcon(type: string) {
  if (type === 'Mobile' || type === 'Tablet')
    return <Smartphone className="h-4 w-4 text-blue-500 shrink-0" />;
  return <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, subtitle, gradient }: {
  icon: React.ReactNode; label: string; value: number;
  subtitle: string; gradient: string;
}) {
  return (
    <Card className={`${gradient} transition-all duration-200 hover:scale-[1.02]`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-4xl font-extrabold text-foreground tabular-nums">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const AnalyticsTab: React.FC = () => {
  const [repoStats, setRepoStats]       = useState<RepoStats[]>([]);
  const [releaseVersions, setReleaseVersions] = useState<VersionStat[]>([]);
  const [downloadDevices, setDownloadDevices] = useState<DeviceStat[]>([]);
  const [sourceDevices, setSourceDevices]     = useState<DeviceStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [reposRes, viewsRes, releaseViewsRes, downloadsRes] = await Promise.all([
        supabase.from('repositories').select('id, name'),
        supabase.from('repository_views').select('repository_id'),
        supabase.from('release_views').select('repository_id, version, device_type, device_name, browser, os'),
        supabase.from('download_logs').select('repository_id, download_type, version, device_type, device_name, browser, os'),
      ]);

      const repos     = reposRes.data      ?? [];
      const views     = viewsRes.data      ?? [];
      const rvws      = releaseViewsRes.data ?? [];
      const downloads = downloadsRes.data  ?? [];

      // ── 1. Per-repo aggregation ──────────────────────────────────────────
      const aggregated: RepoStats[] = repos.map(repo => ({
        repoId:           repo.id,
        repoName:         repo.name,
        views:            views.filter(v => v.repository_id === repo.id).length,
        releaseViews:     rvws.filter(r => r.repository_id === repo.id).length,
        sourceDownloads:  downloads.filter(d => d.repository_id === repo.id && d.download_type === 'source_code').length,
        binaryDownloads:  downloads.filter(d => d.repository_id === repo.id && d.download_type === 'release_binary').length,
      })).sort((a, b) => (b.views + b.releaseViews) - (a.views + a.releaseViews));

      setRepoStats(aggregated);

      // ── 2. Release version breakdown ────────────────────────────────────
      const versionMap: Record<string, number> = {};
      downloads
        .filter(d => d.download_type === 'release_binary' && d.version)
        .forEach(d => { versionMap[d.version!] = (versionMap[d.version!] || 0) + 1; });
      setReleaseVersions(
        Object.entries(versionMap)
          .map(([version, count]) => ({ version, count }))
          .sort((a, b) => b.count - a.count)
      );

      // ── 3. Device breakdown helper ──────────────────────────────────────
      const groupDevices = (rows: typeof downloads): DeviceStat[] => {
        const map: Record<string, DeviceStat> = {};
        rows.forEach(d => {
          const key = `${d.device_name ?? 'Unknown'}|${d.browser ?? 'Unknown'}`;
          if (!map[key]) {
            map[key] = {
              deviceName: d.device_name ?? 'Unknown Device',
              browser:    d.browser     ?? 'Unknown Browser',
              os:         d.os          ?? 'Unknown OS',
              deviceType: d.device_type ?? 'Desktop/PC',
              count: 0,
            };
          }
          map[key].count++;
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
      };

      setDownloadDevices(groupDevices(downloads.filter(d => d.download_type === 'release_binary')));
      setSourceDevices(groupDevices(downloads.filter(d => d.download_type === 'source_code')));

    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const totalViews    = repoStats.reduce((s, r) => s + r.views, 0);
  const totalRelViews = repoStats.reduce((s, r) => s + r.releaseViews, 0);
  const totalBinDls   = repoStats.reduce((s, r) => s + r.binaryDownloads, 0);
  const totalSrcDls   = repoStats.reduce((s, r) => s + r.sourceDownloads, 0);
  const maxBin        = Math.max(...releaseVersions.map(v => v.count), 1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <span className="spinner" style={{ width: 36, height: 36 }} />
        <span className="text-sm">Aggregating analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Analytics Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time event data from all repositories</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* ── 4 Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          label="Repo Views"
          value={totalViews}
          subtitle="Unique page visits per repo"
          gradient="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20"
        />
        <MetricCard
          icon={<Eye className="h-5 w-5 text-amber-500" />}
          label="Release Views"
          value={totalRelViews}
          subtitle="Detail page views & row clicks"
          gradient="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20"
        />
        <MetricCard
          icon={<Package className="h-5 w-5 text-purple-500" />}
          label="Binary Downloads"
          value={totalBinDls}
          subtitle="App installers & binaries"
          gradient="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20"
        />
        <MetricCard
          icon={<Code2 className="h-5 w-5 text-emerald-500" />}
          label="Source Downloads"
          value={totalSrcDls}
          subtitle="ZIP & commit archives"
          gradient="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
        />
      </div>

      {/* ── Row 2: Repo table + Version breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Repo breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Repository Activity</CardTitle>
            <CardDescription>Views, release clicks & downloads per repo</CardDescription>
          </CardHeader>
          <CardContent>
            {repoStats.length === 0
              ? <p className="text-sm text-muted-foreground">No data yet.</p>
              : (
              <div className="space-y-0 divide-y divide-border">
                {repoStats.slice(0, 8).map(r => (
                  <div key={r.repoId} className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-sm font-medium truncate flex-1">{r.repoName}</span>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span title="Repo views" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Activity className="h-3 w-3" />{r.views}
                      </span>
                      <span title="Release views" className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <Eye className="h-3 w-3" />{r.releaseViews}
                      </span>
                      <span title="Binary downloads" className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                        <Package className="h-3 w-3" />{r.binaryDownloads}
                      </span>
                      <span title="Source downloads" className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Code2 className="h-3 w-3" />{r.sourceDownloads}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version downloads */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Downloads by Version</CardTitle>
            <CardDescription>Binary release download counts</CardDescription>
          </CardHeader>
          <CardContent>
            {releaseVersions.length === 0
              ? <p className="text-sm text-muted-foreground">No downloads yet.</p>
              : (
              <div className="space-y-3">
                {releaseVersions.slice(0, 8).map(v => (
                  <div key={v.version} className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs shrink-0 w-20 justify-center">
                      v{v.version}
                    </Badge>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${(v.count / maxBin) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-8 text-right">{v.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Device tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Binary download devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-500" /> Binary Download Devices
            </CardTitle>
            <CardDescription>Devices that downloaded app releases</CardDescription>
          </CardHeader>
          <CardContent>
            {downloadDevices.length === 0
              ? <p className="text-sm text-muted-foreground">No data yet.</p>
              : (
              <div className="space-y-0 divide-y divide-border">
                {downloadDevices.slice(0, 10).map((d, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5">
                    {deviceIcon(d.deviceType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{d.deviceName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{d.browser} · {d.os}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{d.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source code download devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Code2 className="h-4 w-4 text-emerald-500" /> Source Code Download Devices
            </CardTitle>
            <CardDescription>Devices that downloaded source archives</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceDevices.length === 0
              ? <p className="text-sm text-muted-foreground">No data yet.</p>
              : (
              <div className="space-y-0 divide-y divide-border">
                {sourceDevices.slice(0, 10).map((d, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5">
                    {deviceIcon(d.deviceType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{d.deviceName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{d.browser} · {d.os}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{d.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-blue-500"/> Repo views</span>
        <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-amber-500"/> Release views / clicks</span>
        <span className="flex items-center gap-1"><Package className="h-3 w-3 text-purple-500"/> Binary downloads</span>
        <span className="flex items-center gap-1"><Code2 className="h-3 w-3 text-emerald-500"/> Source downloads</span>
      </div>

    </div>
  );
};

export default AnalyticsTab;
