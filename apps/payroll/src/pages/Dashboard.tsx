import { Box, Grid, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export const Dashboard = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');

  const revenueData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Revenue',
        data: [2200, 2500, 3300, 1500, 4200, 2800],
        borderColor: 'rgb(99, 179, 237)',
        backgroundColor: 'rgba(99, 179, 237, 0.5)',
      },
      {
        label: 'Expenses',
        data: [3300, 3000, 4800, 2400, 4300, 2700],
        borderColor: 'rgb(245, 101, 101)',
        backgroundColor: 'rgba(245, 101, 101, 0.5)',
      },
    ],
  };

  const budgetData = {
    labels: ['Products', 'Services', 'Marketing', 'Other'],
    datasets: [
      {
        data: [35, 25, 20, 20],
        backgroundColor: [
          'rgba(99, 179, 237, 0.8)',
          'rgba(245, 101, 101, 0.8)',
          'rgba(236, 201, 75, 0.8)',
          'rgba(72, 187, 120, 0.8)',
        ],
        borderColor: [
          'rgba(99, 179, 237, 1)',
          'rgba(245, 101, 101, 1)',
          'rgba(236, 201, 75, 1)',
          'rgba(72, 187, 120, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <Box>
      <Heading mb={8} color={textColor}>Analytics Dashboard</Heading>
      
      <Grid templateColumns="repeat(2, 1fr)" gap={8}>
        <Box bg={cardBg} p={6} rounded="xl" shadow="sm" borderWidth={1} borderColor={borderColor}>
          <Text fontSize="xl" fontWeight="medium" mb={4} color={textColor}>Revenue vs Expenses</Text>
          <Line data={revenueData} options={{
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  color: borderColor,
                },
                ticks: {
                  callback: function(value) {
                    return '₱' + value.toLocaleString();
                  }
                }
              },
              x: {
                grid: {
                  color: borderColor,
                },
              },
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += '₱' + context.parsed.y.toLocaleString();
                    }
                    return label;
                  }
                }
              }
            }
          }} />
        </Box>

        <Box bg={cardBg} p={6} rounded="xl" shadow="sm" borderWidth={1} borderColor={borderColor}>
          <Text fontSize="xl" fontWeight="medium" mb={4} color={textColor}>Budget Distribution</Text>
          <Box maxW="400px" mx="auto">
            <Doughnut data={budgetData} options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom',
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.parsed}%`;
                    }
                  }
                }
              },
            }} />
          </Box>
        </Box>
      </Grid>
    </Box>
  );
};