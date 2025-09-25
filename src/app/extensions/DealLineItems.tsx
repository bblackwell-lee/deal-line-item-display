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
  const [debugInfo, setDebugInfo] = useState(null);

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
        const rawResponse = await runServerless('get-deal-line-items', {
          dealId
        });
        
        // Store debug information
        setDebugInfo(rawResponse);
        
        // Safety check for response structure
        if (!rawResponse) {
          setError('Empty response received from server');
          setLoading(false);
          return;
        }
        
        // Extract data safely
        const responseData = rawResponse.data || rawResponse.response?.data || [];
        const items = Array.isArray(responseData) ? responseData : [];
        
        // Process items to ensure all required fields exist with proper types
        const processedItems = items.map(item => ({
          id: String(item?.id || Math.random()),
          productName: String(item?.productName || 'Unknown Product'),
          quantity: Number(item?.quantity || 0),
          price: Number(item?.price || 0),
        }));
        
        setLineItems(processedItems);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching deal line items:', err);
        setError(`Failed to load deal line items: ${err.message}`);
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
      <Flex direction="column" gap="md">
        <Alert title="Error" variant="error">
          {error}
        </Alert>
        {debugInfo && (
          <Flex direction="column" gap="xs">
            <Text format={{ fontWeight: 'bold' }}>Debug Information:</Text>
            <Text>{JSON.stringify(debugInfo, null, 2)}</Text>
          </Flex>
        )}
      </Flex>
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
              <TableCell>${item.price.toFixed(2)}</TableCell>
              <TableCell>${(item.quantity * item.price).toFixed(2)}</TableCell>
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