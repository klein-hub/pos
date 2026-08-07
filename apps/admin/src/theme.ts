import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

/**
 * Same design language as the payroll app — gradient solid buttons, soft card
 * shadows, Roboto — with an espresso accent instead of cyan so the two products
 * read as siblings rather than clones.
 */
const theme = extendTheme({
  config,
  styles: {
    global: {
      body: {
        bg: '#f6f4f1',
        fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
      },
    },
  },
  colors: {
    primary: {
      50: '#f5efe8',
      100: '#e6d5c3',
      200: '#d5b89b',
      300: '#c39b73',
      400: '#b58555',
      500: '#a76f38',
      600: '#946231',
      700: '#7d5228',
      800: '#664220',
      900: '#4a2f16',
    },
    // Margin health, used consistently across every cost and price surface.
    margin: {
      good: '#2f855a',
      watch: '#b7791f',
      bad: '#c53030',
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'orange' },
      variants: {
        solid: {
          bg: 'linear-gradient(60deg, #b58555, #946231)',
          color: 'white',
          boxShadow: '0 4px 20px 0 rgba(0,0,0,.14), 0 7px 10px -5px rgba(167,111,56,.4)',
          _hover: { bg: 'linear-gradient(60deg, #946231, #7d5228)' },
        },
        danger: {
          bg: 'linear-gradient(60deg, #ef5350, #e53935)',
          color: 'white',
          boxShadow: '0 4px 20px 0 rgba(0,0,0,.14), 0 7px 10px -5px rgba(244,67,54,.4)',
          _hover: { bg: 'linear-gradient(60deg, #e53935, #c62828)' },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          boxShadow: '0 1px 4px 0 rgba(0,0,0,0.14)',
          borderRadius: '10px',
        },
      },
    },
  },
});

export default theme;
