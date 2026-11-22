import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  styles: {
    global: {
      body: {
        bg: '#f0f2f5',
        fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
      },
    },
  },
  colors: {
    primary: {
      50: '#e0f7fa',
      100: '#b2ebf2',
      200: '#80deea',
      300: '#4dd0e1',
      400: '#26c6da',
      500: '#00bcd4',
      600: '#00acc1',
      700: '#0097a7',
      800: '#00838f',
      900: '#006064',
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'cyan',
      },
      variants: {
        solid: {
          bg: 'linear-gradient(60deg, #26c6da, #00acc1)',
          color: 'white',
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0,.14), 0 7px 10px -5px rgba(0, 188, 212,.4)',
          _hover: {
            bg: 'linear-gradient(60deg, #00acc1, #0097a7)',
          },
        },
        danger: {
          bg: 'linear-gradient(60deg, #ef5350, #e53935)',
          color: 'white',
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0,.14), 0 7px 10px -5px rgba(244, 67, 54,.4)',
          _hover: {
            bg: 'linear-gradient(60deg, #e53935, #c62828)',
          },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          boxShadow: '0 1px 4px 0 rgba(0, 0, 0, 0.14)',
          borderRadius: '6px',
          bg: 'white',
        },
      },
    },
  },
})

export default theme;