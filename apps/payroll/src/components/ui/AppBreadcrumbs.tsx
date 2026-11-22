import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface AppBreadcrumbItem {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface AppBreadcrumbsProps {
  items: AppBreadcrumbItem[];
}

export const AppBreadcrumbs = ({ items }: AppBreadcrumbsProps) => {
  const navigate = useNavigate();
  const mutedColor = useColorModeValue("gray.500", "gray.400");

  return (
    <Breadcrumb
      spacing="8px"
      separator={<ChevronRight size={14} color={mutedColor as string} />}
      mb={6}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <BreadcrumbItem key={`${item.label}-${index}`} isCurrentPage={isLast}>
            {isLast ? (
              <Text fontSize="sm" color={mutedColor} fontWeight="medium">
                {item.label}
              </Text>
            ) : (
              <BreadcrumbLink
                fontSize="sm"
                color="blue.500"
                fontWeight="medium"
                onClick={(e) => {
                  e.preventDefault();
                  if (item.onClick) {
                    item.onClick();
                    return;
                  }
                  if (item.to) {
                    navigate(item.to);
                  }
                }}
                _hover={{ textDecoration: "underline" }}
              >
                {item.label}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
};
