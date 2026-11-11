import { extendTheme, type SystemStyleObject, type ThemeConfig } from '@chakra-ui/react';

/**
 * NOVA PMS design system — Sky & Mint.
 *
 * All visual values live here. Components must use these tokens instead of
 * raw hex values so the product keeps one consistent visual language.
 */

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const brand = {
  50: '#E8F5FD',
  100: '#D0EBFB',
  200: '#A6DAF7',
  300: '#79C7F1',
  400: '#57B3EA',
  500: '#39A7E8',
  600: '#248FCB',
  700: '#1B76A8',
  800: '#175F86',
  900: '#144E6D',
};

const sky = brand;

const mint = {
  50: '#E8F8F2',
  100: '#CFF1E5',
  200: '#A6E4D2',
  300: '#7CD6BE',
  400: '#5ACFAC',
  500: '#48C9A5',
  600: '#2FAF8B',
  700: '#248C70',
  800: '#1E705A',
  900: '#1A5A4A',
};

const lime = {
  50: '#F6FDEB',
  100: '#EBFBD1',
  200: '#DEF8AC',
  300: '#D0F58A',
  400: '#CBF477',
  500: '#C7F36B',
  600: '#ABD84A',
  700: '#87B430',
  800: '#698C27',
  900: '#527020',
};

const warning = {
  50: '#FEF8EB',
  100: '#FDEFD0',
  200: '#FADFA1',
  300: '#F6CC71',
  400: '#F4C15E',
  500: '#F2B84B',
  600: '#D99A2E',
  700: '#B37720',
  800: '#8F5D1D',
  900: '#744B1B',
};

const danger = {
  50: '#FDF0F1',
  100: '#FADDE0',
  200: '#F3B7BD',
  300: '#EB9199',
  400: '#E87E86',
  500: '#E46B72',
  600: '#C94F57',
  700: '#A63D44',
  800: '#85333A',
  900: '#6D2E34',
};

const gray = {
  50: '#F3F7FB',
  100: '#EAF1F8',
  200: '#E3EAF2',
  300: '#CBD7E4',
  400: '#98A9BC',
  500: '#62748A',
  600: '#4E6177',
  700: '#3A4D63',
  800: '#243B53',
  900: '#172B4D',
};

const focusRing = '0 0 0 3px rgba(57, 167, 232, 0.32)';

interface ButtonTone {
  fg: string;
  bg: string;
  hover: string;
  active: string;
  border: string;
}

/**
 * Solid/outline button tones are deliberately darker than the decorative
 * accents so white text and button labels keep AA contrast. The lighter sky
 * and mint values remain available for icons, indicators and soft badges.
 */
const BUTTON_TONES: Record<string, ButtonTone> = {
  brand: {
    fg: 'brand.700',
    bg: 'brand.700',
    hover: 'brand.800',
    active: 'brand.900',
    border: 'brand.200',
  },
  sky: {
    fg: 'sky.700',
    bg: 'sky.700',
    hover: 'sky.800',
    active: 'sky.900',
    border: 'sky.200',
  },
  mint: {
    fg: 'mint.800',
    bg: 'mint.800',
    hover: 'mint.900',
    active: 'mint.900',
    border: 'mint.200',
  },
  warning: {
    fg: 'warning.800',
    bg: 'warning.800',
    hover: 'warning.900',
    active: 'warning.900',
    border: 'warning.200',
  },
  danger: {
    fg: 'danger.700',
    bg: 'danger.700',
    hover: 'danger.800',
    active: 'danger.900',
    border: 'danger.200',
  },
  gray: {
    fg: 'gray.700',
    bg: 'gray.600',
    hover: 'gray.700',
    active: 'gray.800',
    border: 'gray.200',
  },
};

function buttonTone(props: Record<string, unknown>): ButtonTone {
  const scheme = typeof props.colorScheme === 'string' ? props.colorScheme : 'gray';
  return (
    BUTTON_TONES[scheme] ?? {
      fg: `${scheme}.700`,
      bg: `${scheme}.600`,
      hover: `${scheme}.700`,
      active: `${scheme}.800`,
      border: `${scheme}.200`,
    }
  );
}

function solidButton(props: Record<string, unknown>): SystemStyleObject {
  const tone = buttonTone(props);
  return {
    bg: tone.bg,
    color: 'white',
    _hover: { bg: tone.hover },
    _active: { bg: tone.active },
    _disabled: { bg: 'gray.200', color: 'gray.500', opacity: 1 },
  };
}

function outlineButton(props: Record<string, unknown>): SystemStyleObject {
  const tone = buttonTone(props);
  return {
    borderColor: tone.border,
    color: tone.fg,
    bg: 'transparent',
    _hover: { bg: `${tone.border.split('.')[0]}.50` },
    _active: { bg: `${tone.border.split('.')[0]}.100` },
    _disabled: { opacity: 0.5 },
  };
}

function ghostButton(props: Record<string, unknown>): SystemStyleObject {
  const tone = buttonTone(props);
  return {
    color: tone.fg,
    _hover: { bg: `${tone.border.split('.')[0]}.50` },
    _active: { bg: `${tone.border.split('.')[0]}.100` },
    _disabled: { opacity: 0.5 },
  };
}

const theme = extendTheme({
  config,
  colors: {
    brand,
    sky,
    mint,
    lime,
    warning,
    danger,
    gray,
    canvas: '#F3F7FB',
    surface: '#FFFFFF',
    sidebar: '#102A43',
    sidebarHover: '#1B3B5A',
    textPrimary: '#172B4D',
    textSecondary: '#62748A',
    line: '#E3EAF2',
    skySoft: '#E8F5FD',
    mintSoft: '#E8F8F2',
    limeSoft: '#F6FDEB',
    overlay: 'rgba(16, 42, 67, 0.55)',
  },
  fonts: {
    heading:
      'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    body: 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '0.9375rem',
    lg: '1.0625rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.75rem',
  },
  radii: {
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '14px',
    '2xl': '18px',
    full: '9999px',
  },
  shadows: {
    card: '0 1px 2px rgba(16, 42, 67, 0.04), 0 10px 28px rgba(16, 42, 67, 0.05)',
    cardHover: '0 2px 6px rgba(16, 42, 67, 0.06), 0 16px 36px rgba(16, 42, 67, 0.08)',
    modal: '0 24px 64px rgba(16, 42, 67, 0.22), 0 4px 12px rgba(16, 42, 67, 0.08)',
    focus: focusRing,
  },
  styles: {
    global: {
      'html, body': {
        minHeight: '100%',
        backgroundColor: 'canvas',
      },
      body: {
        color: 'textPrimary',
        fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      '*::selection': {
        backgroundColor: 'mint.200',
        color: 'textPrimary',
      },
      ':focus-visible': {
        outline: '2px solid',
        outlineColor: 'brand.500',
        outlineOffset: '2px',
      },
    },
  },
  components: {
    Heading: {
      baseStyle: {
        color: 'textPrimary',
        fontWeight: 'semibold',
        letterSpacing: '-0.01em',
      },
    },
    Button: {
      baseStyle: {
        borderRadius: 'lg',
        fontWeight: 'semibold',
        _focusVisible: { boxShadow: focusRing },
      },
      variants: {
        solid: solidButton,
        outline: outlineButton,
        ghost: ghostButton,
      },
      defaultProps: {
        colorScheme: 'gray',
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        fontWeight: 'semibold',
        letterSpacing: '0.01em',
        textTransform: 'none',
        px: 2,
        py: 0.5,
      },
      defaultProps: {
        variant: 'subtle',
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: 'surface',
            borderColor: 'line',
            borderRadius: 'lg',
            _hover: { borderColor: 'gray.300' },
            _focusVisible: { borderColor: 'brand.500', boxShadow: focusRing },
          },
        },
      },
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            bg: 'surface',
            borderColor: 'line',
            borderRadius: 'lg',
            _hover: { borderColor: 'gray.300' },
            _focusVisible: { borderColor: 'brand.500', boxShadow: focusRing },
          },
        },
      },
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: 'surface',
          borderColor: 'line',
          borderRadius: 'lg',
          _hover: { borderColor: 'gray.300' },
          _focusVisible: { borderColor: 'brand.500', boxShadow: focusRing },
        },
      },
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Tabs: {
      defaultProps: {
        colorScheme: 'brand',
        variant: 'line',
      },
      variants: {
        line: {
          tab: {
            fontWeight: 'semibold',
            color: 'textSecondary',
            _selected: { color: 'brand.700', borderColor: 'brand.500' },
            _hover: { color: 'brand.600' },
            _focusVisible: { boxShadow: focusRing, borderRadius: 'md' },
          },
        },
      },
    },
    Link: {
      baseStyle: {
        color: 'brand.700',
        _hover: { color: 'brand.800' },
      },
    },
    MenuList: {
      baseStyle: {
        borderColor: 'line',
        borderRadius: 'xl',
        boxShadow: 'card',
        py: 2,
      },
    },
    MenuItem: {
      baseStyle: {
        fontSize: 'sm',
        _focus: { bg: 'skySoft' },
      },
    },
    // Chakra v2 models Modal and Drawer as multi-part components. Overrides must
    // live under the component key using part names (dialog, header, body…);
    // `ModalContent` / `DrawerContent` keys are silently ignored by the theme.
    Modal: {
      baseStyle: {
        overlay: { bg: 'overlay' },
        dialog: {
          bg: 'surface',
          color: 'textPrimary',
          borderWidth: '1px',
          borderColor: 'line',
          borderRadius: '2xl',
          boxShadow: 'modal',
          overflow: 'hidden',
        },
        header: {
          px: 6,
          py: 5,
          fontSize: 'lg',
          fontWeight: 'semibold',
          color: 'textPrimary',
          borderBottomWidth: '1px',
          borderColor: 'line',
        },
        body: {
          px: 6,
          py: 5,
        },
        footer: {
          px: 6,
          py: 4,
          bg: 'gray.50',
          borderTopWidth: '1px',
          borderColor: 'line',
          gap: 2,
        },
        closeButton: {
          top: 4,
          insetEnd: 4,
          borderRadius: 'md',
          color: 'textSecondary',
          _hover: { bg: 'gray.100', color: 'textPrimary' },
          _focusVisible: { boxShadow: focusRing },
        },
      },
    },
    Drawer: {
      baseStyle: {
        overlay: { bg: 'overlay' },
        dialog: {
          bg: 'surface',
          color: 'textPrimary',
          borderColor: 'line',
          boxShadow: 'modal',
        },
        header: {
          px: 6,
          py: 5,
          fontSize: 'lg',
          fontWeight: 'semibold',
          color: 'textPrimary',
          borderBottomWidth: '1px',
          borderColor: 'line',
        },
        body: { px: 6, py: 5 },
        footer: {
          px: 6,
          py: 4,
          bg: 'gray.50',
          borderTopWidth: '1px',
          borderColor: 'line',
        },
        closeButton: {
          top: 4,
          insetEnd: 4,
          borderRadius: 'md',
          color: 'textSecondary',
          _hover: { bg: 'gray.100', color: 'textPrimary' },
          _focusVisible: { boxShadow: focusRing },
        },
      },
    },
    Divider: {
      baseStyle: {
        borderColor: 'line',
      },
    },
    Spinner: {
      defaultProps: {
        color: 'brand.500',
      },
    },
  },
});

export default theme;
