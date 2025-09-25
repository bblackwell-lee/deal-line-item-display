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
  Alert,
  LoadingSpinner
} from '@hubspot/ui-extensions';

const DealLineItems = ({ context, runServerless }) => {
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLineItems = async () => {
      try {
        // Get the current deal ID from context using the proper path
        const dealId = context?.crm?.objectId;
        
        if (!dealId) {
          setError('No deal ID found. Cannot retrieve line items.');
          setLoading(false);
          return;
        }
        
        // Call the serverless function to get deal line items
        const response = await runServerless('get-deal-line-items', {
          dealId
        });
        
        if (!response || !Array.isArray(response.data)) {
          console.error('Unexpected response format:', response);
          setError('Invalid data format received from server');
          setLoading(false);
          return;
        }
        
        // Process items to ensure all required fields exist with proper types
        const processedItems = response.data.map(item => ({
          id: item?.id || Math.random().toString(),
          productName: item?.productName || 'Unknown Product',
          quantity: Number(item?.quantity || 0),
          price: Number(item?.price || 0),
        }));
        
        setLineItems(processedItems);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching deal line items:', err);
        setError('Failed to load deal line items');
        setLoading(false);
      }
    };

    fetchLineItems();
  }, [context, runServerless]);

  if (loading) {
    return (
      <Flex align="center" justify="center" padding="md">
        <LoadingSpinner label="Loading line items..." size="md" />
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
              <TableCell>{item.productName}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>${typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}</TableCell>
              <TableCell>${typeof item.quantity === 'number' && typeof item.price === 'number' 
                ? (item.quantity * item.price).toFixed(2) 
                : '0.00'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Flex>
  );
};

export default hubspot.extend(({ runServerless, context }) => {
  return <DealLineItems context={context} runServerless={runServerless} />;
});