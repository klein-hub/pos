import {
  Box,
  Heading,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { ClockInOut } from '../components/Attendance/ClockInOut';
import { LeaveRequestForm } from '../components/Attendance/LeaveRequestForm';
import { ApproverDashboard } from '../components/Attendance/ApproverDashboard';
import { AdminAnalytics } from '../components/Attendance/AdminAnalytics';
import { supabase } from '../lib/supabase';

type UserRole = 'employee' | 'approver' | 'admin';

export const AttendancePage = () => {
  const [employeeId, setEmployeeId] = useState<string>('');
  const [approverId, setApproverId] = useState<string>('');
  const [companyId, setCompanyId] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [loading, setLoading] = useState(true);

  const textColor = useColorModeValue('gray.900', 'white');

  // Load user context
  useEffect(() => {
    const loadUserContext = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setLoading(false);
          return;
        }

        // Get employee record
        const { data: employee } = await supabase
          .from('employee')
          .select('id, company_id, role')
          .eq('user_id', userData.user.id)
          .single();

        if (employee) {
          setEmployeeId(employee.id);
          setCompanyId(employee.company_id);
          
          // Determine role (this is simplified - you may have actual role fields)
          if (employee.role === 'admin') {
            setUserRole('admin');
          } else if (employee.role === 'approver') {
            setUserRole('approver');
            setApproverId(employee.id);
          } else {
            setUserRole('employee');
          }
        }
      } catch (error) {
        console.error('Error loading user context:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserContext();
  }, []);

  if (loading) {
    return (
      <Box p={8}>
        <Heading color={textColor}>Loading...</Heading>
      </Box>
    );
  }

  return (
    <Box p={6}>
      <Heading size="lg" mb={8} color={textColor}>
        Attendance Tracker
      </Heading>

      <Tabs colorScheme="blue" isFitted variant="enclosed">
        <TabList mb="1em">
          {/* Employee Tabs */}
          <Tab>Clock In/Out</Tab>
          <Tab>Leave Requests</Tab>
          
          {/* Approver Tabs */}
          {(userRole === 'approver' || userRole === 'admin') && (
            <Tab>Approvals</Tab>
          )}
          
          {/* Admin Tabs */}
          {userRole === 'admin' && (
            <Tab>Analytics</Tab>
          )}
        </TabList>

        <TabPanels>
          {/* A3: Clock In/Out */}
          <TabPanel>
            <ClockInOut />
          </TabPanel>

          {/* A4: Leave Requests */}
          <TabPanel>
            {employeeId && <LeaveRequestForm employeeId={employeeId} />}
          </TabPanel>

          {/* A5: Approver Dashboard */}
          {(userRole === 'approver' || userRole === 'admin') && (
            <TabPanel>
              {companyId && approverId && <ApproverDashboard companyId={companyId} approverId={approverId} />}
            </TabPanel>
          )}

          {/* A6: Admin Analytics */}
          {userRole === 'admin' && (
            <TabPanel>
              {companyId && <AdminAnalytics companyId={companyId} />}
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </Box>
  );
};
