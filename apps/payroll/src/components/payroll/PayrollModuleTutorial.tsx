import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Portal,
  Progress,
  Text,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ListChecks,
  PlayCircle,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export const PAYROLL_TUTORIAL_STORAGE_KEY = "payroll-module-tutorial-seen-v2";

const STEPS = [
  {
    title: "Open Configuration First",
    description:
      "Set up the payroll engine before you create any run. This tab is the first stop for a clean setup.",
    icon: Settings,
    target: "config-tab",
    placement: "bottom",
    items: [
      "Create Pay Constants first for rates, thresholds, and shared factors.",
      "Create Payroll Rules next so earnings and deductions can be computed.",
      "Group related rules, then arrange them in Pay Templates.",
    ],
  },
  {
    title: "Create The Pay Run",
    description:
      "Once configuration is ready, start a payroll cycle here by choosing the period and whether it applies to a group or one employee.",
    icon: PlayCircle,
    target: "new-pay-run-button",
    placement: "bottom",
    items: [
      "Use Group for regular payroll cycles and Individual for one-off cases.",
      "Set the covered dates before computing anything.",
      "After saving, the run appears in the payroll list below.",
    ],
  },
  {
    title: "Process The Run",
    description:
      "This area is your working queue. Move each run forward in order so payroll stays predictable.",
    icon: ListChecks,
    target: "pay-runs-panel",
    placement: "top",
    items: [
      "Open a run first to review the covered period, employees, and inputs.",
      "Compute inside the run details once everything looks correct.",
      "Validate next, then mark it as paid only after payroll is finalized.",
    ],
  },
  {
    title: "Review In Analytics",
    description:
      "After runs are processed, use analytics to review totals, spot anomalies, and confirm the payroll cycle looks right.",
    icon: BarChart3,
    target: "analytics-tab",
    placement: "bottom",
    items: [
      "Check trends only after at least one run has been computed.",
      "Use it as your final review step before the next payroll cycle.",
      "If numbers look off, return to Configuration or the Pay Run list and adjust there.",
    ],
  },
] as const;

type TutorialStep = (typeof STEPS)[number];

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const VIEWPORT_MARGIN = 24;
const SPOTLIGHT_PADDING = 12;
const CARD_WIDTH = 360;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getFallbackCardPosition = (viewport: {
  width: number;
  height: number;
}) => ({
  top: Math.max(VIEWPORT_MARGIN, viewport.height / 2 - 170),
  left: Math.max(VIEWPORT_MARGIN, viewport.width / 2 - CARD_WIDTH / 2),
});

const getCardPosition = (
  rect: SpotlightRect | null,
  placement: TutorialStep["placement"],
  viewport: { width: number; height: number },
) => {
  if (!rect || viewport.width === 0 || viewport.height === 0) {
    return getFallbackCardPosition(viewport);
  }

  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    viewport.width - CARD_WIDTH - VIEWPORT_MARGIN,
  );
  let top = rect.bottom + 18;
  let left = rect.left;

  if (placement === "top") {
    top = rect.top - 250;
    left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  }

  if (placement === "bottom") {
    top = rect.bottom + 18;
    left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  }

  return {
    top: clamp(
      top,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, viewport.height - 260),
    ),
    left: clamp(left, VIEWPORT_MARGIN, maxLeft),
  };
};

export const PayrollModuleTutorial = ({
  isOpen,
  onSkip,
  onComplete,
}: {
  isOpen: boolean;
  onSkip: () => void;
  onComplete: () => void;
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subtle = useColorModeValue("gray.500", "gray.400");
  const accent = useColorModeValue("cyan.600", "cyan.300");
  const overlayColor = useColorModeValue(
    "rgba(15, 23, 42, 0.26)",
    "rgba(2, 6, 23, 0.56)",
  );
  const glowColor = useColorModeValue(
    "0 0 0 9999px rgba(15, 23, 42, 0.16)",
    "0 0 0 9999px rgba(2, 6, 23, 0.24)",
  );

  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  const step = STEPS[stepIndex];

  const syncTargetRect = useCallback(
    (shouldScroll: boolean) => {
      if (typeof window === "undefined") return;

      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });

      const target = document.querySelector<HTMLElement>(
        `[data-payroll-tutorial="${step.target}"]`,
      );

      if (!target) {
        setTargetRect(null);
        return;
      }

      if (shouldScroll) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: Math.max(VIEWPORT_MARGIN, rect.top - SPOTLIGHT_PADDING),
        left: Math.max(VIEWPORT_MARGIN, rect.left - SPOTLIGHT_PADDING),
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
        right: Math.min(
          window.innerWidth - VIEWPORT_MARGIN,
          rect.right + SPOTLIGHT_PADDING,
        ),
        bottom: Math.min(
          window.innerHeight - VIEWPORT_MARGIN,
          rect.bottom + SPOTLIGHT_PADDING,
        ),
      });
    },
    [step.target],
  );

  useEffect(() => {
    if (!isOpen) return;

    let frameId = window.requestAnimationFrame(() => syncTargetRect(true));
    const handleUpdate = () => syncTargetRect(false);

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [isOpen, stepIndex, syncTargetRect]);

  const progress = useMemo(
    () => ((stepIndex + 1) / STEPS.length) * 100,
    [stepIndex],
  );
  const StepIcon = step.icon;
  const isLastStep = stepIndex === STEPS.length - 1;
  const cardPosition = useMemo(
    () => getCardPosition(targetRect, step.placement, viewport),
    [step.placement, targetRect, viewport],
  );

  if (!isOpen) return null;

  return (
    <Portal>
      <Box position="fixed" inset={0} zIndex={1400} pointerEvents="none">
        {targetRect ? (
          <>
            <Box
              position="fixed"
              top={0}
              left={0}
              right={0}
              height={`${targetRect.top}px`}
              bg={overlayColor}
              backdropFilter="blur(8px)"
            />
            <Box
              position="fixed"
              top={`${targetRect.top}px`}
              left={0}
              width={`${targetRect.left}px`}
              height={`${targetRect.height}px`}
              bg={overlayColor}
              backdropFilter="blur(8px)"
            />
            <Box
              position="fixed"
              top={`${targetRect.top}px`}
              left={`${targetRect.right}px`}
              right={0}
              height={`${targetRect.height}px`}
              bg={overlayColor}
              backdropFilter="blur(8px)"
            />
            <Box
              position="fixed"
              top={`${targetRect.bottom}px`}
              left={0}
              right={0}
              bottom={0}
              bg={overlayColor}
              backdropFilter="blur(8px)"
            />
            <Box
              position="fixed"
              top={`${targetRect.top}px`}
              left={`${targetRect.left}px`}
              width={`${targetRect.width}px`}
              height={`${targetRect.height}px`}
              border="2px solid"
              borderColor="cyan.400"
              borderRadius="20px"
              boxShadow={glowColor}
              transition="all 0.2s ease"
            />
          </>
        ) : (
          <Box
            position="fixed"
            inset={0}
            bg={overlayColor}
            backdropFilter="blur(8px)"
          />
        )}

        <Box
          position="fixed"
          top={`${cardPosition.top}px`}
          left={`${cardPosition.left}px`}
          width={`min(${CARD_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`}
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="2xl"
          boxShadow="2xl"
          pointerEvents="auto"
          overflow="hidden"
        >
          <Box px={5} pt={5} pb={4}>
            <Flex align="center" justify="space-between" gap={4} mb={3}>
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  letterSpacing="0.08em"
                  textTransform="uppercase"
                  color={accent}
                >
                  Payroll Walkthrough
                </Text>
                <Text fontSize="lg" fontWeight="bold" mt={1}>
                  {step.title}
                </Text>
              </Box>
              <Badge colorScheme="cyan" rounded="full" px={3}>
                {stepIndex + 1} / {STEPS.length}
              </Badge>
            </Flex>

            <Progress
              value={progress}
              colorScheme="cyan"
              rounded="full"
              mb={4}
            />

            <HStack align="flex-start" spacing={3} mb={4}>
              <Flex
                w="40px"
                h="40px"
                rounded="xl"
                align="center"
                justify="center"
                bg="cyan.50"
                color={accent}
                flexShrink={0}
              >
                <StepIcon size={18} />
              </Flex>
              <Text fontSize="sm" color={subtle}>
                {step.description}
              </Text>
            </HStack>

            <VStack align="stretch" spacing={3}>
              {step.items.map((item, itemIndex) => (
                <Flex key={item} gap={3} align="flex-start">
                  <Flex
                    mt="1px"
                    w="22px"
                    h="22px"
                    rounded="full"
                    align="center"
                    justify="center"
                    bg="cyan.100"
                    color={accent}
                    fontSize="xs"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    {itemIndex + 1}
                  </Flex>
                  <Text fontSize="sm">{item}</Text>
                </Flex>
              ))}
            </VStack>
          </Box>

          <Flex
            justify="space-between"
            align="center"
            px={5}
            py={4}
            borderTop="1px solid"
            borderColor={cardBorder}
          >
            <Button variant="ghost" onClick={onSkip}>
              Skip Tutorial
            </Button>
            <HStack spacing={2}>
              <Button
                variant="outline"
                leftIcon={<ArrowLeft size={16} />}
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                isDisabled={stepIndex === 0}
              >
                Back
              </Button>
              <Button
                colorScheme="cyan"
                rightIcon={isLastStep ? undefined : <ArrowRight size={16} />}
                onClick={() => {
                  if (isLastStep) {
                    onComplete();
                    return;
                  }
                  setStepIndex((index) =>
                    Math.min(STEPS.length - 1, index + 1),
                  );
                }}
              >
                {isLastStep ? "Finish" : "Next"}
              </Button>
            </HStack>
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
};
