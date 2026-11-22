import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  IconButton,
  Divider,
  Spinner,
  Center,
  Badge,
  Tooltip,
  Input,
  Textarea,
  Checkbox,
  FormControl,
  FormLabel,
  Select,
  useColorModeValue,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Icon,
} from "@chakra-ui/react";
import { Reorder, useDragControls } from "framer-motion";
import {
  Building2,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Type,
  Minus,
  PenLine,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  FileText,
  CheckCircle,
  LayoutTemplate,
  Info,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { ModuleTabs } from "../components/layout/ModuleTabs";
import {
  type BlockType,
  type TemplateBlock,
  type PayComponentGroup,
  resolveBlockItems,
} from "../lib/payTemplateLayout";
import toast from "react-hot-toast";

/* ─────────────────────── Types ──────────────────────────────── */

interface PayTemplate {
  id: number;
  name: string;
  description: string;
  active: boolean;
  layout_json: TemplateBlock[] | null;
}

/* ─────────────────────── Palette definitions ────────────────── */

const PALETTE: Array<{
  type: BlockType;
  label: string;
  Icon: React.ElementType;
  desc: string;
}> = [
  {
    type: "company-header",
    label: "Company Header",
    Icon: Building2,
    desc: "Company logo, name & address",
  },
  {
    type: "employee-info",
    label: "Employee Info",
    Icon: User,
    desc: "Name, ID, position, department",
  },
  {
    type: "pay-period",
    label: "Pay Period",
    Icon: Calendar,
    desc: "Pay period date range & pay date",
  },
  {
    type: "earnings-table",
    label: "Earnings",
    Icon: TrendingUp,
    desc: "Breakdown of all earnings",
  },
  {
    type: "deductions-table",
    label: "Deductions",
    Icon: TrendingDown,
    desc: "Breakdown of all deductions",
  },
  {
    type: "net-summary",
    label: "Net Pay Summary",
    Icon: DollarSign,
    desc: "Gross, deductions, and net pay",
  },
  {
    type: "custom-text",
    label: "Custom Text",
    Icon: Type,
    desc: "Free-form editable text block",
  },
  {
    type: "separator",
    label: "Separator",
    Icon: Minus,
    desc: "Horizontal divider line",
  },
  {
    type: "signature-line",
    label: "Signature Line",
    Icon: PenLine,
    desc: "Prepared by / Received by lines",
  },
];

/* ─────────────────────── Helpers ────────────────────────────── */

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const makeDefaultBlocks = (): TemplateBlock[] => [
  { id: genId(), type: "company-header", config: {} },
  { id: genId(), type: "employee-info", config: {} },
  { id: genId(), type: "pay-period", config: {} },
  { id: genId(), type: "earnings-table", config: {} },
  { id: genId(), type: "deductions-table", config: {} },
  { id: genId(), type: "net-summary", config: {} },
  { id: genId(), type: "separator", config: {} },
  { id: genId(), type: "signature-line", config: {} },
];

/* ─────────────────────── Block preview renders ──────────────── */
interface PreviewRule {
  code: string;
  name: string;
  category: string;
  sequence: number;
  computation_type?: string | null;
  amount?: number | null;
  percentage?: number | null;
  percentage_of_code?: string | null;
  formula?: string | null;
}

const formatPeso = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getPreviewAmountLabel = (rule: PreviewRule) => {
  switch (rule.computation_type) {
    case "fixed":
      return formatPeso(Number(rule.amount ?? 0));
    case "percentage":
      return `${Number(rule.percentage ?? 0)}% of ${rule.percentage_of_code || "rule"}`;
    case "formula":
      return "Computed by formula";
    default:
      return "Computed at pay run";
  }
};

function BlockPreview({
  block,
  previewRows = [],
  groupLabel,
}: {
  block: TemplateBlock;
  previewRows?: PreviewRule[];
  groupLabel?: string | null;
}) {
  const sub = { fontSize: "10px", color: "gray.400" as const };
  const lbl = {
    fontSize: "10px",
    textTransform: "uppercase" as const,
    letterSpacing: "wider" as const,
    mb: 1,
  };
  const mono = { fontFamily: "mono" };
  const cfg = block.config;
  const periodBg = useColorModeValue("gray.50", "gray.700");
  const periodBorder = useColorModeValue("gray.200", "gray.600");
  const showCodes = cfg.showCodes !== false;
  const previewHasDynamicRows = previewRows.some(
    (row) => row.computation_type !== "fixed",
  );
  const previewFixedTotal = previewRows.reduce((sum, row) => {
    if (row.computation_type !== "fixed") return sum;
    return sum + Number(row.amount ?? 0);
  }, 0);

  switch (block.type) {
    case "company-header":
      return (
        <Flex align="center" gap={3}>
          <Center
            w="44px"
            h="44px"
            bg="gray.100"
            rounded="md"
            flexShrink={0}
            color="gray.400"
          >
            <Building2 size={22} />
          </Center>
          <Box flex={1}>
            <Text fontWeight="bold" fontSize="sm">
              ACME Corporation
            </Text>
            {cfg.showAddress !== false && (
              <Text {...sub}>123 Business Ave, Makati City, Metro Manila</Text>
            )}
            {cfg.showTin !== false && <Text {...sub}>TIN: 123-456-789</Text>}
          </Box>
          <Box textAlign="right">
            <Text fontWeight="bold" fontSize="sm" letterSpacing="wider">
              {cfg.title ?? "PAYSLIP"}
            </Text>
            <Badge colorScheme="teal" fontSize="9px">
              Official
            </Badge>
          </Box>
        </Flex>
      );

    case "employee-info": {
      const fields: [string, string][] = [["Employee Name", "Juan Dela Cruz"]];
      if (cfg.showId !== false) fields.push(["Employee ID", "EMP-0042"]);
      if (cfg.showPosition !== false)
        fields.push(["Position", "Software Engineer"]);
      if (cfg.showDepartment !== false)
        fields.push(["Department", "Technology"]);
      return (
        <Box>
          <Text {...lbl} color="gray.500">
            Employee Information
          </Text>
          <Divider mb={2} />
          <Flex gap={6} wrap="wrap">
            {fields.map(([k, v]) => (
              <Box key={k} minW="110px">
                <Text {...sub}>{k}</Text>
                <Text fontSize="xs" fontWeight="medium">
                  {v}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>
      );
    }

    case "pay-period": {
      const cols: [string, string][] = [
        ["Pay Period", "January 1 – January 31, 2025"],
      ];
      if (cfg.showPayDate !== false)
        cols.push(["Pay Date", "February 5, 2025"]);
      if (cfg.showDaysWorked !== false) cols.push(["Days Worked", "22 / 22"]);
      return (
        <Flex
          justify="space-between"
          align="center"
          bg={periodBg}
          px={3}
          py={2}
          rounded="md"
          borderWidth="1px"
          borderColor={periodBorder}
        >
          {cols.map(([k, v]) => (
            <Box key={k}>
              <Text {...sub}>{k}</Text>
              <Text fontSize="xs" fontWeight="semibold">
                {v}
              </Text>
            </Box>
          ))}
        </Flex>
      );
    }

    case "earnings-table":
      return (
        <Box>
          <Text {...lbl} color="green.600">
            {cfg.title ?? "Earnings"}
          </Text>
          {groupLabel && (
            <Badge colorScheme="green" variant="subtle" mb={2} fontSize="9px">
              {groupLabel}
            </Badge>
          )}
          <Divider borderColor="green.200" mb={2} />
          {previewRows.length === 0 ? (
            <Text fontSize="xs" color="gray.400" fontStyle="italic">
              No payroll rules selected for this section.
            </Text>
          ) : (
            previewRows.map((row) => (
              <Flex
                key={row.code}
                justify="space-between"
                py={1}
                borderBottomWidth="1px"
                borderColor="gray.100"
                gap={3}
              >
                <Box minW={0}>
                  {showCodes && (
                    <Text fontSize="10px" color="gray.400" fontFamily="mono">
                      {row.code}
                    </Text>
                  )}
                  <Text fontSize="xs" noOfLines={1}>
                    {row.name}
                  </Text>
                </Box>
                <Text
                  fontSize="xs"
                  fontWeight="medium"
                  color={
                    row.computation_type === "fixed" ? "gray.700" : "gray.500"
                  }
                  textAlign="right"
                  {...mono}
                >
                  {getPreviewAmountLabel(row)}
                </Text>
              </Flex>
            ))
          )}
          <Flex justify="space-between" pt={2}>
            <Text fontSize="xs" fontWeight="bold" color="green.700">
              Gross Earnings
            </Text>
            <Text fontSize="xs" fontWeight="bold" color="green.700" {...mono}>
              {previewRows.length === 0
                ? "—"
                : previewHasDynamicRows
                  ? "Computed at pay run"
                  : formatPeso(previewFixedTotal)}
            </Text>
          </Flex>
        </Box>
      );

    case "deductions-table":
      return (
        <Box>
          <Text {...lbl} color="red.600">
            {cfg.title ?? "Deductions"}
          </Text>
          {groupLabel && (
            <Badge colorScheme="red" variant="subtle" mb={2} fontSize="9px">
              {groupLabel}
            </Badge>
          )}
          <Divider borderColor="red.200" mb={2} />
          {previewRows.length === 0 ? (
            <Text fontSize="xs" color="gray.400" fontStyle="italic">
              No payroll rules selected for this section.
            </Text>
          ) : (
            previewRows.map((row) => (
              <Flex
                key={row.code}
                justify="space-between"
                py={1}
                borderBottomWidth="1px"
                borderColor="gray.100"
                gap={3}
              >
                <Box minW={0}>
                  {showCodes && (
                    <Text fontSize="10px" color="gray.400" fontFamily="mono">
                      {row.code}
                    </Text>
                  )}
                  <Text fontSize="xs" noOfLines={1}>
                    {row.name}
                  </Text>
                </Box>
                <Text
                  fontSize="xs"
                  fontWeight="medium"
                  color={
                    row.computation_type === "fixed" ? "gray.700" : "gray.500"
                  }
                  textAlign="right"
                  {...mono}
                >
                  {getPreviewAmountLabel(row)}
                </Text>
              </Flex>
            ))
          )}
          <Flex justify="space-between" pt={2}>
            <Text fontSize="xs" fontWeight="bold" color="red.700">
              Total Deductions
            </Text>
            <Text fontSize="xs" fontWeight="bold" color="red.700" {...mono}>
              {previewRows.length === 0
                ? "—"
                : previewHasDynamicRows
                  ? "Computed at pay run"
                  : formatPeso(previewFixedTotal)}
            </Text>
          </Flex>
        </Box>
      );

    case "net-summary": {
      const summaries = [
        { label: "Gross Earnings", value: "₱28,500.00", scheme: "green" },
        { label: "Total Deductions", value: "₱4,050.00", scheme: "red" },
        { label: "NET PAY", value: "₱24,450.00", scheme: "teal" },
      ].filter(
        (s) =>
          s.scheme === "teal" ||
          (s.scheme === "green" && cfg.showGross !== false) ||
          (s.scheme === "red" && cfg.showDeductions !== false),
      );
      return (
        <Box>
          <Divider mb={3} />
          <Flex gap={3}>
            {summaries.map((s) => (
              <Box
                key={s.label}
                flex={1}
                bg={`${s.scheme}.50`}
                p={3}
                rounded="md"
                textAlign="center"
              >
                <Text
                  fontSize="9px"
                  color={`${s.scheme}.600`}
                  mb={1}
                  textTransform="uppercase"
                >
                  {s.label}
                </Text>
                <Text
                  fontWeight="bold"
                  fontSize="sm"
                  color={`${s.scheme}.700`}
                  fontFamily="mono"
                >
                  {s.value}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>
      );
    }

    case "custom-text":
      return (
        <Text
          fontSize="xs"
          color={cfg.text ? "gray.700" : "gray.400"}
          fontStyle={cfg.text ? "normal" : "italic"}
          whiteSpace="pre-wrap"
          textAlign={(cfg.align as any) ?? "left"}
        >
          {cfg.text || "Click to add your custom text here…"}
        </Text>
      );

    case "separator":
      return (
        <Divider
          borderColor="gray.300"
          borderStyle={(cfg.style ?? "solid") as any}
        />
      );

    case "signature-line": {
      const sigLabels: string[] = cfg.labels ?? [
        "Prepared by",
        "Checked by",
        "Received by",
      ];
      return (
        <Flex justify="space-around" pt={6}>
          {sigLabels.map((l) => (
            <Box key={l} textAlign="center" w="120px">
              <Divider mb={1} />
              <Text fontSize="10px" color="gray.400">
                {l}
              </Text>
            </Box>
          ))}
        </Flex>
      );
    }

    default:
      return null;
  }
}

/* ─────────────────────── Block inline editor ────────────────── */

function BlockEditor({
  block,
  groups,
  onUpdate,
}: {
  block: TemplateBlock;
  groups: PayComponentGroup[];
  onUpdate: (id: string, cfg: Record<string, any>) => void;
}) {
  const inputBg = useColorModeValue("white", "gray.700");
  const lbl = useColorModeValue("gray.700", "gray.300");
  const topBorder = useColorModeValue("gray.200", "gray.600");
  const cfg = block.config;
  const set = (key: string, val: any) =>
    onUpdate(block.id, { ...cfg, [key]: val });
  const matchingGroups = groups.filter((group) => {
    if (block.type === "earnings-table") {
      return group.category === "earning" || group.category === "mixed";
    }
    if (block.type === "deductions-table") {
      return group.category === "deduction" || group.category === "mixed";
    }
    return true;
  });

  const wrap = (children: ReactNode) => (
    <Box
      mt={3}
      pt={3}
      borderTopWidth="1px"
      borderColor={topBorder}
      onClick={(e) => e.stopPropagation()}
    >
      <VStack align="stretch" spacing={2}>
        {children}
      </VStack>
    </Box>
  );

  switch (block.type) {
    case "company-header":
      return wrap(
        <>
          <FormControl>
            <FormLabel fontSize="xs" color={lbl} mb={1}>
              Header Title
            </FormLabel>
            <Input
              size="sm"
              bg={inputBg}
              value={cfg.title ?? "PAYSLIP"}
              onChange={(e) => set("title", e.target.value)}
            />
          </FormControl>
          <HStack spacing={4}>
            <Checkbox
              size="sm"
              isChecked={cfg.showAddress !== false}
              onChange={(e) => set("showAddress", e.target.checked)}
            >
              <Text fontSize="xs">Show Address</Text>
            </Checkbox>
            <Checkbox
              size="sm"
              isChecked={cfg.showTin !== false}
              onChange={(e) => set("showTin", e.target.checked)}
            >
              <Text fontSize="xs">Show TIN</Text>
            </Checkbox>
          </HStack>
        </>,
      );

    case "employee-info":
      return wrap(
        <HStack spacing={4} flexWrap="wrap">
          <Checkbox
            size="sm"
            isChecked={cfg.showId !== false}
            onChange={(e) => set("showId", e.target.checked)}
          >
            <Text fontSize="xs">Employee ID</Text>
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={cfg.showPosition !== false}
            onChange={(e) => set("showPosition", e.target.checked)}
          >
            <Text fontSize="xs">Position</Text>
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={cfg.showDepartment !== false}
            onChange={(e) => set("showDepartment", e.target.checked)}
          >
            <Text fontSize="xs">Department</Text>
          </Checkbox>
        </HStack>,
      );

    case "pay-period":
      return wrap(
        <HStack spacing={4} flexWrap="wrap">
          <Checkbox
            size="sm"
            isChecked={cfg.showPayDate !== false}
            onChange={(e) => set("showPayDate", e.target.checked)}
          >
            <Text fontSize="xs">Pay Date</Text>
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={cfg.showDaysWorked !== false}
            onChange={(e) => set("showDaysWorked", e.target.checked)}
          >
            <Text fontSize="xs">Days Worked</Text>
          </Checkbox>
        </HStack>,
      );

    case "earnings-table":
      return wrap(
        <>
          <FormControl>
            <FormLabel fontSize="xs" color={lbl} mb={1}>
              Section Title
            </FormLabel>
            <Input
              size="sm"
              bg={inputBg}
              value={cfg.title ?? "Earnings"}
              onChange={(e) => set("title", e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs" color={lbl} mb={1}>
              Rule Group
            </FormLabel>
            <Select
              size="sm"
              bg={inputBg}
              value={cfg.groupCode ?? ""}
              onChange={(e) => set("groupCode", e.target.value)}
            >
              <option value="">All remaining earnings rules</option>
              {matchingGroups.map((group) => (
                <option key={group.id} value={group.code}>
                  {group.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <Checkbox
            size="sm"
            isChecked={cfg.showCodes !== false}
            onChange={(e) => set("showCodes", e.target.checked)}
          >
            <Text fontSize="xs">Show rule codes</Text>
          </Checkbox>
        </>,
      );

    case "deductions-table":
      return wrap(
        <>
          <FormControl>
            <FormLabel fontSize="xs" color={lbl} mb={1}>
              Section Title
            </FormLabel>
            <Input
              size="sm"
              bg={inputBg}
              value={cfg.title ?? "Deductions"}
              onChange={(e) => set("title", e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs" color={lbl} mb={1}>
              Rule Group
            </FormLabel>
            <Select
              size="sm"
              bg={inputBg}
              value={cfg.groupCode ?? ""}
              onChange={(e) => set("groupCode", e.target.value)}
            >
              <option value="">All remaining deduction rules</option>
              {matchingGroups.map((group) => (
                <option key={group.id} value={group.code}>
                  {group.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <Checkbox
            size="sm"
            isChecked={cfg.showCodes !== false}
            onChange={(e) => set("showCodes", e.target.checked)}
          >
            <Text fontSize="xs">Show rule codes</Text>
          </Checkbox>
        </>,
      );

    case "net-summary":
      return wrap(
        <HStack spacing={4} flexWrap="wrap">
          <Checkbox
            size="sm"
            isChecked={cfg.showGross !== false}
            onChange={(e) => set("showGross", e.target.checked)}
          >
            <Text fontSize="xs">Show Gross Earnings</Text>
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={cfg.showDeductions !== false}
            onChange={(e) => set("showDeductions", e.target.checked)}
          >
            <Text fontSize="xs">Show Total Deductions</Text>
          </Checkbox>
        </HStack>,
      );

    case "custom-text":
      return wrap(
        <>
          <Textarea
            value={cfg.text ?? ""}
            onChange={(e) => set("text", e.target.value)}
            placeholder="Enter custom text…"
            size="sm"
            rows={3}
            fontSize="xs"
            bg={inputBg}
          />
          <FormControl>
            <FormLabel fontSize="xs" color={lbl} mb={1}>
              Text Align
            </FormLabel>
            <Select
              size="sm"
              value={cfg.align ?? "left"}
              onChange={(e) => set("align", e.target.value)}
              bg={inputBg}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </Select>
          </FormControl>
        </>,
      );

    case "separator":
      return wrap(
        <FormControl>
          <FormLabel fontSize="xs" color={lbl} mb={1}>
            Line Style
          </FormLabel>
          <Select
            size="sm"
            value={cfg.style ?? "solid"}
            onChange={(e) => set("style", e.target.value)}
            bg={inputBg}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </Select>
        </FormControl>,
      );

    case "signature-line": {
      const sigLabels: string[] = cfg.labels ?? [
        "Prepared by",
        "Checked by",
        "Received by",
      ];
      return wrap(
        <>
          <Text fontSize="xs" color={lbl} fontWeight="semibold">
            Signature Labels
          </Text>
          {sigLabels.map((sigLabel, i) => (
            <Input
              key={i}
              size="sm"
              bg={inputBg}
              value={sigLabel}
              onChange={(e) => {
                const next = [...sigLabels];
                next[i] = e.target.value;
                set("labels", next);
              }}
              placeholder={`Label ${i + 1}`}
            />
          ))}
        </>,
      );
    }

    default:
      return null;
  }
}

/* ─────────────────────── Draggable block card ───────────────── */

interface BlockItemProps {
  block: TemplateBlock;
  isActive: boolean;
  groups: PayComponentGroup[];
  previewRows?: PreviewRule[];
  groupLabel?: string | null;
  onActivate: (id: string | null) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, cfg: Record<string, any>) => void;
}

function BlockItem({
  block,
  isActive,
  groups,
  previewRows,
  groupLabel,
  onActivate,
  onRemove,
  onUpdate,
}: BlockItemProps) {
  const controls = useDragControls();
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const active = useColorModeValue("cyan.400", "cyan.500");
  const barBg = useColorModeValue("gray.50", "gray.750");
  const gripColor = useColorModeValue("gray.400", "gray.500");
  const meta = PALETTE.find((p) => p.type === block.type);

  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={controls}
      as="div"
      style={{ listStyle: "none", userSelect: "none", marginBottom: "8px" }}
    >
      <Box
        bg={bg}
        borderWidth="1.5px"
        borderColor={isActive ? active : border}
        rounded="lg"
        overflow="hidden"
        boxShadow={isActive ? `0 0 0 3px rgba(0,188,212,0.18)` : "sm"}
        transition="border-color 0.15s, box-shadow 0.15s"
        onClick={() => onActivate(isActive ? null : block.id)}
        cursor="default"
      >
        {/* drag handle + label + delete */}
        <Flex
          bg={barBg}
          px={3}
          py={1.5}
          align="center"
          justify="space-between"
          borderBottomWidth="1px"
          borderColor={border}
        >
          <HStack spacing={2}>
            <Box
              color={gripColor}
              cursor="grab"
              onPointerDown={(e) => {
                e.stopPropagation();
                controls.start(e);
              }}
              _active={{ cursor: "grabbing", color: "gray.600" }}
            >
              <GripVertical size={14} />
            </Box>
            {meta && (
              <HStack spacing={1.5} color="gray.500">
                <meta.Icon size={12} />
                <Text
                  fontSize="10px"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {meta.label}
                </Text>
              </HStack>
            )}
          </HStack>
          <IconButton
            aria-label="Remove block"
            icon={<Trash2 size={12} />}
            size="xs"
            variant="ghost"
            colorScheme="red"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(block.id);
            }}
          />
        </Flex>

        {/* content */}
        <Box px={4} py={3}>
          <BlockPreview
            block={block}
            previewRows={previewRows}
            groupLabel={groupLabel}
          />
          {isActive && (
            <BlockEditor block={block} groups={groups} onUpdate={onUpdate} />
          )}
        </Box>
      </Box>
    </Reorder.Item>
  );
}

/* ─────────────────────── Preview modal ──────────────────────── */

function PreviewModal({
  templateName,
  blocks,
  groups,
  previewRowsByBlockId,
  isOpen,
  onClose,
}: {
  templateName: string;
  blocks: TemplateBlock[];
  groups: PayComponentGroup[];
  previewRowsByBlockId: Record<string, PreviewRule[]>;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">
          Payslip Preview — {templateName}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Box
            bg="white"
            color="gray.800"
            p={8}
            mx="auto"
            maxW="640px"
            boxShadow="lg"
            rounded="md"
            borderWidth="1px"
            borderColor="gray.200"
          >
            {blocks.map((block) => (
              <Box key={block.id} mb={block.type === "separator" ? 3 : 5}>
                <BlockPreview
                  block={block}
                  previewRows={previewRowsByBlockId[block.id] ?? []}
                  groupLabel={
                    groups.find(
                      (group) => group.code === block.config?.groupCode,
                    )?.name ?? null
                  }
                />
              </Box>
            ))}
          </Box>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            colorScheme="teal"
            size="sm"
            leftIcon={<Eye size={14} />}
            isDisabled
          >
            Print (Coming Soon)
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ─────────────────────── Canvas editor ─────────────────────── */

function TemplateEditor({
  template,
  onSaved,
}: {
  template: PayTemplate;
  onSaved: (updated: PayTemplate) => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [blocks, setBlocks] = useState<TemplateBlock[]>(() =>
    template.layout_json && template.layout_json.length > 0
      ? template.layout_json
      : makeDefaultBlocks(),
  );
  const [rules, setRules] = useState<PreviewRule[]>([]);
  const [groups, setGroups] = useState<PayComponentGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    isOpen: isPrevOpen,
    onOpen: onPrevOpen,
    onClose: onPrevClose,
  } = useDisclosure();

  const palBg = useColorModeValue("gray.50", "gray.850");
  const palBorder = useColorModeValue("gray.200", "gray.700");
  const palItemBg = useColorModeValue("white", "gray.800");
  const palItemHov = useColorModeValue("cyan.50", "gray.700");
  const canvasBg = useColorModeValue("gray.100", "gray.900");
  const paperBg = useColorModeValue("white", "gray.800");
  const subText = useColorModeValue("gray.500", "gray.400");
  const textColor = useColorModeValue("gray.800", "gray.100");

  useEffect(() => {
    let cancelled = false;

    const loadPreviewReferences = async () => {
      const [ruleResult, groupResult] = await Promise.allSettled([
        supabase
          .from("pay_components")
          .select(
            "code, name, category, sequence, computation_type, amount, percentage, percentage_of_code, formula",
          )
          .eq("pay_template_id", template.id)
          .eq("active", true)
          .order("sequence", { ascending: true }),
        supabase
          .from("pay_component_groups")
          .select(
            "id, name, code, category, component_codes, description, active",
          )
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;

      if (ruleResult.status === "fulfilled" && !ruleResult.value.error) {
        setRules((ruleResult.value.data as PreviewRule[] | null) || []);
      } else {
        setRules([]);
      }

      if (groupResult.status === "fulfilled" && !groupResult.value.error) {
        setGroups((groupResult.value.data as PayComponentGroup[] | null) || []);
      } else {
        setGroups([]);
      }
    };

    void loadPreviewReferences();

    return () => {
      cancelled = true;
    };
  }, [template.id]);

  const previewRowsByBlockId = useMemo(
    () => resolveBlockItems(blocks, rules, groups),
    [blocks, rules, groups],
  );

  const addBlock = useCallback((type: BlockType) => {
    setBlocks((prev) => [...prev, { id: genId(), type, config: {} }]);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setActiveId(null);
  }, []);

  const updateBlock = useCallback((id: string, cfg: Record<string, any>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, config: cfg } : b)),
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("pay_templates")
        .update({
          name: name.trim() || template.name,
          description: description.trim(),
          layout_json: blocks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id)
        .select()
        .single();
      if (error) throw error;
      toast.success("Template saved!");
      onSaved(data as PayTemplate);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box display="flex" flexDir="column" h="100%">
      {/* ── toolbar ── */}
      <Flex
        px={4}
        py={2}
        bg={palBg}
        borderBottomWidth="1px"
        borderColor={palBorder}
        align="center"
        gap={3}
        flexShrink={0}
      >
        <Box flex={1}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="flushed"
            fontWeight="semibold"
            fontSize="sm"
            placeholder="Template name"
            maxW="280px"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            variant="flushed"
            fontSize="xs"
            color={subText}
            placeholder="Optional description…"
            maxW="280px"
          />
        </Box>
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Eye size={13} />}
            onClick={onPrevOpen}
            isDisabled={blocks.length === 0}
          >
            Preview
          </Button>
          <Button
            size="sm"
            colorScheme="teal"
            leftIcon={<Save size={13} />}
            onClick={handleSave}
            isLoading={saving}
          >
            Save
          </Button>
        </HStack>
      </Flex>

      {/* ── palette | canvas ── */}
      <Flex flex={1} overflow="hidden">
        {/* Palette */}
        <Box
          w="200px"
          flexShrink={0}
          bg={palBg}
          borderRightWidth="1px"
          borderColor={palBorder}
          overflowY="auto"
          p={3}
        >
          <Text
            fontSize="9px"
            fontWeight="bold"
            color={subText}
            textTransform="uppercase"
            letterSpacing="wider"
            mb={3}
          >
            Blocks
          </Text>
          <VStack spacing={1} align="stretch">
            {PALETTE.map(({ type, label, Icon, desc }) => (
              <Tooltip
                key={type}
                label={desc}
                placement="right"
                hasArrow
                openDelay={400}
              >
                <Flex
                  align="center"
                  gap={2}
                  p={2}
                  rounded="md"
                  bg={palItemBg}
                  cursor="pointer"
                  _hover={{ bg: palItemHov }}
                  transition="background 0.12s"
                  onClick={() => addBlock(type)}
                  role="button"
                >
                  <Box color="gray.500" flexShrink={0}>
                    <Icon size={13} />
                  </Box>
                  <Text
                    fontSize="11px"
                    fontWeight="medium"
                    color={textColor}
                    flex={1}
                    noOfLines={1}
                  >
                    {label}
                  </Text>
                  <Box color="gray.400" flexShrink={0}>
                    <Plus size={11} />
                  </Box>
                </Flex>
              </Tooltip>
            ))}
          </VStack>
          <Divider my={4} />
          <Text
            fontSize="9px"
            color={subText}
            textAlign="center"
            lineHeight="short"
          >
            Click to add · Drag to reorder
          </Text>
        </Box>

        {/* Canvas */}
        <Box flex={1} bg={canvasBg} overflowY="auto" p={6}>
          <Box
            maxW="660px"
            mx="auto"
            bg={paperBg}
            rounded="xl"
            boxShadow="0 8px 32px rgba(0,0,0,0.12)"
            px={8}
            py={8}
            minH="500px"
          >
            {blocks.length === 0 ? (
              <Center flexDir="column" gap={3} color={subText} h="300px">
                <LayoutTemplate size={48} strokeWidth={1} />
                <Text fontSize="sm">
                  Click blocks in the palette to build your payslip
                </Text>
              </Center>
            ) : (
              <Reorder.Group
                axis="y"
                values={blocks}
                onReorder={setBlocks}
                as="div"
                style={{ listStyle: "none", padding: 0, margin: 0 }}
              >
                {blocks.map((block) => (
                  <BlockItem
                    key={block.id}
                    block={block}
                    isActive={activeId === block.id}
                    groups={groups}
                    previewRows={previewRowsByBlockId[block.id] ?? []}
                    groupLabel={
                      groups.find(
                        (group) => group.code === block.config?.groupCode,
                      )?.name ?? null
                    }
                    onActivate={setActiveId}
                    onRemove={removeBlock}
                    onUpdate={updateBlock}
                  />
                ))}
              </Reorder.Group>
            )}
          </Box>
        </Box>
      </Flex>

      {isPrevOpen && (
        <PreviewModal
          templateName={name || template.name}
          blocks={blocks}
          groups={groups}
          previewRowsByBlockId={previewRowsByBlockId}
          isOpen={isPrevOpen}
          onClose={onPrevClose}
        />
      )}
    </Box>
  );
}

/* ─────────────────────── Main page ──────────────────────────── */

export const PayTemplatesPage = () => {
  const [templates, setTemplates] = useState<PayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

  const bg = useColorModeValue("gray.50", "gray.900");
  const listBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const activeBg = useColorModeValue("cyan.50", "gray.700");
  const activeB = useColorModeValue("cyan.400", "cyan.500");
  const subText = useColorModeValue("gray.500", "gray.400");
  const textColor = useColorModeValue("gray.800", "gray.100");
  const linkBannerBg = useColorModeValue("cyan.50", "gray.750");
  const linkBannerBorder = useColorModeValue("cyan.200", "cyan.800");
  const linkBannerText = useColorModeValue("cyan.800", "cyan.200");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pay_templates")
      .select("*")
      .order("name");
    if (!error) setTemplates((data ?? []) as PayTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async () => {
    const nm = newName.trim();
    if (!nm) return;
    setCreating(true);
    const defaultBlocks = makeDefaultBlocks();
    const { data, error } = await supabase
      .from("pay_templates")
      .insert({
        name: nm,
        description: "",
        active: true,
        layout_json: defaultBlocks,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const created = data as PayTemplate;
    setTemplates((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setNewName("");
    onClose();
    setSelected(created);
    toast.success("Template created!");
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this template? This cannot be undone.")) return;
    const { error } = await supabase
      .from("pay_templates")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selected?.id === id) setSelected(null);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted");
  };

  const editorHeight = "calc(100vh - 220px)";

  return (
    <Box>
      <HStack spacing={2} align="center" mb={4}>
        <Heading size="lg" color={textColor}>
          Pay Templates
        </Heading>
        <Tooltip
          label="A Pay Template defines the payslip layout (via the block canvas) and which Payroll Rules run for employees assigned to it. Think of it as the payroll 'profile' — the template controls both how the payslip looks and what gets computed."
          fontSize="xs"
          maxW="340px"
          placement="right"
          hasArrow
        >
          <Box as="span" cursor="help" color={subText}>
            <Icon as={Info} boxSize={4} />
          </Box>
        </Tooltip>
      </HStack>
      <ModuleTabs section="payroll" activeTab="config" />

      <Flex
        mt={3}
        mb={2}
        p={3}
        rounded="lg"
        bg={linkBannerBg}
        border="1px solid"
        borderColor={linkBannerBorder}
        align="center"
        justify="space-between"
        gap={4}
      >
        <Box flex={1}>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color={linkBannerText}
            mb={0.5}
          >
            Templates run Payroll Rules
          </Text>
          <Text fontSize="xs" color={linkBannerText} opacity={0.85}>
            The block canvas here defines the payslip layout. The actual salary
            computation (Basic Pay, SSS, tax formulas, etc.) is defined in
            Payroll Rules — each rule belongs to a template and runs
            automatically when you click Compute on a Pay Run.
          </Text>
        </Box>
        <Button
          size="sm"
          colorScheme="teal"
          variant="outline"
          rightIcon={<ArrowRight size={13} />}
          flexShrink={0}
          onClick={() => navigate("/payroll/config/pay-components")}
        >
          Payroll Rules
        </Button>
      </Flex>

      <Flex
        mt={4}
        h={editorHeight}
        minH="560px"
        rounded="xl"
        overflow="hidden"
        borderWidth="1px"
        borderColor={border}
        boxShadow="sm"
      >
        {/* ── Template list ── */}
        <Box
          w="260px"
          flexShrink={0}
          bg={listBg}
          borderRightWidth="1px"
          borderColor={border}
          display="flex"
          flexDir="column"
        >
          {/* list header */}
          <Flex
            px={3}
            py={3}
            align="center"
            justify="space-between"
            borderBottomWidth="1px"
            borderColor={border}
          >
            <HStack spacing={2}>
              <FileText size={14} />
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="wider"
                color={subText}
              >
                Templates
              </Text>
            </HStack>
            <Tooltip label="New template" hasArrow>
              <IconButton
                aria-label="New template"
                icon={<Plus size={14} />}
                size="xs"
                colorScheme="teal"
                variant="ghost"
                onClick={onOpen}
              />
            </Tooltip>
          </Flex>

          {/* list body */}
          <Box flex={1} overflowY="auto">
            {loading ? (
              <Center py={8}>
                <Spinner size="sm" color="teal.400" />
              </Center>
            ) : templates.length === 0 ? (
              <Center py={8} flexDir="column" gap={2} color={subText}>
                <LayoutTemplate size={28} strokeWidth={1} />
                <Text fontSize="xs">No templates yet</Text>
                <Button size="xs" colorScheme="teal" onClick={onOpen}>
                  Create one
                </Button>
              </Center>
            ) : (
              templates.map((t) => {
                const isSel = selected?.id === t.id;
                return (
                  <Flex
                    key={t.id}
                    px={3}
                    py={2.5}
                    align="center"
                    cursor="pointer"
                    bg={isSel ? activeBg : "transparent"}
                    borderLeftWidth="3px"
                    borderLeftColor={isSel ? activeB : "transparent"}
                    _hover={{
                      bg: isSel
                        ? activeBg
                        : useColorModeValue("gray.50", "gray.750"),
                    }}
                    onClick={() => setSelected(t)}
                    role="button"
                    gap={2}
                  >
                    <Box flex={1} minW={0}>
                      <Text
                        fontSize="sm"
                        fontWeight={isSel ? "semibold" : "normal"}
                        color={textColor}
                        noOfLines={1}
                      >
                        {t.name}
                      </Text>
                      <HStack spacing={1} mt={0.5}>
                        <Badge
                          colorScheme={t.active ? "green" : "gray"}
                          fontSize="9px"
                          rounded="full"
                        >
                          {t.active ? "Active" : "Inactive"}
                        </Badge>
                        {t.layout_json && (
                          <Badge
                            colorScheme="teal"
                            fontSize="9px"
                            variant="subtle"
                          >
                            {t.layout_json.length}b
                          </Badge>
                        )}
                      </HStack>
                    </Box>
                    <IconButton
                      aria-label="Delete"
                      icon={<Trash2 size={12} />}
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      opacity={isSel ? 1 : 0}
                      _groupHover={{ opacity: 1 }}
                      onClick={(e) => handleDelete(t.id, e)}
                    />
                  </Flex>
                );
              })
            )}
          </Box>
        </Box>

        {/* ── Editor pane ── */}
        <Box flex={1} overflow="hidden" bg={bg}>
          {selected ? (
            <TemplateEditor
              key={selected.id}
              template={selected}
              onSaved={(updated) => {
                setTemplates((prev) =>
                  prev.map((t) => (t.id === updated.id ? updated : t)),
                );
                setSelected(updated);
              }}
            />
          ) : (
            <Center h="100%" flexDir="column" gap={3} color={subText}>
              <CheckCircle size={48} strokeWidth={1} />
              <Text fontSize="sm" fontWeight="medium">
                Select a template to edit its layout
              </Text>
              <Text fontSize="xs">Or create a new one with the + button</Text>
            </Center>
          )}
        </Box>
      </Flex>

      {/* Create modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">New Pay Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder='e.g. "Regular Monthly Pay"'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              size="sm"
              onClick={handleCreate}
              isLoading={creating}
              isDisabled={!newName.trim()}
            >
              Create & Open Editor
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};
