// src/app/extensions/DealLineItems.tsx
    import React from 'react';
import { Text, Flex, hubspot } from '@hubspot/ui-extensions';

const DealLineItems = () => {
  return (
    <Flex align="center" justify="center">
      <Text format={{ fontSize: 'large', fontWeight: 'bold' }}>
        Hello World
      </Text>
    </Flex>
  );
};

export default hubspot.extend(() => <DealLineItems />);