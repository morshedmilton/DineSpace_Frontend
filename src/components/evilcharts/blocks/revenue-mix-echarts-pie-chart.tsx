"use client";

import { EChartsPieChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-pie-chart";
import { cn } from "cn";


const money = (value: number) => value.toLocaleString("en-US");

interface RevenueMixDatum extends Record<string, unknown> {
  channel: string;
  label: string;
  value: number;
  swatch: string;
}

export function EChartsRevenueMixPieChart({chartData , chartConfig, ORDERS , title}: {chartData: RevenueMixDatum[], chartConfig: ChartConfig, ORDERS: number , title: string}) {
  return (
    <div className="flex h-full w-full items-center gap-3 p-4 sm:gap-6">
      <div className="relative aspect-square w-[40%] max-w-72 shrink-0">
        <EChartsPieChart
          data={chartData}
          config={chartConfig}
          dataKey="value"
          nameKey="channel"
          className="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Pie
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={6}
            cornerRadius={12}
            startAngle={90}
            endAngle={-270}
          />
        </EChartsPieChart>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="border-border flex aspect-square w-[56%] flex-col items-center justify-center rounded-full border border-dashed">
            <span className="text-primary text-lg leading-none font-semibold tracking-tight sm:text-2xl">
              {money(ORDERS)}
            </span>
            <span className="text-muted-foreground mt-1 text-[10px] sm:text-xs">
              {title}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
        {chartData.map(({ channel, label, value, swatch }) => (
          <div key={channel} className="flex items-center gap-2 py-1.5 sm:py-2">
            <span className={cn("size-2.5 shrink-0 rounded-[3px]", swatch)} />
            <span className="text-muted-foreground truncate text-xs">
              {label}
            </span>
            <span className="text-primary ml-auto text-xs font-semibold">
              ${money(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
