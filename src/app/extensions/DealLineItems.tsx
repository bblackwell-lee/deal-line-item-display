// src/app/extensions/DealLineItems.tsx
import React, { useEffect, useState } from 'react';
import { 
  Text, 
  Flex, 
  hubspot, 
  Table, 
  TableHead, 
  TableRow, 
  TableHeader, 
  TableBody, 
  TableCell, 
  Spinner, 
  Alert 
} from '@hubspot/ui-extensions';

const DealLineItems = ({ context }) => {
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLineItems = async () => {
      try {
        // Get the current deal ID from context
        const dealId = context.parameters.hs_object_id;
        
        // Call the serverless function to get deal line items
        const response = await hubspot.serverless('get-deal-line-items', {
          dealId
        });
        
        setLineItems(response.lineItems || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching deal line items:', err);
        setError('Failed to load deal line items');
        setLoading(false);
      }
    };

    fetchLineItems();
  }, [context.parameters.hs_object_id]);

  if (loading) {
    return (
      <Flex align="center" justify="center" padding="md">
        <Spinner size="md" />
        <Text format={{ fontWeight: 'bold' }}>Loading line items...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert title="Error" variant="error">
        {error}
      </Alert>
    );
  }

  if (lineItems.length === 0) {
    return (
      <Flex align="center" justify="center" padding="md">
        <Text>No line items found for this deal</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="md">
      <Text format={{ fontSize: 'large', fontWeight: 'bold' }}>
        Deal Line Items
      </Text>
      
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Name</TableHeader>
            <TableHeader>Quantity</TableHeader>
            <TableHeader>Price</TableHeader>
            <TableHeader>Total</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lineItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>${item.price?.toFixed(2)}</TableCell>
              <TableCell>${(item.quantity * item.price).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Flex>
  );
};

export default hubspot.extend(({ context }) => <DealLineItems context={context} />);