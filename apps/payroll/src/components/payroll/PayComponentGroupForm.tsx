import { useEffect, useMemo, useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input as ChakraInput,
  Textarea,
  FormControl,
  FormLabel,
  Select,
  Checkbox,
  Badge,
  Divider,
  useColorModeValue,
} from "@chakra-ui/react";
import { supabase } from "../../lib/supabase";
import { normaliseComponentCodes } from "../../lib/payTemplateLayout";

interface AvailableRule {
  code: string;
  name: string;
  category: string;
}

export interface PayComponentGroupFormValue {
  id?: any;
  name: string;
  code: string;
  category: "earning" | "deduction" | "mixed";
  description: string;
  component_codes: string[] | string | null;
  active: boolean;
}

export const emptyPayComponentGroup = (): PayComponentGroupFormValue => ({
  name: "",
  code: "",
  category: "mixed",
  description: "",
  component_codes: [],
  active: true,
});

export const PayComponentGroupForm = ({
  value,
  onChange,
}: {
  value: PayComponentGroupFormValue;
  onChange: (next: PayComponentGroupFormValue) => void;
}) => {
  const [availableRules, setAvailableRules] = useState<AvailableRule[]>([]);

  const label = useColorModeValue("gray.700", "gray.300");
  const subtle = useColorModeValue("gray.500", "gray.400");
  const inputBg = useColorModeValue("white", "gray.700");
  const sectionBg = useColorModeValue("gray.50", "gray.900");
  const sectionBorder = useColorModeValue("gray.200", "gray.600");

  useEffect(() => {
    const loadRules = async () => {
      const { data, error } = await supabase
        .from("pay_components")
        .select("code, name, category")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        setAvailableRules([]);
        return;
      }

      const deduped = new Map<string, AvailableRule>();
      ((data as AvailableRule[] | null) || []).forEach((rule) => {
        if (!rule.code || deduped.has(rule.code)) return;
        deduped.set(rule.code, rule);
      });

      setAvailableRules(Array.from(deduped.values()));
    };

    void loadRules();
  }, []);

  const set = <K extends keyof PayComponentGroupFormValue>(
    key: K,
    nextValue: PayComponentGroupFormValue[K],
  ) => onChange({ ...value, [key]: nextValue });

  const selectedCodes = useMemo(
    () => normaliseComponentCodes(value.component_codes),
    [value.component_codes],
  );

  const visibleRules = useMemo(() => {
    if (value.category === "mixed") return availableRules;
    return availableRules.filter((rule) => rule.category === value.category);
  }, [availableRules, value.category]);

  const toggleCode = (code: string, checked: boolean) => {
    const nextCodes = checked
      ? Array.from(new Set([...selectedCodes, code]))
      : selectedCodes.filter((entry) => entry !== code);
    set("component_codes", nextCodes);
  };

  return (
    <VStack align="stretch" spacing={5}>
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color={label}>
          Reusable Rule Group
        </Text>
        <Text fontSize="xs" color={subtle}>
          Groups match payroll rules by code, so one group can be reused across
          multiple templates.
        </Text>
      </Box>

      <HStack spacing={3} align="flex-end">
        <FormControl flex={1.6}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Group Name
          </FormLabel>
          <ChakraInput
            placeholder="e.g. Government Deductions"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            bg={inputBg}
          />
        </FormControl>
        <FormControl flex={1}>
          <FormLabel fontSize="xs" color={label} mb={1}>
            Group Code
          </FormLabel>
          <ChakraInput
            placeholder="GOV_DEDUCTIONS"
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
        <FormControl maxW="170px">
          <FormLabel fontSize="xs" color={label} mb={1}>
            Category
          </FormLabel>
          <Select
            value={value.category}
            onChange={(e) =>
              set(
                "category",
                e.target.value as PayComponentGroupFormValue["category"],
              )
            }
            bg={inputBg}
          >
            <option value="earning">Earnings</option>
            <option value="deduction">Deductions</option>
            <option value="mixed">Mixed</option>
          </Select>
        </FormControl>
      </HStack>

      <FormControl>
        <FormLabel fontSize="xs" color={label} mb={1}>
          Description
        </FormLabel>
        <Textarea
          placeholder="Optional notes about where this group should be used"
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          bg={inputBg}
          rows={2}
        />
      </FormControl>

      <Box
        p={3}
        bg={sectionBg}
        rounded="md"
        border="1px solid"
        borderColor={sectionBorder}
      >
        <HStack justify="space-between" mb={2}>
          <Box>
            <Text fontSize="xs" color={label} fontWeight="semibold">
              Included Rules
            </Text>
            <Text fontSize="xs" color={subtle}>
              Select the rule codes this group should collect.
            </Text>
          </Box>
          <Badge colorScheme="blue" rounded="full" px={2}>
            {selectedCodes.length} selected
          </Badge>
        </HStack>

        <Divider mb={3} />

        {visibleRules.length === 0 ? (
          <Text fontSize="xs" color={subtle}>
            No payroll rules match this category yet.
          </Text>
        ) : (
          <VStack align="stretch" spacing={2} maxH="280px" overflowY="auto">
            {visibleRules.map((rule) => (
              <Checkbox
                key={rule.code}
                isChecked={selectedCodes.includes(rule.code)}
                onChange={(e) => toggleCode(rule.code, e.target.checked)}
              >
                <HStack spacing={2} align="center">
                  <Badge fontFamily="mono" textTransform="none">
                    {rule.code}
                  </Badge>
                  <Text fontSize="sm">{rule.name}</Text>
                </HStack>
              </Checkbox>
            ))}
          </VStack>
        )}
      </Box>

      <Checkbox
        isChecked={value.active}
        onChange={(e) => set("active", e.target.checked)}
      >
        <Text fontSize="sm" color={label}>
          Active
        </Text>
      </Checkbox>
    </VStack>
  );
};
