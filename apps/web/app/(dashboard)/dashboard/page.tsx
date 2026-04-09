'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DollarSign, Target, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { ChartContainer } from '@/components/dashboard/ChartContainer';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { SkeletonChart } from '@/components/dashboard/Skeletons';
import { useDashboardStore } from '@/lib/store/dashboardStore';
import { useAuth } from '@/hooks/useAuth';
import { api, ExecutiveSummary } from '@/lib/api';
import { formatNGN } from '@/utils/currency';

function toTrend(value: number | undefined, invert = false) {
	const normalized = Number.isFinite(value ?? Number.NaN) ? (value ?? 0) : 0;
	const direction = invert
		? normalized <= 0
			? 'up'
			: 'down'
		: normalized >= 0
			? 'up'
			: 'down';

	return {
		value: Math.abs(Number(normalized.toFixed(2))),
		direction,
		period: 'vs last period',
	} as const;
}

export default function DashboardHomePage() {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
	const [autoRefreshState, setAutoRefreshState] = useState<{
		status: 'syncing' | 'live' | 'degraded';
		consecutiveFailures: number;
		lastSuccessfulSync: Date | null;
	}>({ status: 'syncing', consecutiveFailures: 0, lastSuccessfulSync: null });
	const failureCountRef = useRef(0);
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const {
		preferences,
		interactions,
		setSelectedChannel,
		setRevenueZoom,
		toggleChartSeriesVisibility,
	} = useDashboardStore();
	const { organizationId } = useAuth();

	const fetchSummary = useCallback(
		async (silent = false) => {
			if (!organizationId) {
				return false;
			}

			if (!silent) {
				setLoading(true);
			}

			setAutoRefreshState((state) => ({ ...state, status: 'syncing' }));

			try {
				const result = await api.analytics.getExecutiveSummary(organizationId);
				setSummary(result);
				failureCountRef.current = 0;
				setAutoRefreshState({
					status: 'live',
					consecutiveFailures: 0,
					lastSuccessfulSync: new Date(),
				});
				return true;
			} catch {
				failureCountRef.current = Math.min(failureCountRef.current + 1, 5);
				setAutoRefreshState((state) => ({
					status: 'degraded',
					consecutiveFailures: failureCountRef.current,
					lastSuccessfulSync: state.lastSuccessfulSync,
				}));
				return false;
			} finally {
				if (!silent) {
					setLoading(false);
				}
			}
		},
		[organizationId],
	);

	useEffect(() => {
		if (!organizationId) {
			setLoading(false);
			return;
		}

		void fetchSummary(false);
	}, [organizationId, fetchSummary]);

	useEffect(() => {
		if (!organizationId) {
			return;
		}

		let isCancelled = false;

		const scheduleNext = () => {
			if (isCancelled) {
				return;
			}

			const backoffMultiplier = Math.pow(2, Math.min(failureCountRef.current, 3));
			const nextDelay = Math.min(preferences.refreshInterval * backoffMultiplier, 5 * 60 * 1000);

			refreshTimerRef.current = setTimeout(async () => {
				if (isCancelled) {
					return;
				}

				await fetchSummary(true);
				scheduleNext();
			}, nextDelay);
		};

		scheduleNext();

		return () => {
			isCancelled = true;
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
		};
	}, [organizationId, preferences.refreshInterval, fetchSummary]);

	const liveMetrics = useMemo(() => {
		if (!summary) {
			return null;
		}

		return {
			revenue: {
				value: formatNGN(summary.kpis.revenue),
				trend: toTrend(summary.kpis.revenueGrowthRate),
			},
			cac: {
				value: formatNGN(summary.kpis.cac),
				trend: toTrend(summary.kpis.revenueGrowthRate / 2, true),
			},
			ltv: {
				value: formatNGN(summary.kpis.ltv),
				trend: toTrend(summary.kpis.revenueGrowthRate / 2),
			},
			churn: {
				value: `${summary.kpis.churnRate.toFixed(2)}%`,
				trend: toTrend(summary.kpis.churnRate, true),
			},
			arpu: {
				value:
					summary.kpis.activeCustomers > 0
						? formatNGN(summary.kpis.revenue / summary.kpis.activeCustomers)
						: formatNGN(0),
				trend: toTrend(summary.kpis.revenueGrowthRate / 3),
			},
			customerCount: {
				value: summary.kpis.activeCustomers.toLocaleString('en-NG'),
				trend: toTrend(summary.kpis.revenueGrowthRate / 4),
			},
		};
	}, [summary]);

	const revenueChartData = useMemo(() => {
		if (summary?.verifiedMetrics?.length) {
			return summary.verifiedMetrics
				.slice()
				.sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime())
				.map((metric) => ({
					date: new Date(metric.windowStart).toLocaleDateString('en-NG', {
						month: 'short',
						day: 'numeric',
					}),
					revenue: Number(metric.metricValue),
				}));
		}

		if (!summary) {
			return [] as Array<{ date: string; revenue: number }>;
		}

		return [
			{
				date: new Date(summary.range.endDate).toLocaleDateString('en-NG', {
					month: 'short',
					day: 'numeric',
				}),
				revenue: summary.kpis.revenue,
			},
		];
	}, [summary]);

	const channelChartData = useMemo(() => {
		if (!summary) {
			return [] as Array<{ period: string; cac: number; ltv: number }>;
		}

		return summary.marketingPerformance.byChannel.map((channel) => ({
			period: channel.key,
			cac: Number(channel.cac.toFixed(2)),
			ltv: Number((summary.kpis.ltvToCacRatio * channel.cac).toFixed(2)),
		}));
	}, [summary]);

	const selectedChannel = interactions.selectedChannel;
	const hasSelectedChannel = Boolean(selectedChannel);

	const pipelineChartData = useMemo(() => {
		if (!summary) {
			return [] as Array<{ stage: string; count: number }>;
		}

		return summary.marketingPerformance.byChannel.map((channel) => ({
			stage: channel.key,
			count: channel.newCustomers,
		}));
	}, [summary]);

	const filteredChannelChartData = useMemo(() => {
		if (!selectedChannel) {
			return channelChartData;
		}

		return channelChartData.filter((item) => item.period === selectedChannel);
	}, [channelChartData, selectedChannel]);

	const filteredPipelineChartData = useMemo(() => {
		if (!selectedChannel) {
			return pipelineChartData;
		}

		return pipelineChartData.filter((item) => item.stage === selectedChannel);
	}, [pipelineChartData, selectedChannel]);

	const handleChannelDrillDown = useCallback(
		(payload: Record<string, unknown>) => {
			const channel = payload.period ?? payload.stage;
			if (typeof channel !== 'string' || channel.length === 0) {
				return;
			}

			setSelectedChannel(selectedChannel === channel ? null : channel);
		},
		[selectedChannel, setSelectedChannel],
	);

	const refreshStateLabel = useMemo(() => {
		if (autoRefreshState.status === 'degraded') {
			return `Auto-refresh degraded (retry x${autoRefreshState.consecutiveFailures})`;
		}

		if (autoRefreshState.status === 'syncing') {
			return 'Syncing latest data...';
		}

		if (!autoRefreshState.lastSuccessfulSync) {
			return 'Live refresh enabled';
		}

		return `Live refresh every ${Math.round(preferences.refreshInterval / 1000)}s`;
	}, [autoRefreshState, preferences.refreshInterval]);

	const handleManualRefresh = useCallback(() => {
		void fetchSummary(false);
	}, [fetchSummary]);

	const visibleMetrics = [
		{
			key: 'revenue',
			title: 'Total Revenue',
			value: liveMetrics?.revenue,
			icon: <DollarSign className="w-6 h-6" />,
		},
		{
			key: 'cac',
			title: 'Customer Acquisition Cost',
			value: liveMetrics?.cac,
			icon: <Target className="w-6 h-6" />,
		},
		{
			key: 'ltv',
			title: 'Lifetime Value',
			value: liveMetrics?.ltv,
			icon: <TrendingUp className="w-6 h-6" />,
		},
		{
			key: 'churn',
			title: 'Churn Rate',
			value: liveMetrics?.churn,
			icon: <Users className="w-6 h-6" />,
		},
		{
			key: 'arpu',
			title: 'ARPU',
			value: liveMetrics?.arpu,
			icon: <DollarSign className="w-6 h-6" />,
		},
		{
			key: 'customers',
			title: 'Total Customers',
			value: liveMetrics?.customerCount,
			icon: <Users className="w-6 h-6" />,
		},
	]
		.filter((metric) => preferences.visibleMetrics.includes(metric.key))
		.map((metric) => ({
			...metric,
			value: metric.value ?? { value: '--', trend: toTrend(0) },
		}));

	const evidenceCards = summary?.evidenceCards ?? [];
	const hasEvidenceCards = evidenceCards.length > 0;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Growth Command Center"
				description="Real-time revenue intelligence and actionable insights for your business"
				breadcrumbs={[
					{ label: 'Dashboard', href: '/dashboard' },
					{ label: 'Command Center' },
				]}
				action={
					<button
						onClick={handleManualRefresh}
						className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
						title="Refresh data"
					>
						<RefreshCw className="w-4 h-4" />
						<span className="text-sm font-medium hidden sm:inline">Refresh</span>
					</button>
				}
			/>

			<div className="flex flex-col sm:flex-row gap-3">
				<DateRangePicker />
				<DashboardCustomizer />
			</div>

			<div className="text-xs text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 inline-flex items-center">
				{refreshStateLabel}
			</div>

			<div className={`grid grid-cols-1 md:grid-cols-2 ${preferences.chartsPerRow === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
				{visibleMetrics.map((metric) => (
					<MetricCard
						key={metric.key}
						title={metric.title}
						value={metric.value.value}
						trend={metric.value.trend}
						icon={metric.icon}
						loading={loading}
					/>
				))}
			</div>

			<div className={`grid grid-cols-1 ${preferences.chartsPerRow === 1 ? 'lg:grid-cols-1' : preferences.chartsPerRow === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6`}>
				<div className={preferences.chartsPerRow === 1 ? '' : preferences.chartsPerRow === 2 ? 'lg:col-span-2' : 'lg:col-span-2'}>
					{loading ? (
						<SkeletonChart />
					) : (
						<ChartContainer
							title="Revenue Trend"
							description="Last 30 days of revenue data with zoom and point drill-down"
							action={
								interactions.revenueZoom ? (
									<button
										onClick={() => setRevenueZoom(null)}
										className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
									>
										Reset zoom
									</button>
								) : null
							}
						>
							<LineChart
								data={revenueChartData}
								dataKey="revenue"
								stroke="#4f46e5"
								xAxisKey="date"
								zoomRange={interactions.revenueZoom}
								onZoomChange={setRevenueZoom}
								onPointClick={handleChannelDrillDown}
								height={300}
							/>
						</ChartContainer>
					)}
				</div>

				<div>
					{loading ? (
						<SkeletonChart />
					) : (
						<ChartContainer
							title="CAC vs LTV"
							description="Comparison by channel with legend persistence"
							action={
								hasSelectedChannel ? (
									<button
										onClick={() => setSelectedChannel(null)}
										className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
									>
										Clear drill-down
									</button>
								) : null
							}
						>
							<BarChart
								data={filteredChannelChartData}
								dataKeys={[
									{ key: 'cac', fill: '#ff6b35', name: 'CAC' },
									{ key: 'ltv', fill: '#4f46e5', name: 'LTV' },
								]}
								hiddenSeries={interactions.hiddenSeriesByChart.cacLtv ?? []}
								onLegendToggle={(dataKey) => toggleChartSeriesVisibility('cacLtv', dataKey)}
								onBarClick={handleChannelDrillDown}
								height={300}
								xAxisKey="period"
							/>
						</ChartContainer>
					)}
				</div>
			</div>

			<div>
				<h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">AI Insights</h2>
				{summary?.suppression ? (
					<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
						<p className="font-semibold">Insights Suppressed</p>
						<p className="mt-1">{summary.suppression.message}</p>
					</div>
				) : null}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{loading
						? Array.from({ length: 2 }).map((_, index) => (
								<div key={index} className="p-6 rounded-lg bg-slate-200 dark:bg-slate-800 h-32 animate-pulse" />
							))
						: evidenceCards.slice(0, 2).map((insight) => (
								<InsightCard
									key={insight.id}
									title={insight.title}
									description={insight.description}
									impact={insight.impact}
									confidenceScore={insight.confidenceScore}
								/>
							))}
				</div>
				{!loading && !hasEvidenceCards ? (
					<p className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
						Evidence-backed insights are currently unavailable for this organization.
					</p>
				) : null}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2">
					<h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
						More Insights & Recommendations
					</h3>
					<div className="space-y-3">
						{loading
							? Array.from({ length: 2 }).map((_, index) => (
									<div key={index} className="p-4 rounded-lg bg-slate-200 dark:bg-slate-800 h-20 animate-pulse" />
								))
							: evidenceCards.slice(2, 4).map((insight) => (
									<InsightCard
										key={insight.id}
										title={insight.title}
										description={insight.description}
										impact={insight.impact}
										confidenceScore={insight.confidenceScore}
									/>
								))}
					</div>
				</div>

				<div>
					{loading ? (
						<SkeletonChart />
					) : (
						<ChartContainer
							title="Pipeline by Stage"
							description="Sales velocity overview with stage drill-down"
						>
							<BarChart
								data={filteredPipelineChartData}
								dataKeys={[
									{ key: 'count', fill: '#4f46e5', name: 'Deals' },
								]}
								hiddenSeries={interactions.hiddenSeriesByChart.pipeline ?? []}
								onLegendToggle={(dataKey) => toggleChartSeriesVisibility('pipeline', dataKey)}
								onBarClick={handleChannelDrillDown}
								height={300}
								xAxisKey="stage"
							/>
						</ChartContainer>
					)}
				</div>
			</div>
		</div>
	);
}