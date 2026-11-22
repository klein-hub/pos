import {
  Box,
  Button,
  Heading,
  Text,
  useColorModeValue,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  VStack,
  HStack,
} from '@chakra-ui/react';
import { Card } from '../ui/Card';
import { Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAttendance, TimeEntry } from '../../hooks/useAttendance';

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const ClockInOut = () => {
  const toast = useToast();
  const { clockIn, clockOut, getActiveClockIn, loading } = useAttendance();
  
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.900', 'white');
  const successColor = useColorModeValue('green.50', 'green.900');
  const cardBgColor = useColorModeValue('white', 'gray.700');
  const infoBoxBgColor = useColorModeValue('blue.50', 'blue.900');
  const locationBoxBgColor = useColorModeValue('gray.50', 'gray.900');

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active clock in
  useEffect(() => {
    const loadActiveEntry = async () => {
      const entry = await getActiveClockIn();
      setActiveEntry(entry);
    };
    loadActiveEntry();
    const interval = setInterval(loadActiveEntry, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [getActiveClockIn]);

  const getLocationPermission = async (): Promise<LocationCoords> => {
    setLoadingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      
      const { latitude, longitude, accuracy } = position.coords;
      const locData: LocationCoords = { latitude, longitude, accuracy };
      setLocation(locData);
      return locData;
    } catch (err) {
      toast({
        title: 'Location Error',
        description: 'Could not get your location. Please enable location services.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      throw err;
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleClockIn = async () => {
    try {
      await getLocationPermission();
      setPendingAction('in');
      setShowConfirmModal(true);
    } catch {
      // Error already shown in toast
    }
  };

  const handleClockOut = async () => {
    try {
      await getLocationPermission();
      setPendingAction('out');
      setShowConfirmModal(true);
    } catch {
      // Error already shown in toast
    }
  };

  const confirmClockIn = async () => {
    try {
      if (!location) throw new Error('Location not available');
      
      const entry = await clockIn(location);
      setActiveEntry(entry);
      setShowConfirmModal(false);
      setPendingAction(null);
      
      toast({
        title: 'Clocked In',
        description: `You clocked in at ${new Date(entry.clock_in_time).toLocaleTimeString()}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Clock In Failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const confirmClockOut = async () => {
    try {
      if (!location || !activeEntry) throw new Error('Missing data');
      
      const entry = await clockOut(activeEntry.id, location);
      setActiveEntry(null);
      setShowConfirmModal(false);
      setPendingAction(null);
      
      toast({
        title: 'Clocked Out',
        description: `You clocked out at ${new Date(entry.clock_out_time || new Date()).toLocaleTimeString()}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Clock Out Failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <Card p={8} bg={activeEntry ? successColor : bgColor}>
      <VStack spacing={8} align="center">
        {/* Current Time Display */}
        <VStack spacing={2} align="center">
          <Text fontSize="sm" color="gray.500">Current Time</Text>
          <Heading size="2xl" color={textColor} fontFamily="'Courier New', monospace">
            {formatTime(currentTime)}
          </Heading>
        </VStack>

        {/* Status Display */}
        {activeEntry ? (
          <VStack spacing={4} w="full" align="center">
            <HStack>
              <CheckCircle size={24} color="green" />
              <Text fontSize="lg" fontWeight="bold" color={textColor}>
                You are clocked in
              </Text>
            </HStack>
            
            <VStack spacing={2} bg={cardBgColor} p={4} rounded="lg" w="full">
              <HStack justify="space-between" w="full">
                <Text color="gray.500">Clock In Time:</Text>
                <Text fontWeight="bold" color={textColor}>
                  {formatTime(new Date(activeEntry.clock_in_time))}
                </Text>
              </HStack>
              
              <HStack justify="space-between" w="full">
                <Text color="gray.500">Duration:</Text>
                <Text fontWeight="bold" color={textColor}>
                  {calculateDuration(activeEntry.clock_in_time)}
                </Text>
              </HStack>
              
              {activeEntry.clock_in_location && (
                <HStack justify="space-between" w="full">
                  <HStack color="gray.500">
                    <MapPin size={16} />
                    <Text>Location:</Text>
                  </HStack>
                  <Text fontSize="sm" color={textColor}>
                    {activeEntry.clock_in_location.latitude.toFixed(4)}, {activeEntry.clock_in_location.longitude.toFixed(4)}
                  </Text>
                </HStack>
              )}
            </VStack>
          </VStack>
        ) : (
          <VStack spacing={2} align="center">
            <AlertCircle size={24} color="gray" />
            <Text color="gray.500">You are currently clocked out</Text>
          </VStack>
        )}

        {/* Location Info */}
        {location && (
          <HStack color="green.500" fontSize="sm">
            <MapPin size={16} />
            <Text>
              Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </HStack>
        )}

        {/* Clock In/Out Button */}
        <Button
          colorScheme={activeEntry ? 'red' : 'green'}
          size="lg"
          w="full"
          maxW="300px"
          isLoading={loading || loadingLocation}
          onClick={activeEntry ? handleClockOut : handleClockIn}
          leftIcon={<Clock size={20} />}
        >
          {activeEntry ? 'Clock Out' : 'Clock In'}
        </Button>

        {/* Location & Camera Note */}
        <Text fontSize="xs" color="gray.400" textAlign="center">
          📍 Geolocation and camera permissions may be required
        </Text>
      </VStack>

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {pendingAction === 'in' ? 'Confirm Clock In' : 'Confirm Clock Out'}
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <Box p={4} bg={infoBoxBgColor} rounded="md" w="full">
                <Text fontSize="sm" color={textColor}>
                  {pendingAction === 'in' 
                    ? 'You are about to clock in. Confirm?' 
                    : 'You are about to clock out. Confirm?'}
                </Text>
              </Box>
              {location && (
                <Box p={4} bg={locationBoxBgColor} rounded="md" w="full">
                  <HStack mb={2}>
                    <MapPin size={16} />
                    <Text fontSize="sm" fontWeight="bold">Location Captured</Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button 
              colorScheme={pendingAction === 'in' ? 'green' : 'red'}
              isLoading={loading}
              onClick={pendingAction === 'in' ? confirmClockIn : confirmClockOut}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
};
