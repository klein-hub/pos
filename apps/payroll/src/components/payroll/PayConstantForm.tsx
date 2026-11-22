import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Input as ChakraInput,
  Select,
  Switch,
  Textarea,
  FormControl,
  FormLabel,
  useColorModeValue,
  Badge,
  Icon,
  IconButton,
  Button,
  Divider,
  Tooltip,
} from "@chakra-ui/react";
import {
  Tag,
  Calculator,
  Hash,
  Sigma,
  Plus,
  X,
  ArrowRight,
  GripVertical,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

export type TokenType = "constant" | "number" | "op";

export type FormulaToken =
  | { type: "constant"; code: string }
  | { type: "number"; val: number }
  | { type: "op"; op: string };

export interface PayConstantFormValue {
  id?: any;
  name: string;
  code: string;
  value: number | string;
  category: string;
  description: string;
  value_type: "constant" | "formula";
  formula_tokens: FormulaToken[] | string | null;
  active: boolean;
}

export const emptyPayConstant = (): PayConstantFormValue => ({
  name: "",
  code: "",
  value: 0,
  category: "general",
  description: "",
  value_type: "constant",
  formula_tokens: [],
  active: true,
});

interface Props {
  value: PayConstantFormValue;
  onChange: (next: PayConstantFormValue) => void;
}

const OPERATORS = ["+", "-", "*", "/", "(", ")"];

const CATEGORY_OPTIONS = [
  { value: "working_hours", label: "Working Hours" },
  { value: "overtime", label: "Overtime" },
  { value: "rest_day_holiday", label: "Rest Day / Holiday" },
  { value: "night_diff", label: "Night Differential" },
  { value: "thirteenth_month", label: "13th Month" },
  { value: "sss", label: "SSS" },
  { value: "philhealth", label: "PhilHealth" },
  { value: "pagibig", label: "Pag-IBIG" },
  { value: "tax", label: "Tax" },
  { value: "general", label: "General" },
];

const normaliseTokens = (
  raw: PayConstantFormValue["formula_tokens"],
): FormulaToken[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as FormulaToken[];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? (parsed as FormulaToken[]) : [];
  } catch {
    return [];
  }
};

interface ConstantRow {
  id: number;
  code: string;
  name: string;
  value: number | string;
  category: string;
}

export const PayConstantForm = ({ value, onChange }: Props) => {
  const [constants, setConstants] = useState<ConstantRow[]>([]);
  const [numberDraft, setNumberDraft] = useState("");
  const [constantPick, setConstantPick] = useState("");

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const sectionBg = useColorModeValue("gray.50", "gray.900");
  const inputBg = useColorModeValue("white", "gray.700");
  const label = useColorModeValue("gray.700", "gray.300");
  const subtle = useColorModeValue("gray.500", "gray.400");
  const headingColor = useColorModeValue("gray.900", "white");
  const tokenBg = useColorModeValue("white", "gray.800");
  const tokenBorder = useColorModeValue("gray.200", "gray.600");
  const opBg = useColorModeValue("orange.50", "orange.900");
  const opColor = useColorModeValue("orange.700", "orange.200");
  const constBg = useColorModeValue("blue.50", "blue.900");
  const constColor = useColorModeValue("blue.700", "blue.200");
  const numBg = useColorModeValue("emerald.50", "green.900");
  const numColor = useColorModeValue("green.700", "green.200");
  const previewBg = useColorModeValue("gray.900", "gray.950");
  const errorBg = useColorModeValue("red.50", "red.900");
  const errorColor = useColorModeValue("red.700", "red.200");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("pay_constants")
        .select("id, code, name, value, category")
        .eq("active", true)
        .order("category", { ascending: true });
      setConstants((data as ConstantRow[] | null) || []);
    };
    load();
  }, []);

  const tokens = useMemo(
    () => normaliseTokens(value.formula_tokens),
    [value.formula_tokens],
  );

  const set = <K extends keyof PayConstantFormValue>(
    key: K,
    v: PayConstantFormValue[K],
  ) => onChange({ ...value, [key]: v });

  const setTokens = (
    next: FormulaToken[],
    extra?: Partial<PayConstantFormValue>,
  ) => {
    const evalResult = evaluateTokens(next, constants, value.code);
    onChange({
      ...value,
      formula_tokens: next,
      value: evalResult.ok ? evalResult.value : value.value,
      ...(extra || {}),
    });
  };

  const addToken = (t: FormulaToken) => setTokens([...tokens, t]);
  const removeToken = (idx: number) =>
    setTokens(tokens.filter((_, i) => i !== idx));
  const clearTokens = () => setTokens([]);

  const evalResult = useMemo(
    () => evaluateTokens(tokens, constants, value.code),
    [tokens, constants, value.code],
  );

  const constantsByCategory = constants.reduce<Record<string, ConstantRow[]>>(
    (acc, c) => {
      if (c.code === value.code) return acc; // prevent self-reference
      (acc[c.category] ||= []).push(c);
      return acc;
    },
    {},
  );

  const switchMode = (mode: "constant" | "formula") => {
    if (mode === "formula") {
      onChange({ ...value, value_type: "formula" });
    } else {
      onChange({ ...value, value_type: "constant" });
    }
  };

  return (
    <VStack align="stretch" spacing={5}>
      {/* ─── Identity ─── */}
      <SectionCard
        icon={Tag}
        title="Identity"
        bg={cardBg}
        border={cardBorder}
        heading={headingColor}
        subtle={subtle}
      >
        <HStack spacing={3} align="flex-end">
          <FormControl flex={2}>
            <FormLabel fontSize="xs" color={label} mb={1}>
              Name
            </FormLabel>
            <ChakraInput
              placeholder="e.g. Overtime Regular Day Multiplier"
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
              placeholder="OT_REGULAR_DAY_MULTIPLIER"
              value={value.code}
              onChange={(e) =>
                set(
                  "code",
                  e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                )
              }
              bg={inputBg}
              fontFamily="mono"
              textTransform="uppercase"
            />
          </FormControl>
          <FormControl flex={1}>
            <FormLabel fontSize="xs" color={label} mb={1}>
              Category
            </FormLabel>
            <Select
              value={value.category}
              onChange={(e) => set("category", e.target.value)}
              bg={inputBg}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormControl>
        </HStack>

        <FormControl mt={4}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Notes
          </FormLabel>
          <Textarea
            placeholder="Optional notes or Labor Code citation"
            value={value.description || ""}
            onChange={(e) => set("description", e.target.value)}
            bg={inputBg}
            rows={2}
          />
        </FormControl>

        <Flex justify="space-between" align="center" mt={4}>
          <Box>
            <Text fontSize="sm" color={label} fontWeight="medium">
              Active
            </Text>
            <Text fontSize="xs" color={subtle}>
              Inactive constants are hidden from Payroll Rule pickers.
            </Text>
          </Box>
          <Switch
            isChecked={value.active}
            onChange={(e) => set("active", e.target.checked)}
            colorScheme="blue"
            size="lg"
          />
        </Flex>
      </SectionCard>

      {/* ─── Value Source ─── */}
      <SectionCard
        icon={Sigma}
        title="Value Source"
        bg={cardBg}
        border={cardBorder}
        heading={headingColor}
        subtle={subtle}
      >
        <HStack spacing={3} align="stretch">
          <ModeTile
            active={value.value_type === "constant"}
            onClick={() => switchMode("constant")}
            icon={Hash}
            title="Constant"
            subtitle="A fixed numeric value you enter directly."
            accent="blue"
          />
          <ModeTile
            active={value.value_type === "formula"}
            onClick={() => switchMode("formula")}
            icon={Calculator}
            title="Formula"
            subtitle="Compute from other constants, numbers and operators."
            accent="blue"
          />
        </HStack>

        {value.value_type === "constant" ? (
          <Box
            mt={4}
            p={4}
            bg={sectionBg}
            rounded="md"
            border="1px solid"
            borderColor={cardBorder}
          >
            <FormControl>
              <FormLabel fontSize="xs" color={label} mb={1}>
                Value
              </FormLabel>
              <ChakraInput
                type="number"
                step="any"
                placeholder="e.g. 1.25"
                value={value.value ?? ""}
                onChange={(e) => set("value", e.target.value)}
                bg={inputBg}
                fontFamily="mono"
                fontSize="lg"
                fontWeight="semibold"
              />
            </FormControl>
          </Box>
        ) : (
          <Box mt={4}>
            {/* Formula builder */}
            <Box
              p={4}
              bg={sectionBg}
              rounded="md"
              border="1px solid"
              borderColor={cardBorder}
            >
              <Flex justify="space-between" align="center" mb={3}>
                <Text
                  fontSize="xs"
                  color={subtle}
                  textTransform="uppercase"
                  letterSpacing="wider"
                  fontWeight="bold"
                >
                  Formula
                </Text>
                {tokens.length > 0 && (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={clearTokens}
                  >
                    Clear
                  </Button>
                )}
              </Flex>

              {/* Token chips */}
              <Flex
                wrap="wrap"
                gap={2}
                minH="52px"
                p={3}
                bg={tokenBg}
                border="1px dashed"
                borderColor={tokenBorder}
                rounded="md"
                align="center"
              >
                {tokens.length === 0 && (
                  <Text fontSize="xs" color={subtle}>
                    No tokens yet. Add constants, numbers, or operators below.
                  </Text>
                )}
                {tokens.map((t, idx) => (
                  <TokenChip
                    key={idx}
                    token={t}
                    onRemove={() => removeToken(idx)}
                    opBg={opBg}
                    opColor={opColor}
                    constBg={constBg}
                    constColor={constColor}
                    numBg={numBg}
                    numColor={numColor}
                    constantsIndex={constants}
                  />
                ))}
              </Flex>

              {/* Preview */}
              <Box mt={3} p={3} bg={previewBg} rounded="md">
                <Flex justify="space-between" align="center" gap={3}>
                  <Box flex={1} minW={0}>
                    <Text fontSize="xs" color="gray.400" mb={1}>
                      Preview
                    </Text>
                    <Text
                      fontFamily="mono"
                      fontSize="sm"
                      color="gray.100"
                      wordBreak="break-all"
                    >
                      {tokens.length === 0 ? "—" : tokensToString(tokens)}
                    </Text>
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="xs" color="gray.400" mb={1}>
                      =
                    </Text>
                    {evalResult.ok ? (
                      <Badge
                        colorScheme="blue"
                        fontSize="md"
                        px={3}
                        py={1}
                        rounded="md"
                      >
                        {roundNice(evalResult.value)}
                      </Badge>
                    ) : (
                      <Text
                        fontSize="xs"
                        color="orange.300"
                        display="inline-flex"
                        alignItems="center"
                        gap={1}
                      >
                        <AlertTriangle size={12} /> {evalResult.error}
                      </Text>
                    )}
                  </Box>
                </Flex>
              </Box>
            </Box>

            {/* Adders */}
            <Box
              mt={3}
              p={4}
              bg={cardBg}
              rounded="md"
              border="1px solid"
              borderColor={cardBorder}
            >
              {/* Constant picker */}
              <Text
                fontSize="xs"
                color={subtle}
                textTransform="uppercase"
                letterSpacing="wider"
                fontWeight="bold"
                mb={2}
              >
                Add a constant
              </Text>
              <HStack spacing={2}>
                <Select
                  placeholder="Select a pay constant"
                  value={constantPick}
                  onChange={(e) => setConstantPick(e.target.value)}
                  bg={inputBg}
                  size="sm"
                >
                  {Object.entries(constantsByCategory).map(([cat, items]) => (
                    <optgroup key={cat} label={formatCategory(cat)}>
                      {items.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.code}) — {Number(c.value)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <Button
                  size="sm"
                  colorScheme="blue"
                  leftIcon={<Plus size={14} />}
                  isDisabled={!constantPick}
                  onClick={() => {
                    if (!constantPick) return;
                    addToken({ type: "constant", code: constantPick });
                    setConstantPick("");
                  }}
                >
                  Add
                </Button>
              </HStack>

              <Divider my={3} />

              {/* Number adder */}
              <Text
                fontSize="xs"
                color={subtle}
                textTransform="uppercase"
                letterSpacing="wider"
                fontWeight="bold"
                mb={2}
              >
                Add a number
              </Text>
              <HStack spacing={2}>
                <ChakraInput
                  type="number"
                  step="any"
                  placeholder="e.g. 1.30"
                  value={numberDraft}
                  onChange={(e) => setNumberDraft(e.target.value)}
                  size="sm"
                  bg={inputBg}
                  fontFamily="mono"
                />
                <Button
                  size="sm"
                  colorScheme="green"
                  leftIcon={<Plus size={14} />}
                  isDisabled={
                    numberDraft === "" || Number.isNaN(Number(numberDraft))
                  }
                  onClick={() => {
                    const n = Number(numberDraft);
                    if (Number.isNaN(n)) return;
                    addToken({ type: "number", val: n });
                    setNumberDraft("");
                  }}
                >
                  Add
                </Button>
              </HStack>

              <Divider my={3} />

              {/* Operator buttons */}
              <Text
                fontSize="xs"
                color={subtle}
                textTransform="uppercase"
                letterSpacing="wider"
                fontWeight="bold"
                mb={2}
              >
                Operators
              </Text>
              <Flex wrap="wrap" gap={1.5}>
                {OPERATORS.map((op) => (
                  <Button
                    key={op}
                    size="sm"
                    variant="outline"
                    colorScheme="orange"
                    fontFamily="mono"
                    fontSize="md"
                    fontWeight="bold"
                    minW="44px"
                    onClick={() => addToken({ type: "op", op })}
                  >
                    {op}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Box>
        )}
      </SectionCard>
    </VStack>
  );
};

/* ─── Token chip ─── */

const TokenChip = ({
  token,
  onRemove,
  opBg,
  opColor,
  constBg,
  constColor,
  numBg,
  numColor,
  constantsIndex,
}: {
  token: FormulaToken;
  onRemove: () => void;
  opBg: string;
  opColor: string;
  constBg: string;
  constColor: string;
  numBg: string;
  numColor: string;
  constantsIndex: ConstantRow[];
}) => {
  let bg = constBg;
  let color = constColor;
  let content: React.ReactNode = "";
  let tip = "";

  if (token.type === "op") {
    bg = opBg;
    color = opColor;
    content = token.op;
  } else if (token.type === "number") {
    bg = numBg;
    color = numColor;
    content = String(token.val);
  } else {
    const ref = constantsIndex.find((c) => c.code === token.code);
    content = token.code;
    tip = ref ? `${ref.name} = ${Number(ref.value)}` : "Constant not found";
  }

  const chip = (
    <Flex
      align="center"
      gap={1}
      bg={bg}
      color={color}
      fontFamily="mono"
      fontSize="sm"
      fontWeight="semibold"
      px={2.5}
      py={1.5}
      rounded="md"
      border="1px solid"
      borderColor="transparent"
    >
      {token.type === "constant" && <Icon as={Sigma} boxSize={3} />}
      {token.type === "number" && <Icon as={Hash} boxSize={3} />}
      <Box>{content}</Box>
      <IconButton
        aria-label="Remove token"
        icon={<X size={12} />}
        size="xs"
        variant="ghost"
        onClick={onRemove}
        ml={1}
        color={color}
        _hover={{ bg: "blackAlpha.100" }}
      />
    </Flex>
  );

  return tip ? (
    <Tooltip label={tip} fontSize="xs">
      {chip}
    </Tooltip>
  ) : (
    chip
  );
};

/* ─── Layout helpers ─── */

const SectionCard = ({
  icon,
  title,
  children,
  bg,
  border,
  heading,
  subtle,
}: {
  icon: typeof Tag;
  title: string;
  children: React.ReactNode;
  bg: string;
  border: string;
  heading: string;
  subtle: string;
}) => (
  <Box bg={bg} border="1px solid" borderColor={border} rounded="lg" p={5}>
    <Flex align="center" gap={2} mb={4}>
      <Icon as={icon} boxSize={4} color={subtle} />
      <Text fontSize="sm" fontWeight="semibold" color={heading}>
        {title}
      </Text>
    </Flex>
    {children}
  </Box>
);

const ModeTile = ({
  active,
  onClick,
  icon,
  title,
  subtitle,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Zap;
  title: string;
  subtitle: string;
  accent: string;
}) => {
  const border = useColorModeValue("gray.200", "gray.600");
  const activeBorder = useColorModeValue(`${accent}.500`, `${accent}.300`);
  const activeBg = useColorModeValue(`${accent}.50`, `${accent}.900`);
  const activeIcon = useColorModeValue(`${accent}.600`, `${accent}.200`);
  const idleIcon = useColorModeValue("gray.500", "gray.400");
  const titleColor = useColorModeValue("gray.900", "white");
  const subColor = useColorModeValue("gray.500", "gray.400");
  const hoverBorder = useColorModeValue("gray.300", "gray.500");

  return (
    <Box
      flex={1}
      onClick={onClick}
      cursor="pointer"
      p={4}
      rounded="lg"
      border="2px solid"
      borderColor={active ? activeBorder : border}
      bg={active ? activeBg : "transparent"}
      transition="all 0.15s ease"
      _hover={{ borderColor: active ? activeBorder : hoverBorder }}
    >
      <Icon
        as={icon}
        boxSize={5}
        color={active ? activeIcon : idleIcon}
        mb={2}
      />
      <Text fontSize="sm" fontWeight="semibold" color={titleColor}>
        {title}
      </Text>
      <Text fontSize="xs" color={subColor} mt={0.5}>
        {subtitle}
      </Text>
    </Box>
  );
};

/* ─── Pure helpers ─── */

const formatCategory = (c: string) =>
  c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const roundNice = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
};

const tokensToString = (tokens: FormulaToken[]) =>
  tokens
    .map((t) => {
      if (t.type === "op") return t.op;
      if (t.type === "number") return String(t.val);
      return t.code;
    })
    .join(" ");

/* ─── Formula evaluation (safe, no eval) ─── */

type EvalResult = { ok: true; value: number } | { ok: false; error: string };

export const evaluateTokens = (
  tokens: FormulaToken[],
  constants: ConstantRow[],
  selfCode?: string,
): EvalResult => {
  if (tokens.length === 0) return { ok: false, error: "Empty formula" };

  // Convert to numeric tokens
  const numericTokens: Array<{ kind: "num" | "op"; value: number | string }> =
    [];
  for (const t of tokens) {
    if (t.type === "op") {
      numericTokens.push({ kind: "op", value: t.op });
    } else if (t.type === "number") {
      numericTokens.push({ kind: "num", value: t.val });
    } else {
      if (selfCode && t.code === selfCode) {
        return { ok: false, error: "Cannot reference self" };
      }
      const ref = constants.find((c) => c.code === t.code);
      if (!ref) return { ok: false, error: `Unknown constant ${t.code}` };
      numericTokens.push({ kind: "num", value: Number(ref.value) });
    }
  }

  try {
    const result = evalShuntingYard(numericTokens);
    if (!Number.isFinite(result)) return { ok: false, error: "Invalid result" };
    return { ok: true, value: result };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid formula" };
  }
};

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

const evalShuntingYard = (
  tokens: Array<{ kind: "num" | "op"; value: number | string }>,
): number => {
  const output: Array<number | string> = [];
  const ops: string[] = [];

  for (const t of tokens) {
    if (t.kind === "num") {
      output.push(t.value as number);
    } else {
      const op = t.value as string;
      if (op === "(") {
        ops.push(op);
      } else if (op === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") {
          output.push(ops.pop() as string);
        }
        if (!ops.length) throw new Error("Mismatched parentheses");
        ops.pop();
      } else if (PRECEDENCE[op] != null) {
        while (
          ops.length &&
          ops[ops.length - 1] !== "(" &&
          PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[op]
        ) {
          output.push(ops.pop() as string);
        }
        ops.push(op);
      } else {
        throw new Error(`Unknown operator ${op}`);
      }
    }
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === "(" || op === ")") throw new Error("Mismatched parentheses");
    output.push(op);
  }

  const stack: number[] = [];
  for (const item of output) {
    if (typeof item === "number") {
      stack.push(item);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a == null || b == null) throw new Error("Invalid expression");
      switch (item) {
        case "+":
          stack.push(a + b);
          break;
        case "-":
          stack.push(a - b);
          break;
        case "*":
          stack.push(a * b);
          break;
        case "/":
          if (b === 0) throw new Error("Division by zero");
          stack.push(a / b);
          break;
        default:
          throw new Error(`Unknown op ${item}`);
      }
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
};
