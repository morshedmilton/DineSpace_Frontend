"use client";

import { getMenuAnalytics } from "@/app/actions/home/menu";
import { api } from "@/lib/api/axios";
import { restaurantContext } from "@/lib/context/Context";
import type { MenuItem } from "@/lib/interfaces/order";
import type { MenuAnalyticsRow } from "@/lib/interfaces/wallet";
import Result from "@/lib/Result";
import { ArrowLeft, CalendarRange, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useContext, useEffect, useMemo, useState } from "react";

type SortBy = "revenue" | "units";
type RangePreset = "7d" | "30d" | "90d" | "all" | "custom";

interface DateRangeSelection {
  preset: RangePreset;
  from: string;
  to: string;
}

interface AnalyticsSnapshot {
  requestKey: string;
  rows: MenuAnalyticsRow[];
  menu: MenuItem[];
}

interface CategoryPerformance {
  category: string;
  menuItems: number;
  itemsSold: number;
  revenue: number;
}

const EMPTY_ANALYTICS_ROWS: MenuAnalyticsRow[] = [];
const EMPTY_MENU_ITEMS: MenuItem[] = [];
const moneyFormat = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat("en-US");
const percentFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const formatMoney = (value: number) => moneyFormat.format(value);
const formatNumber = (value: number) => numberFormat.format(value);
const formatPercent = (value: number) => `${percentFormat.format(value)}%`;
const asDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const dayBoundary = (dateValue: string, endOfDay = false) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
};
const createPresetRange = (
  preset: Exclude<RangePreset, "custom">,
): DateRangeSelection => {
  const today = new Date();
  const to = asDateInputValue(today);
  const fromDate = new Date(today);

  if (preset === "all") {
    return { preset, from: "", to: "" };
  }

  fromDate.setDate(fromDate.getDate() - Number(preset.slice(0, -1)) + 1);
  return { preset, from: asDateInputValue(fromDate), to };
};

export default function Analytics() {
  const { defaultRestaurant } = useContext(restaurantContext);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [requestError, setRequestError] = useState<{
    requestKey: string;
    message: string;
  } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [dateRange, setDateRange] = useState<DateRangeSelection>(() =>
    createPresetRange("30d"),
  );
  const reduceMotion = useReducedMotion();
  const invalidDateRange =
    dateRange.preset === "custom" &&
    (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to);
  const requestKey = [
    defaultRestaurant,
    dateRange.preset,
    dateRange.from,
    dateRange.to,
    refreshVersion,
  ].join(":");

  useEffect(() => {
    let active = true;

    if (!defaultRestaurant || invalidDateRange) return;

    const loadAnalytics = async () => {
      try {
        const [rows, menuResponse] = await Promise.all([
          getMenuAnalytics(
            defaultRestaurant,
            dateRange.preset === "all"
              ? undefined
              : {
                  from: dayBoundary(dateRange.from),
                  to: dayBoundary(dateRange.to, true),
                },
          ),
          api.get<Result<MenuItem[]>>(
            `/menu/GetMenu/${defaultRestaurant}`,
          ),
        ]);

        if (!menuResponse.data.Success) {
          throw new Error(
            menuResponse.data.Message || "Unable to load current menu items.",
          );
        }

        const menu = menuResponse.data.Data ?? [];
        if (!Array.isArray(menu)) {
          throw new Error("The current menu response was invalid.");
        }

        if (active) {
          setSnapshot({ requestKey, rows, menu });
        }
      } catch (loadError) {
        if (!active) return;
        console.error("Menu analytics could not be loaded:", loadError);
        setRequestError({
          requestKey,
          message:
            loadError instanceof Error
              ? loadError.message
              : "Unable to load menu analytics. Try again.",
        });
      }
    };

    void loadAnalytics();

    return () => {
      active = false;
    };
  }, [
    dateRange,
    defaultRestaurant,
    invalidDateRange,
    refreshVersion,
    requestKey,
  ]);

  const currentSnapshot =
    snapshot?.requestKey === requestKey ? snapshot : null;
  const error =
    requestError?.requestKey === requestKey ? requestError.message : "";
  const loading =
    Boolean(defaultRestaurant) &&
    !invalidDateRange &&
    !currentSnapshot &&
    requestError?.requestKey !== requestKey;
  const rows = currentSnapshot?.rows ?? EMPTY_ANALYTICS_ROWS;
  const menu = currentSnapshot?.menu ?? EMPTY_MENU_ITEMS;
  const menuById = useMemo(
    () => new Map(menu.map((item) => [item.id, item])),
    [menu],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          revenue: sum.revenue + row.totalRevenue,
          itemsSold: sum.itemsSold + row.totalItemsSold,
        }),
        { revenue: 0, itemsSold: 0 },
      ),
    [rows],
  );
  const topRevenueRows = rows.slice(0, 5);
  const topRevenue = topRevenueRows[0]?.totalRevenue ?? 0;
  const volumeLeader = useMemo(
    () =>
      rows.reduce<MenuAnalyticsRow | null>(
        (leader, row) =>
          !leader || row.totalItemsSold > leader.totalItemsSold ? row : leader,
        null,
      ),
    [rows],
  );
  const topVolumeRows = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.totalItemsSold - a.totalItemsSold)
        .slice(0, 5),
    [rows],
  );
  const categoryPerformance = useMemo(() => {
    const byCategory = new Map<string, CategoryPerformance>();
    const analyticsById = new Map(rows.map((row) => [row.menuId, row]));

    for (const item of menu) {
      const category = item.catagory?.trim() || "Uncategorized";
      const summary = byCategory.get(category) ?? {
        category,
        menuItems: 0,
        itemsSold: 0,
        revenue: 0,
      };
      const stats = analyticsById.get(item.id);

      summary.menuItems += 1;
      summary.itemsSold += stats?.totalItemsSold ?? 0;
      summary.revenue += stats?.totalRevenue ?? 0;
      byCategory.set(category, summary);
    }

    for (const row of rows) {
      if (menuById.has(row.menuId)) continue;

      const category = "No longer listed";
      const summary = byCategory.get(category) ?? {
        category,
        menuItems: 0,
        itemsSold: 0,
        revenue: 0,
      };

      summary.menuItems += 1;
      summary.itemsSold += row.totalItemsSold;
      summary.revenue += row.totalRevenue;
      byCategory.set(category, summary);
    }

    return [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);
  }, [menu, menuById, rows]);
  const performanceRows = useMemo(
    () =>
      [...rows]
        .map((row) => ({
          ...row,
          category: menuById.get(row.menuId)?.catagory || "No longer listed",
        }))
        .sort((a, b) =>
          sortBy === "revenue"
            ? b.totalRevenue - a.totalRevenue
            : b.totalItemsSold - a.totalItemsSold,
        ),
    [menuById, rows, sortBy],
  );
  const availableMenuCount = menu.filter((item) => item.isAvailable).length;
  const categoryRevenueMax = Math.max(
    ...categoryPerformance.map((category) => category.revenue),
    0,
  );

  return (
    <motion.section
      initial={{
        opacity: 0,
        transform: reduceMotion ? "translateY(0px)" : "translateY(8px)",
      }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{
        duration: reduceMotion ? 0.12 : 0.22,
        ease: [0.23, 1, 0.32, 1],
      }}
      className="mx-auto max-w-[1480px] pb-10"
    >
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <Link
            href="/home/menu"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#765f56] underline-offset-4 transition-colors hover:text-[#A13924] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] focus-visible:ring-offset-2"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Menu management
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#28211e] sm:text-4xl">
            Menu analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#654f48] sm:text-base">
            See which dishes sell and the value of their recorded item sales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshVersion((version) => version + 1)}
          disabled={loading || !defaultRestaurant}
          aria-busy={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#dec0ba] bg-white px-3 py-2 text-sm font-semibold text-[#654f48] transition-colors hover:border-[#A13924] hover:text-[#A13924] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Updating…" : "Refresh"}
        </button>
      </header>

      <section
        aria-label="Filter menu analytics by date"
        className="mb-6 rounded-xl border border-[#dec0ba] bg-white p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange
            size={18}
            className="mr-1 text-[#765f56]"
            aria-hidden="true"
          />
          {(
            [
              ["7d", "7 days"],
              ["30d", "30 days"],
              ["90d", "90 days"],
              ["all", "All time"],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              aria-pressed={dateRange.preset === preset}
              onClick={() => setDateRange(createPresetRange(preset))}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] focus-visible:ring-offset-2 ${
                dateRange.preset === preset
                  ? "bg-[#A13924] text-white"
                  : "text-[#654f48] hover:bg-[#fbf2ee] hover:text-[#A13924]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-[#654f48]">
            From
            <input
              type="date"
              value={dateRange.from}
              max={dateRange.to || undefined}
              onChange={(event) =>
                setDateRange((current) => ({
                  ...current,
                  preset: "custom",
                  from: event.target.value,
                }))
              }
              aria-label="Analytics start date"
              className="min-h-10 rounded-lg border border-[#dec0ba] bg-white px-3 text-sm text-[#28211e] outline-none focus:border-[#A13924] focus:ring-2 focus:ring-[#A13924]/15"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[#654f48]">
            To
            <input
              type="date"
              value={dateRange.to}
              min={dateRange.from || undefined}
              max={asDateInputValue(new Date())}
              onChange={(event) =>
                setDateRange((current) => ({
                  ...current,
                  preset: "custom",
                  to: event.target.value,
                }))
              }
              aria-label="Analytics end date"
              className="min-h-10 rounded-lg border border-[#dec0ba] bg-white px-3 text-sm text-[#28211e] outline-none focus:border-[#A13924] focus:ring-2 focus:ring-[#A13924]/15"
            />
          </label>
          <p className="pb-2 text-xs leading-5 text-[#765f56]">
            {dateRange.preset === "all"
              ? "Showing all available history"
              : dateRange.from && dateRange.to
                ? `Showing ${dateRange.from} through ${dateRange.to}`
                : "Choose both dates to apply a custom range"}
          </p>
        </div>
        {invalidDateRange && (
          <p role="alert" className="mt-2 text-sm text-[#8f2f1e]">
            Choose a valid start and end date. The start date must be on or
            before the end date.
          </p>
        )}
      </section>

      <p className="mb-5 text-xs leading-5 text-[#765f56]">
        Sales value is calculated from item price × quantity in recorded order
        items. It is not profit and does not account for payment status,
        refunds, or discounts.
      </p>

      {!defaultRestaurant ? (
        <div
          role="status"
          className="rounded-xl border border-dashed border-[#dec0ba] bg-white px-5 py-12 text-center"
        >
          <h2 className="text-lg font-semibold text-[#28211e]">
            Choose a restaurant to view its menu performance
          </h2>
        </div>
      ) : loading ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#dec0ba] bg-white px-5 py-12 text-center text-sm text-[#654f48]"
        >
          Loading menu performance…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-[#dec0ba] bg-white px-5 py-8 text-center"
        >
          <h2 className="text-lg font-semibold text-[#28211e]">
            Menu analytics could not be loaded
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#654f48]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="mt-4 rounded-lg bg-[#A13924] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#812d1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="grid gap-8 rounded-2xl border border-[#dec0ba] bg-white p-5 sm:p-7 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:p-8">
            <div className="flex flex-col justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#654f48]">
                  Menu sales
                </h2>
                <p className="mt-1 text-sm text-[#8b7168]">
                  Gross item value for the selected date range
                </p>
              </div>
              <div className="mt-8">
                <p className="text-4xl font-semibold tracking-tight text-[#A13924] tabular-nums sm:text-5xl">
                  {formatMoney(totals.revenue)}
                </p>
                <p className="mt-2 text-sm text-[#654f48]">
                  {formatNumber(totals.itemsSold)} items sold
                </p>
                {volumeLeader && totals.itemsSold > 0 && (
                  <p className="mt-4 border-t border-[#eee2dd] pt-4 text-sm leading-6 text-[#654f48]">
                    <span className="font-semibold text-[#28211e]">
                      {volumeLeader.itemName}
                    </span>{" "}
                    leads by volume with{" "}
                    {formatNumber(volumeLeader.totalItemsSold)} sold.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-[#eee2dd] pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#28211e]">
                  Top sales by value
                </h2>
                <span className="text-xs text-[#765f56]">
                  Share of recorded sales
                </span>
              </div>
              {topRevenueRows.length > 0 ? (
                <ol className="space-y-4">
                  {topRevenueRows.map((row) => {
                    const share =
                      totals.revenue > 0
                        ? (row.totalRevenue / totals.revenue) * 100
                        : 0;
                    const relativeWidth =
                      topRevenue > 0
                        ? (row.totalRevenue / topRevenue) * 100
                        : 0;

                    return (
                      <li key={row.menuId}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-medium text-[#28211e]">
                            {row.itemName}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-[#654f48]">
                            {formatMoney(row.totalRevenue)}
                          </span>
                        </div>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-[#f2e8e4]"
                          role="img"
                          aria-label={`${row.itemName}: ${formatPercent(share)} of recorded menu sales`}
                        >
                          <div
                            className="h-full rounded-full bg-[#A13924]"
                            style={{ width: `${relativeWidth}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-[#765f56]">
                          {formatPercent(share)} of sales
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rounded-lg bg-[#fbf6f3] px-4 py-6 text-sm text-[#654f48]">
                  No item sales have been recorded yet.
                </p>
              )}
            </div>
          </section>

          <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-[#dec0ba] bg-white sm:grid-cols-4">
            <div className="border-b border-[#eee2dd] px-4 py-4 sm:border-b-0 sm:border-r">
              <dt className="text-xs font-medium text-[#765f56]">Items sold</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-[#28211e]">
                {formatNumber(totals.itemsSold)}
              </dd>
            </div>
            <div className="border-b border-[#eee2dd] px-4 py-4 sm:border-b-0 sm:border-r">
              <dt className="text-xs font-medium text-[#765f56]">
                Average sales per item sold
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-[#28211e]">
                {formatMoney(
                  totals.itemsSold > 0 ? totals.revenue / totals.itemsSold : 0,
                )}
              </dd>
            </div>
            <div className="border-r border-[#eee2dd] px-4 py-4 sm:border-r">
              <dt className="text-xs font-medium text-[#765f56]">
                Available now
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-[#28211e]">
                {formatNumber(availableMenuCount)}
                <span className="ml-1 text-sm font-normal text-[#765f56]">
                  / {formatNumber(menu.length)}
                </span>
              </dd>
            </div>
            <div className="px-4 py-4">
              <dt className="text-xs font-medium text-[#765f56]">
                Menu categories
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-[#28211e]">
                {formatNumber(
                  new Set(
                    menu.map((item) => item.catagory?.trim() || "Uncategorized"),
                  ).size,
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-[#dec0ba] bg-white p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#28211e]">
                  Category sales
                </h2>
                <span className="text-xs text-[#765f56]">
                  Current menu and recorded sales
                </span>
              </div>
              {categoryPerformance.length > 0 ? (
                <ul className="divide-y divide-[#eee2dd]">
                  {categoryPerformance.map((category) => {
                    const share =
                      totals.revenue > 0
                        ? (category.revenue / totals.revenue) * 100
                        : 0;
                    const width =
                      categoryRevenueMax > 0
                        ? (category.revenue / categoryRevenueMax) * 100
                        : 0;

                    return (
                      <li key={category.category} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="font-medium text-[#28211e]">
                            {category.category}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-[#654f48]">
                            {formatMoney(category.revenue)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f2e8e4]">
                          <div
                            className="h-full rounded-full bg-[#c58d5b]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs tabular-nums text-[#765f56]">
                          {formatNumber(category.menuItems)} menu items ·{" "}
                          {formatNumber(category.itemsSold)} sold ·{" "}
                          {formatPercent(share)} of sales
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg bg-[#fbf6f3] px-4 py-6 text-sm text-[#654f48]">
                  No menu categories are available for this restaurant.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-[#dec0ba] bg-white p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#28211e]">
                  Most ordered
                </h2>
                <span className="text-xs text-[#765f56]">Items sold</span>
              </div>
              {topVolumeRows.length > 0 ? (
                <ol className="divide-y divide-[#eee2dd]">
                  {topVolumeRows.map((row, index) => {
                    const maxUnits = topVolumeRows[0]?.totalItemsSold ?? 0;
                    const width =
                      maxUnits > 0 ? (row.totalItemsSold / maxUnits) * 100 : 0;

                    return (
                      <li
                        key={row.menuId}
                        className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="text-sm tabular-nums text-[#9b8177]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#28211e]">
                            {row.itemName}
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f2e8e4]">
                            <div
                              className="h-full rounded-full bg-[#A13924]"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-[#654f48]">
                          {formatNumber(row.totalItemsSold)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rounded-lg bg-[#fbf6f3] px-4 py-6 text-sm text-[#654f48]">
                  Item rankings will appear when sales are recorded.
                </p>
              )}
            </section>
          </div>

          <section className="mt-8 overflow-hidden rounded-xl border border-[#dec0ba] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#eee2dd] px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#28211e]">
                  Item performance
                </h2>
                <p className="mt-1 text-sm text-[#765f56]">
                  Sales value, quantity sold, and share of total item sales.
                </p>
              </div>
              <div
                className="inline-flex rounded-lg bg-[#f5f0ed] p-1"
                role="group"
                aria-label="Sort item performance"
              >
                <button
                  type="button"
                  aria-pressed={sortBy === "revenue"}
                  onClick={() => setSortBy("revenue")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] ${
                    sortBy === "revenue"
                      ? "bg-white text-[#A13924] shadow-sm"
                      : "text-[#654f48] hover:text-[#A13924]"
                  }`}
                >
                  Sales value
                </button>
                <button
                  type="button"
                  aria-pressed={sortBy === "units"}
                  onClick={() => setSortBy("units")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A13924] ${
                    sortBy === "units"
                      ? "bg-white text-[#A13924] shadow-sm"
                      : "text-[#654f48] hover:text-[#A13924]"
                  }`}
                >
                  Items sold
                </button>
              </div>
            </div>
            {performanceRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <caption className="sr-only">
                    Sales value and quantity sold for menu items
                  </caption>
                  <thead className="bg-[#fbf6f3] text-xs uppercase tracking-wide text-[#765f56]">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                        Menu item
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Category
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Menu price
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Sold
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Sales value
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee2dd]">
                    {performanceRows.map((row) => {
                      const share =
                        totals.revenue > 0
                          ? (row.totalRevenue / totals.revenue) * 100
                          : 0;

                      return (
                        <tr key={row.menuId} className="text-[#3e332f]">
                          <th
                            scope="row"
                            className="max-w-64 truncate px-5 py-3.5 font-medium text-[#28211e] sm:px-6"
                          >
                            {row.itemName}
                          </th>
                          <td className="px-4 py-3.5 text-[#654f48]">
                            {row.category}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {formatMoney(row.menuPrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {formatNumber(row.totalItemsSold)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                            {formatMoney(row.totalRevenue)}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums sm:px-6">
                            {formatPercent(share)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-[#654f48]">
                No item sales are available yet. Performance details will appear
                here when the API returns recorded sales.
              </p>
            )}
          </section>
        </>
      )}
    </motion.section>
  );
}
