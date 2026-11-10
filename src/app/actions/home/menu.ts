import { api } from "@/lib/api/axios";
import type { MenuAnalyticsRow } from "@/lib/interfaces/wallet";
import Result from "@/lib/Result";

type MenuAnalyticsApiRow = Pick<MenuAnalyticsRow, "menuId" | "itemName"> & {
  menuPrice: number | string;
  totalItemsSold: number | string;
  totalRevenue: number | string;
};

function parseMetric(value: number | string, itemName: string, field: string) {
  const parsed = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} value for "${itemName}".`);
  }
  return parsed;
}

export async function getMenuAnalytics(
  restaurantId: string,
  datefilter?: { from?: Date; to?: Date },
): Promise<MenuAnalyticsRow[]> {
  const { data } = await api.get<Result<MenuAnalyticsApiRow[]>>(
    `analytics/menuanalytics/${restaurantId}`,
    {
      params: {
        from: datefilter?.from?.toISOString(),
        to: datefilter?.to?.toISOString(),
      },
    },
  );

  if (!data.Success) {
    
    throw new Error(data.Message || "Unable to load menu analytics.");
  }

  const rows = data.Data ?? [];
  if (!Array.isArray(rows)) {
    throw new Error("The menu analytics response was invalid.");
  }

  return rows
    .map(
      (row): MenuAnalyticsRow => ({
        menuId: row.menuId,
        itemName: row.itemName,
        menuPrice: parseMetric(row.menuPrice, row.itemName, "menu price"),
        totalItemsSold: parseMetric(
          row.totalItemsSold,
          row.itemName,
          "items sold",
        ),
        totalRevenue: parseMetric(
          row.totalRevenue,
          row.itemName,
          "revenue",
        ),
      }),
    )
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}