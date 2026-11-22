import { Button, Tooltip } from '@chakra-ui/react';
import { Grid3x3 } from 'lucide-react';

const HUB_URL = import.meta.env.VITE_HUB_URL ?? 'http://localhost:5175';

/**
 * Returns to the launcher.
 *
 * Shown whenever a hub is configured rather than only when the user arrived
 * from one: someone who opens this app directly, or reloads after the handoff
 * fragment has been stripped, still needs a way across. A link that is
 * sometimes there is worse than one that always is.
 */
export function BackToHub() {
  return (
    <Tooltip label="All apps" openDelay={300}>
      <Button
        as="a"
        href={HUB_URL}
        size="sm"
        variant="ghost"
        leftIcon={<Grid3x3 size={16} />}
        aria-label="Back to all apps"
      >
        Apps
      </Button>
    </Tooltip>
  );
}
