export type BlockType =
  | "company-header"
  | "employee-info"
  | "pay-period"
  | "earnings-table"
  | "deductions-table"
  | "net-summary"
  | "custom-text"
  | "separator"
  | "signature-line";

export interface TemplateBlock {
  id: string;
  type: BlockType;
  config: Record<string, any>;
}

export interface PayComponentGroup {
  id: number;
  name: string;
  code: string;
  category: string;
  component_codes: string[] | string | null;
  description?: string | null;
  active?: boolean;
}

export interface TemplateLayoutItem {
  code: string;
  category: string;
  sequence: number;
  name?: string;
}

export const getBlockCategory = (blockType: BlockType) => {
  if (blockType === "earnings-table") return "earning";
  if (blockType === "deductions-table") return "deduction";
  return null;
};

export const normaliseComponentCodes = (
  raw: PayComponentGroup["component_codes"],
): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((code) => String(code).trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed)
      ? parsed.map((code) => String(code).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

export const resolveBlockItems = <T extends TemplateLayoutItem>(
  blocks: TemplateBlock[],
  items: T[],
  groups: PayComponentGroup[],
) => {
  const assigned = new Set<string>();
  const byBlockId: Record<string, T[]> = {};

  for (const block of blocks) {
    const category = getBlockCategory(block.type);
    if (!category) continue;

    const groupCode = String(block.config?.groupCode ?? "").trim();
    const group = groups.find((entry) => entry.code === groupCode);
    const allowedCodes = new Set(
      normaliseComponentCodes(group?.component_codes ?? null),
    );

    const blockItems = items
      .filter((item) => item.category === category)
      .filter((item) => !assigned.has(item.code))
      .filter((item) => {
        if (!groupCode) return true;
        return allowedCodes.has(item.code);
      })
      .sort((left, right) => {
        if ((left.sequence ?? 0) !== (right.sequence ?? 0)) {
          return (left.sequence ?? 0) - (right.sequence ?? 0);
        }
        return (left.name ?? left.code).localeCompare(right.name ?? right.code);
      });

    blockItems.forEach((item) => assigned.add(item.code));
    byBlockId[block.id] = blockItems;
  }

  return byBlockId;
};
