import React, { useEffect, useMemo, useState } from "react";
import {
  Table as ChakraTable,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableProps,
  Box,
  Skeleton,
  Flex,
  Text,
  Tooltip,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  HStack,
  Button,
  Select,
  ButtonProps,
  useColorModeValue,
} from "@chakra-ui/react";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Search, X } from "lucide-react";

type SortDirection = "asc" | "desc";

export interface TableFilterOption {
  label: string;
  value: string;
  getValue: (item: any) => string | number | null | undefined;
  options?: Array<{ label: string; value: string }>;
}

export interface TableSortOption {
  label: string;
  value: string;
  getValue: (item: any) => string | number | Date | null | undefined;
}

interface CustomTableProps extends TableProps {
  headers: (string | React.ReactNode)[];
  data: any[];
  renderRow: (item: any) => React.ReactNode[];
  isLoading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchPredicate?: (item: any, query: string) => boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  emptySearchMessage?: string | ((query: string) => string);
  rowKey?: (item: any, index: number) => string | number;
  filterable?: boolean;
  filterOptions?: TableFilterOption[];
  sortable?: boolean;
  sortOptions?: TableSortOption[];
  defaultSortBy?: string;
  defaultSortDirection?: SortDirection;
  onAdd?: () => void;
  tableName?: string;
  addButtonLabel?: string;
  addButtonProps?: Omit<ButtonProps, "onClick" | "children">;
  addButtonDataTutorialId?: string;
  showInternalPagination?: boolean;
  onPaginationChange?: (state: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalRows: number;
  }) => void;
  currentPage?: number;
  onCurrentPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export const Table = ({
  headers,
  data,
  renderRow,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = "No records found.",
  searchable = false,
  searchPlaceholder = "Search records...",
  searchPredicate,
  searchValue,
  onSearchChange,
  searchInputRef,
  onRefresh,
  isRefreshing = false,
  pagination = false,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50],
  emptySearchMessage = "No records match your search.",
  rowKey,
  filterable = false,
  filterOptions = [],
  sortable = false,
  sortOptions = [],
  defaultSortBy,
  defaultSortDirection = "asc",
  onAdd,
  tableName,
  addButtonLabel,
  addButtonProps,
  addButtonDataTutorialId,
  showInternalPagination = true,
  onPaginationChange,
  currentPage: controlledCurrentPage,
  onCurrentPageChange,
  pageSize: controlledPageSize,
  onPageSizeChange,
  ...props
}: CustomTableProps) => {
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);

  const currentPage =
    controlledCurrentPage !== undefined
      ? controlledCurrentPage
      : internalCurrentPage;
  const pageSize =
    controlledPageSize !== undefined ? controlledPageSize : internalPageSize;

  const handleCurrentPageChange = (page: number) => {
    if (onCurrentPageChange) {
      onCurrentPageChange(page);
    } else {
      setInternalCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(size);
    } else {
      setInternalPageSize(size);
    }
  };

  const [internalSearch, setInternalSearch] = useState("");
  const [selectedFilterKey, setSelectedFilterKey] = useState("");
  const [selectedFilterValue, setSelectedFilterValue] = useState("");
  const [selectedSortBy, setSelectedSortBy] = useState(defaultSortBy || "");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(defaultSortDirection);

  const query = searchValue !== undefined ? searchValue : internalSearch;
  const normalizedQuery = query.trim().toLowerCase();

  const resolvedFilterOptions = useMemo(() => {
    if (!filterOptions.length) return [];

    return filterOptions.map((option) => {
      if (option.options && option.options.length > 0) {
        return option;
      }

      const unique = new Map<string, string>();
      data.forEach((item) => {
        const raw = option.getValue(item);
        if (raw == null) return;

        const value = String(raw).trim();
        if (!value) return;
        if (!unique.has(value)) {
          unique.set(value, value);
        }
      });

      return {
        ...option,
        options: Array.from(unique.keys())
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ label: value, value })),
      };
    });
  }, [filterOptions, data]);

  const activeFilter = useMemo(() => {
    if (!selectedFilterKey) return undefined;
    return resolvedFilterOptions.find(
      (option) => option.value === selectedFilterKey,
    );
  }, [resolvedFilterOptions, selectedFilterKey]);

  const searchedData = useMemo(() => {
    if (!searchable || !normalizedQuery) return data;

    if (searchPredicate) {
      return data.filter((item) => searchPredicate(item, normalizedQuery));
    }

    return data.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(normalizedQuery),
    );
  }, [data, normalizedQuery, searchable, searchPredicate]);

  const filteredData = useMemo(() => {
    if (!filterable || !activeFilter || !selectedFilterValue) {
      return searchedData;
    }

    return searchedData.filter((item) => {
      const raw = activeFilter.getValue(item);
      if (raw == null) return false;
      return String(raw).trim() === selectedFilterValue;
    });
  }, [searchedData, filterable, activeFilter, selectedFilterValue]);

  const resolvedSortOptions = useMemo(() => {
    if (!sortOptions.length) return [];
    return sortOptions;
  }, [sortOptions]);

  const sortedData = useMemo(() => {
    if (!sortable || !selectedSortBy) return filteredData;

    const selectedSort = resolvedSortOptions.find(
      (option) => option.value === selectedSortBy,
    );

    if (!selectedSort) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aRaw = selectedSort.getValue(a);
      const bRaw = selectedSort.getValue(b);

      const aNull = aRaw == null || String(aRaw).trim() === "";
      const bNull = bRaw == null || String(bRaw).trim() === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      const aDate =
        aRaw instanceof Date
          ? aRaw.getTime()
          : typeof aRaw === "string" && /\d{4}-\d{2}-\d{2}/.test(aRaw)
            ? new Date(aRaw).getTime()
            : Number.NaN;
      const bDate =
        bRaw instanceof Date
          ? bRaw.getTime()
          : typeof bRaw === "string" && /\d{4}-\d{2}-\d{2}/.test(bRaw)
            ? new Date(bRaw).getTime()
            : Number.NaN;

      if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
        return aDate - bDate;
      }

      const aNumber = typeof aRaw === "number" ? aRaw : Number(aRaw);
      const bNumber = typeof bRaw === "number" ? bRaw : Number(bRaw);
      if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
        return aNumber - bNumber;
      }

      return String(aRaw).localeCompare(String(bRaw));
    });

    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [
    filteredData,
    sortable,
    selectedSortBy,
    resolvedSortOptions,
    sortDirection,
  ]);

  const totalRows = sortedData.length;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(totalRows / pageSize))
    : 1;

  useEffect(() => {
    handleCurrentPageChange(1);
  }, [normalizedQuery, pageSize, data.length]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      handleCurrentPageChange(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (onPaginationChange && pagination) {
      onPaginationChange({
        currentPage,
        pageSize,
        totalPages,
        totalRows,
      });
    }
  }, [
    currentPage,
    pageSize,
    totalPages,
    totalRows,
    pagination,
    onPaginationChange,
  ]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pagination, currentPage, pageSize]);

  const hasSearch = searchable;
  const hasRefresh = typeof onRefresh === "function";
  const hasAdd = typeof onAdd === "function";
  const hasFilter = filterable && resolvedFilterOptions.length > 0;
  const hasSort = sortable && resolvedSortOptions.length > 0;
  const hasToolbar = hasSearch || hasRefresh || hasAdd || hasFilter || hasSort;
  const hasQuery = normalizedQuery.length > 0;
  const resolvedAddLabel = addButtonLabel || `Add ${tableName || "Item"}`;

  const resolvedEmptyMessage = hasQuery
    ? typeof emptySearchMessage === "function"
      ? emptySearchMessage(normalizedQuery)
      : emptySearchMessage
    : emptyMessage;

  const firstRowIndex = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRowIndex = pagination
    ? Math.min(currentPage * pageSize, totalRows)
    : totalRows;

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
      return;
    }
    setInternalSearch(value);
  };

  useEffect(() => {
    if (!hasFilter) {
      setSelectedFilterKey("");
      setSelectedFilterValue("");
      return;
    }

    if (
      selectedFilterKey &&
      !resolvedFilterOptions.some(
        (option) => option.value === selectedFilterKey,
      )
    ) {
      setSelectedFilterKey("");
      setSelectedFilterValue("");
    }
  }, [hasFilter, resolvedFilterOptions, selectedFilterKey]);

  useEffect(() => {
    if (!hasSort) {
      setSelectedSortBy("");
      return;
    }

    if (!selectedSortBy && defaultSortBy) {
      setSelectedSortBy(defaultSortBy);
      return;
    }

    if (
      selectedSortBy &&
      !resolvedSortOptions.some((option) => option.value === selectedSortBy)
    ) {
      setSelectedSortBy("");
    }
  }, [hasSort, resolvedSortOptions, selectedSortBy, defaultSortBy]);

  const toolbarBg = useColorModeValue("white", "whiteAlpha.50");
  const toolbarBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  const fieldBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const fieldBorder = useColorModeValue("gray.300", "whiteAlpha.300");
  const fieldFocusBorder = useColorModeValue("blue.400", "cyan.300");

  const controlSx = {
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

  return (
    <Box overflowX="auto">
      {hasToolbar && (
        <Flex
          justify="space-between"
          align="center"
          gap={3}
          mb={4}
          wrap="wrap"
          p={3}
          bg={toolbarBg}
          border="1px solid"
          borderColor={toolbarBorder}
          rounded="lg"
        >
          <HStack spacing={2} wrap="wrap" align="center" flex={1}>
            {hasSearch && (
              <InputGroup size="sm" maxW={{ base: "full", md: "360px" }}>
                <InputLeftElement pointerEvents="none">
                  <Search size={14} />
                </InputLeftElement>
                <Input
                  ref={searchInputRef}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  sx={controlSx}
                />
                <InputRightElement>
                  {query ? (
                    <IconButton
                      aria-label="Clear search"
                      onClick={() => handleSearchChange("")}
                      size="xs"
                      variant="ghost"
                      minW="auto"
                      h="24px"
                      icon={<X size={12} />}
                    />
                  ) : null}
                </InputRightElement>
              </InputGroup>
            )}

            {hasFilter && (
              <>
                <Select
                  size="sm"
                  w={{ base: "80px", md: "110px" }}
                  value={selectedFilterKey}
                  onChange={(e) => {
                    setSelectedFilterKey(e.target.value);
                    setSelectedFilterValue("");
                  }}
                  sx={controlSx}
                >
                  <option value="">Filter by</option>
                  {resolvedFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <Select
                  size="sm"
                  w={{ base: "80px", md: "100px" }}
                  value={selectedFilterValue}
                  onChange={(e) => setSelectedFilterValue(e.target.value)}
                  isDisabled={!activeFilter}
                  sx={controlSx}
                >
                  <option value="">All</option>
                  {(activeFilter?.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </>
            )}

            {hasSort && (
              <>
                <Select
                  size="sm"
                  w={{ base: "100px", md: "130px" }}
                  value={selectedSortBy}
                  onChange={(e) => setSelectedSortBy(e.target.value)}
                  sx={controlSx}
                >
                  <option value="">Sort by</option>
                  {resolvedSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <Tooltip
                  label={sortDirection === "asc" ? "Ascending" : "Descending"}
                  hasArrow
                >
                  <IconButton
                    aria-label={
                      sortDirection === "asc"
                        ? "Sort ascending"
                        : "Sort descending"
                    }
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSortDirection((prev) =>
                        prev === "asc" ? "desc" : "asc",
                      )
                    }
                    isDisabled={!selectedSortBy}
                    icon={
                      sortDirection === "asc" ? (
                        <ArrowUp size={15} />
                      ) : (
                        <ArrowDown size={15} />
                      )
                    }
                    sx={controlSx}
                  />
                </Tooltip>
              </>
            )}
          </HStack>

          <HStack spacing={2}>
            {hasRefresh && (
              <Tooltip label="Refresh" hasArrow>
                <IconButton
                  aria-label="Refresh table"
                  icon={<RefreshCw size={15} />}
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  isLoading={isRefreshing}
                  sx={controlSx}
                />
              </Tooltip>
            )}

            {hasAdd && (
              <Button
                colorScheme="blue"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={onAdd}
                data-payroll-tutorial={addButtonDataTutorialId}
                rounded="md"
                boxShadow="sm"
                {...addButtonProps}
              >
                {resolvedAddLabel}
              </Button>
            )}
          </HStack>
        </Flex>
      )}

      <ChakraTable {...props}>
        <Thead>
          <Tr>
            {headers.map((header, index) => (
              <Th key={index}>{header}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <Tr key={rowIndex}>
                {headers.map((_, colIndex) => (
                  <Td key={colIndex}>
                    <Skeleton height="18px" borderRadius="md" />
                  </Td>
                ))}
              </Tr>
            ))
          ) : totalRows === 0 ? (
            <Tr>
              <Td colSpan={headers.length}>
                <Flex justify="center" py={8}>
                  <Text color="gray.400" fontSize="sm">
                    {resolvedEmptyMessage}
                  </Text>
                </Flex>
              </Td>
            </Tr>
          ) : (
            paginatedData.map((item, index) => (
              <Tr key={rowKey ? rowKey(item, index) : index}>
                {renderRow(item).map((cell, cellIndex) => (
                  <Td key={cellIndex}>{cell}</Td>
                ))}
              </Tr>
            ))
          )}
        </Tbody>
      </ChakraTable>

      {pagination && !isLoading && showInternalPagination && (
        <Flex justify="space-between" align="center" gap={3} mt={4} wrap="wrap">
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
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              sx={controlSx}
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
              onClick={() =>
                handleCurrentPageChange(Math.max(1, currentPage - 1))
              }
              isDisabled={currentPage <= 1}
              sx={controlSx}
            >
              Prev
            </Button>
            <Text fontSize="sm" minW="60px" textAlign="center">
              {currentPage} / {totalPages}
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleCurrentPageChange(Math.min(totalPages, currentPage + 1))
              }
              isDisabled={currentPage >= totalPages}
              sx={controlSx}
            >
              Next
            </Button>
          </HStack>
        </Flex>
      )}
    </Box>
  );
};
