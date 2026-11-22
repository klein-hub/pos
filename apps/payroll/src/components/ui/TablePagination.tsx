import React from "react";
import {
  Flex,
  Text,
  HStack,
  Button,
  Select,
  useColorModeValue,
} from "@chakra-ui/react";

interface TablePaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalPages: number;
  totalRows: number;
  pageSizeOptions?: number[];
  isLoading?: boolean;
}

const controlSx = {
  bg: "",
  borderColor: "",
  borderWidth: "1px",
  rounded: "md",
  _focusVisible: {
    borderColor: "",
    boxShadow: "",
  },
  _hover: {
    borderColor: "",
  },
};

export const TablePagination = ({
  currentPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalPages,
  totalRows,
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
}: TablePaginationProps) => {
  const fieldBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const fieldBorder = useColorModeValue("gray.300", "whiteAlpha.300");
  const fieldFocusBorder = useColorModeValue("blue.400", "cyan.300");

  const paginationControlSx = {
    bg: fieldBg,
    borderColor: fieldBorder,
    borderWidth: "1px",
    rounded: "md",
    _focusVisible: {
      borderColor: fieldFocusBorder,
      boxShadow: `0 0 0 1px ${fieldFocusBorder}`,
    },
    _hover: {
      borderColor: fieldFocusBorder,
    },
  };

  const firstRowIndex = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRowIndex = Math.min(currentPage * pageSize, totalRows);

  if (isLoading) return null;

  return (
    <Flex
      justify="space-between"
      align="center"
      gap={3}
      mt={4}
      wrap="wrap"
      p={3}
    >
      <Text fontSize="sm" color="gray.500">
        {firstRowIndex}-{lastRowIndex} of {totalRows}
      </Text>

      <HStack spacing={2}>
        <Text fontSize="sm" color="gray.500">
          Rows per page
        </Text>
        <Select
          size="sm"
          w="88px"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          sx={paginationControlSx}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          isDisabled={currentPage <= 1}
          sx={paginationControlSx}
        >
          Prev
        </Button>
        <Text fontSize="sm" minW="60px" textAlign="center">
          {currentPage} / {totalPages}
        </Text>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          isDisabled={currentPage >= totalPages}
          sx={paginationControlSx}
        >
          Next
        </Button>
      </HStack>
    </Flex>
  );
};
