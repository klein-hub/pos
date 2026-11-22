import { useEffect, useRef, useState, forwardRef } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Input as ChakraInput,
  Textarea,
  NumberInput,
  NumberInputField,
  Select,
  Switch,
  FormControl,
  FormLabel,
  useColorModeValue,
  Badge,
  Divider,
  Tooltip,
  Icon,
  Button,
} from "@chakra-ui/react";
import { Plus, Info } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface PayComponentFormValue {
  id?: any;
  pay_template_id?: number | null;
  name: string;
  code: string;
  category: "earning" | "deduction" | "net";
  sequence: number;
  condition_type: "always" | "input" | "expression";
  condition_expression: string;
  active: boolean;
  computation_type: "fixed" | "percentage" | "formula";
  amount: number;
  percentage: number;
  percentage_of_code: string;
  formula: string;
  // retained for schema compatibility
  pay_constant_id?: number | null;
}

export const emptyPayComponent = (): PayComponentFormValue => ({
  pay_template_id: null,
  name: "",
  code: "",
  category: "earning",
  sequence: 10,
  condition_type: "always",
  condition_expression: "",
  active: true,
  computation_type: "fixed",
  amount: 0,
  percentage: 0,
  percentage_of_code: "",
  formula: "",
  pay_constant_id: null,
});

interface Props {
  value: PayComponentFormValue;
  onChange: (next: PayComponentFormValue) => void;
}

const BUILTIN_TOKENS = [
  "BASE_PAY",
  "MONTHLY_RATE",
  "DAILY_RATE",
  "HOURLY_RATE",
  "MINUTE_RATE",
  "REGULAR_HOURS",
  "OVERTIME_HOURS",
  "NIGHT_DIFF_HOURS",
  "TARDINESS_MINUTES",
  "TARDINESS_RATE",
  "TARDINESS_AMOUNT",
];

const CONDITION_OPERATORS = [
  { label: "=", value: " == " },
  { label: "!=", value: " != " },
  { label: ">", value: " > " },
  { label: "<", value: " < " },
  { label: ">=", value: " >= " },
  { label: "<=", value: " <= " },
  { label: "AND", value: " && " },
  { label: "OR", value: " || " },
];

export const PayComponentForm = ({ value, onChange }: Props) => {
  const [codes, setCodes] = useState<
    { code: string; name: string; category: string }[]
  >([]);
  const [constantCodes, setConstantCodes] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>(
    [],
  );
  const conditionRef = useRef<HTMLInputElement>(null);
  const formulaRef = useRef<HTMLTextAreaElement>(null);

  const label = useColorModeValue("gray.700", "gray.300");
  const subtle = useColorModeValue("gray.500", "gray.400");
  const inputBg = useColorModeValue("white", "gray.700");
  const chipBg = useColorModeValue("blue.50", "blue.900");
  const chipColor = useColorModeValue("blue.700", "blue.200");
  const chipHoverBg = useColorModeValue("blue.100", "blue.800");
  const opBg = useColorModeValue("gray.100", "gray.700");
  const opHoverBg = useColorModeValue("gray.200", "gray.600");
  const sectionBg = useColorModeValue("gray.50", "gray.900");
  const sectionBorder = useColorModeValue("gray.200", "gray.600");

  useEffect(() => {
    const loadReferences = async () => {
      const [componentResult, constantResult, templateResult] =
        await Promise.all([
          supabase
            .from("pay_components")
            .select("code, name, category")
            .order("sequence", { ascending: true }),
          supabase
            .from("pay_constants")
            .select("code")
            .eq("active", true)
            .order("code", { ascending: true }),
          supabase
            .from("pay_templates")
            .select("id, name")
            .order("name", { ascending: true }),
        ]);

      setCodes(componentResult.data || []);
      setConstantCodes(
        ((constantResult.data as { code: string }[] | null) || [])
          .map((row) => row.code)
          .filter(Boolean),
      );
      setTemplates(
        (templateResult.data as { id: number; name: string }[] | null) || [],
      );
    };

    void loadReferences();
  }, []);

  const set = <K extends keyof PayComponentFormValue>(
    key: K,
    v: PayComponentFormValue[K],
  ) => onChange({ ...value, [key]: v });

  const availableCodes = codes.filter((c) => c.code && c.code !== value.code);
  const allTokens = Array.from(
    new Set([
      ...BUILTIN_TOKENS,
      ...constantCodes.filter((code) => code && code !== value.code),
      ...availableCodes.map((c) => c.code),
    ]),
  );

  const applyTardinessPreset = () => {
    onChange({
      ...value,
      name: "Tardiness",
      code: "TARDINESS",
      category: "deduction",
      sequence: value.sequence || 140,
      condition_type: "expression",
      condition_expression: "TARDINESS_MINUTES > 0",
      active: true,
      computation_type: "formula",
      amount: 0,
      percentage: 0,
      percentage_of_code: "",
      formula:
        "(BASE_PAY / WORKING_DAYS_PER_MONTH) * TARDINESS_RATE_FACTOR * TARDINESS_MINUTES",
    });
  };

  const insertInto = (
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    key: "condition_expression" | "formula",
    text: string,
  ) => {
    const el = ref.current;
    const current = (value[key] as string) || "";
    if (!el) {
      set(key, current + text);
      return;
    }
    const start = (el as any).selectionStart ?? current.length;
    const end = (el as any).selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    set(key, next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      (el as any).setSelectionRange?.(pos, pos);
    });
  };

  const CATEGORIES: Array<{
    id: PayComponentFormValue["category"];
    label: string;
    scheme: string;
  }> = [
    { id: "earning", label: "Earning", scheme: "green" },
    { id: "deduction", label: "Deduction", scheme: "red" },
    { id: "net", label: "Net", scheme: "blue" },
  ];

  const COMPUTATION_TYPES: Array<{
    id: PayComponentFormValue["computation_type"];
    label: string;
  }> = [
    { id: "fixed", label: "Fixed ₱" },
    { id: "percentage", label: "Percentage %" },
    { id: "formula", label: "Formula" },
  ];

  return (
    <VStack align="stretch" spacing={5}>
      <Flex
        justify="space-between"
        align={{ base: "stretch", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={3}
      >
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color={label}>
            Payroll Rule Setup
          </Text>
          <Text fontSize="xs" color={subtle}>
            Choose a pay template, then use the tardiness preset if you want a
            deduction that only appears when late minutes exist.
          </Text>
        </Box>
        <Button
          size="sm"
          variant="outline"
          colorScheme="orange"
          onClick={applyTardinessPreset}
        >
          Use Tardiness Preset
        </Button>
      </Flex>

      {/* Name + Code + Template + Sequence */}
      <HStack spacing={3} align="flex-end">
        <FormControl flex={2}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Rule name
          </FormLabel>
          <ChakraInput
            placeholder="e.g. Basic Pay"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            bg={inputBg}
          />
        </FormControl>
        <FormControl flex={1}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Code
          </FormLabel>
          <ChakraInput
            placeholder="BASIC"
            value={value.code}
            onChange={(e) =>
              set(
                "code",
                e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
              )
            }
            bg={inputBg}
            fontFamily="mono"
          />
        </FormControl>
        <FormControl flex={1.4}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Pay Template
          </FormLabel>
          <Select
            value={value.pay_template_id ?? ""}
            onChange={(e) =>
              set(
                "pay_template_id",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            bg={inputBg}
            placeholder="Select template…"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW="90px">
          <FormLabel fontSize="xs" color={label} mb={1}>
            Seq
          </FormLabel>
          <NumberInput
            value={value.sequence}
            onChange={(_, n) => set("sequence", Number.isNaN(n) ? 0 : n)}
            min={0}
            bg={inputBg}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      </HStack>

      {/* Category + When applies + Active */}
      <HStack spacing={3} align="flex-start">
        <FormControl flex={1}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Category
          </FormLabel>
          <HStack spacing={1}>
            {CATEGORIES.map((c) => (
              <Button
                key={c.id}
                size="sm"
                flex={1}
                colorScheme={value.category === c.id ? c.scheme : "gray"}
                variant={value.category === c.id ? "solid" : "outline"}
                onClick={() => set("category", c.id)}
                fontSize="xs"
              >
                {c.label}
              </Button>
            ))}
          </HStack>
        </FormControl>
        <FormControl w="160px">
          <FormLabel fontSize="xs" color={label} mb={1}>
            When applies
          </FormLabel>
          <Select
            value={value.condition_type}
            onChange={(e) =>
              set(
                "condition_type",
                e.target.value as PayComponentFormValue["condition_type"],
              )
            }
            bg={inputBg}
            size="sm"
          >
            <option value="always">Always</option>
            <option value="input">On Input</option>
            <option value="expression">Expression</option>
          </Select>
        </FormControl>
        <FormControl w="70px">
          <FormLabel fontSize="xs" color={label} mb={1}>
            Active
          </FormLabel>
          <Switch
            isChecked={value.active}
            onChange={(e) => set("active", e.target.checked)}
            colorScheme="blue"
            mt={1}
          />
        </FormControl>
      </HStack>

      {/* Condition expression */}
      {value.condition_type === "expression" && (
        <Box
          p={3}
          bg={sectionBg}
          rounded="md"
          border="1px solid"
          borderColor={sectionBorder}
        >
          <Flex align="center" gap={1.5} mb={2}>
            <Text fontSize="xs" color={subtle} fontWeight="semibold">
              Condition Expression
            </Text>
            <Tooltip
              label="Click tokens and operators to build the rule."
              fontSize="xs"
            >
              <Box as="span">
                <Icon as={Info} boxSize={3} color={subtle} />
              </Box>
            </Tooltip>
          </Flex>
          <ChakraInput
            ref={conditionRef}
            placeholder="e.g. BASIC > 0 && OVERTIME > 0"
            value={value.condition_expression}
            onChange={(e) => set("condition_expression", e.target.value)}
            bg={inputBg}
            fontFamily="mono"
            fontSize="sm"
            size="sm"
          />
          <TokenChips
            tokens={allTokens}
            onInsert={(t) =>
              insertInto(conditionRef, "condition_expression", t)
            }
            chipBg={chipBg}
            chipColor={chipColor}
            chipHoverBg={chipHoverBg}
            subtle={subtle}
          />
          <OpChips
            operators={CONDITION_OPERATORS}
            onInsert={(op) =>
              insertInto(conditionRef, "condition_expression", op)
            }
            bg={opBg}
            hoverBg={opHoverBg}
            color={label}
          />
        </Box>
      )}

      {/* Computation type */}
      <FormControl>
        <FormLabel fontSize="xs" color={label} mb={1}>
          Computation
        </FormLabel>
        <HStack spacing={1}>
          {COMPUTATION_TYPES.map((ct) => (
            <Button
              key={ct.id}
              size="sm"
              flex={1}
              colorScheme="purple"
              variant={value.computation_type === ct.id ? "solid" : "outline"}
              onClick={() => set("computation_type", ct.id)}
              fontSize="xs"
            >
              {ct.label}
            </Button>
          ))}
        </HStack>
      </FormControl>

      {/* Fixed amount */}
      {value.computation_type === "fixed" && (
        <FormControl>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Fixed Amount (₱)
          </FormLabel>
          <NumberInput
            value={value.amount ?? 0}
            onChange={(_, n) => set("amount", Number.isNaN(n) ? 0 : n)}
            min={0}
            bg={inputBg}
          >
            <NumberInputField placeholder="0.00" />
          </NumberInput>
        </FormControl>
      )}

      {/* Percentage */}
      {value.computation_type === "percentage" && (
        <HStack spacing={3} align="flex-end">
          <FormControl flex={1}>
            <FormLabel fontSize="xs" color={label} mb={1}>
              Percentage (%)
            </FormLabel>
            <NumberInput
              value={value.percentage ?? 0}
              onChange={(_, n) => set("percentage", Number.isNaN(n) ? 0 : n)}
              min={0}
              max={100}
              bg={inputBg}
            >
              <NumberInputField placeholder="e.g. 4.5" />
            </NumberInput>
          </FormControl>
          <FormControl flex={2}>
            <FormLabel fontSize="xs" color={label} mb={1}>
              Of rule
            </FormLabel>
            <Select
              value={value.percentage_of_code ?? ""}
              onChange={(e) => set("percentage_of_code", e.target.value)}
              bg={inputBg}
              placeholder="Select rule…"
            >
              {availableCodes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </FormControl>
        </HStack>
      )}

      {/* Formula */}
      {value.computation_type === "formula" && (
        <Box
          p={3}
          bg={sectionBg}
          rounded="md"
          border="1px solid"
          borderColor={sectionBorder}
        >
          <Flex align="center" gap={1.5} mb={2}>
            <Text fontSize="xs" color={subtle} fontWeight="semibold">
              Formula Expression
            </Text>
            <Tooltip
              label="Click tokens to insert them into the formula."
              fontSize="xs"
            >
              <Box as="span">
                <Icon as={Info} boxSize={3} color={subtle} />
              </Box>
            </Tooltip>
          </Flex>
          <FormulaTextarea
            ref={formulaRef}
            value={value.formula ?? ""}
            onChange={(v) => set("formula", v)}
            bg={inputBg}
            placeholder="e.g. BASE_PAY * 0.25 + OVERTIME_HOURS * 62.5"
          />
          <TokenChips
            tokens={allTokens}
            onInsert={(t) => insertInto(formulaRef, "formula", t)}
            chipBg={chipBg}
            chipColor={chipColor}
            chipHoverBg={chipHoverBg}
            subtle={subtle}
          />
          <OpChips
            operators={[
              { label: "+", value: " + " },
              { label: "-", value: " - " },
              { label: "*", value: " * " },
              { label: "/", value: " / " },
              { label: "(", value: "(" },
              { label: ")", value: ")" },
            ]}
            onInsert={(op) => insertInto(formulaRef, "formula", op)}
            bg={opBg}
            hoverBg={opHoverBg}
            color={label}
          />
        </Box>
      )}
    </VStack>
  );
};

/* ─── Helpers ─── */

const TokenChips = ({
  tokens,
  onInsert,
  chipBg,
  chipColor,
  chipHoverBg,
  subtle,
}: {
  tokens: string[];
  onInsert: (v: string) => void;
  chipBg: string;
  chipColor: string;
  chipHoverBg: string;
  subtle: string;
}) => (
  <Flex wrap="wrap" gap={1.5} mt={2}>
    {tokens.length === 0 && (
      <Text fontSize="xs" color={subtle}>
        No payroll rules yet.
      </Text>
    )}
    {tokens.map((t) => (
      <Badge
        key={t}
        px={2}
        py={0.5}
        rounded="md"
        bg={chipBg}
        color={chipColor}
        cursor="pointer"
        fontFamily="mono"
        fontSize="xs"
        textTransform="none"
        fontWeight="medium"
        _hover={{ bg: chipHoverBg }}
        onClick={() => onInsert(t)}
        display="inline-flex"
        alignItems="center"
        gap={1}
      >
        <Plus size={9} />
        {t}
      </Badge>
    ))}
  </Flex>
);

const OpChips = ({
  operators,
  onInsert,
  bg,
  hoverBg,
  color,
}: {
  operators: { label: string; value: string }[];
  onInsert: (v: string) => void;
  bg: string;
  hoverBg: string;
  color: string;
}) => (
  <Box mt={2}>
    <Divider mb={2} />
    <Flex wrap="wrap" gap={1}>
      {operators.map((op) => (
        <Box
          key={op.label}
          as="button"
          type="button"
          px={2.5}
          py={0.5}
          rounded="md"
          bg={bg}
          color={color}
          fontFamily="mono"
          fontSize="sm"
          fontWeight="semibold"
          _hover={{ bg: hoverBg }}
          onClick={() => onInsert(op.value)}
          minW="32px"
        >
          {op.label}
        </Box>
      ))}
    </Flex>
  </Box>
);

const FormulaTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    bg: string;
    placeholder?: string;
  }
>(({ value, onChange, bg, placeholder }, ref) => (
  <Textarea
    ref={ref}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    fontFamily="mono"
    fontSize="sm"
    rows={3}
    bg={bg}
    resize="vertical"
  />
));
FormulaTextarea.displayName = "FormulaTextarea";
