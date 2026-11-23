'use client';

import { Flex, HStack, ModalHeader, Stack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { ActionDialogToneStyles } from './action-dialog-tone';

export function DialogHeader({
  styles,
  title,
  summary,
}: {
  styles: ActionDialogToneStyles;
  title: string;
  summary: string;
}) {
  const { t } = useI18n();
  const Icon = styles.icon;

  return (
    <ModalHeader>
      <HStack spacing={3} align="flex-start" pr={8}>
        <Flex
          boxSize="38px"
          flexShrink={0}
          align="center"
          justify="center"
          borderRadius="lg"
          bg={styles.iconBg}
          color={styles.iconColor}
          aria-hidden="true"
        >
          <Icon boxSize={5} />
        </Flex>
        <Stack spacing={1} minW={0}>
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.1em" color={styles.iconColor}>
            {t(styles.eyebrowKey).toUpperCase()}
          </Text>
          <Text fontSize="lg" fontWeight="semibold" lineHeight="1.25">
            {title}
          </Text>
          <Text fontSize="sm" fontWeight="normal" color="textSecondary">
            {summary}
          </Text>
        </Stack>
      </HStack>
    </ModalHeader>
  );
}
