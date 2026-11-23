'use client';

import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Link,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

function ArrowRightIcon(props?: Record<string, unknown>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CaretDownIcon(props?: Record<string, unknown>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function RowActionLink({
  href,
  children,
  label,
  onClick,
}: {
  href: string;
  children: ReactNode;
  label: string;
  /** Client-side behaviour the destination also supports via its query param. */
  onClick?: () => void;
}) {
  return (
    <Link
      as={NextLink}
      href={href}
      onClick={onClick}
      display="inline-flex"
      alignItems="center"
      gap={2}
      px={2.5}
      py={1.5}
      borderRadius="md"
      fontSize="sm"
      fontWeight="semibold"
      textDecoration="none"
      color="brand.800"
      bg="brand.50"
      borderWidth="1px"
      borderColor="brand.300"
      _hover={{ bg: 'brand.100', borderColor: 'brand.400', textDecoration: 'none' }}
      _focusVisible={{ boxShadow: 'focus' }}
      aria-label={label}
    >
      {children}
      <ArrowRightIcon boxSize={4} />
    </Link>
  );
}

export function RowActionButton({
  children,
  onClick,
  colorScheme = 'gray',
  isLoading = false,
}: {
  children: ReactNode;
  onClick: () => void;
  colorScheme?: 'gray' | 'brand' | 'sky' | 'mint' | 'warning' | 'danger';
  isLoading?: boolean;
}) {
  return (
    <Button
      size="xs"
      variant="outline"
      colorScheme={colorScheme}
      onClick={onClick}
      isLoading={isLoading}
      fontWeight="semibold"
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
      <CaretDownIcon boxSize={3.5} ml={1} aria-hidden="true" />
    </Button>
  );
}

export function Field({
  label,
  children,
  isRequired = false,
  helper,
  error,
}: {
  label: string;
  children: ReactNode;
  isRequired?: boolean;
  helper?: string;
  error?: string | null;
}) {
  const hasError = error !== undefined && error !== null && error !== '';
  return (
    <FormControl isRequired={isRequired} isInvalid={hasError}>
      <FormLabel fontSize="sm" fontWeight="semibold" mb={1}>
        {label}
      </FormLabel>
      {children}
      {hasError ? (
        <FormErrorMessage mt={1}>{error}</FormErrorMessage>
      ) : (
        helper !== undefined && <FormHelperText mt={1}>{helper}</FormHelperText>
      )}
    </FormControl>
  );
}
