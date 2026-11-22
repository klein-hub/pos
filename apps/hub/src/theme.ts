import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = { initialColorMode: 'light', useSystemColorMode: false };

/**
 * The launcher is the first thing anyone sees, so it sets the house style the
 * other apps follow — same Roboto, same espresso accent as the admin app.
 */
export default extendTheme({
  config,
  styles: {
    global: {
      body: { bg: '#ece9f1', fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif" },
    },
  },
  colors: {
    primary: {
      50: '#f5efe8', 100: '#e6d5c3', 200: '#d5b89b', 300: '#c39b73', 400: '#b58555',
      500: '#a76f38', 600: '#946231', 700: '#7d5228', 800: '#664220', 900: '#4a2f16',
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'orange' },
      variants: {
        solid: {
          bg: 'linear-gradient(60deg, #b58555, #946231)',
          color: 'white',
          _hover: { bg: 'linear-gradient(60deg, #946231, #7d5228)' },
        },
      },
    },
  },
});
