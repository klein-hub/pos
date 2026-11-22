import {
  BarChart3, Boxes, Coffee, Fan, Landmark, LifeBuoy, Megaphone, Package, Plug, Printer,
  Rocket, ShoppingBag, Sprout, Users, type LucideIcon,
} from 'lucide-react';

/** Content names icons as strings so the data files stay free of React. */
const map: Record<string, LucideIcon> = {
  BarChart3, Boxes, Coffee, Fan, Landmark, LifeBuoy, Megaphone, Package, Plug, Printer,
  Rocket, ShoppingBag, Sprout, Users,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = map[name] ?? Boxes;
  return <Cmp className={className} strokeWidth={1.75} />;
}
