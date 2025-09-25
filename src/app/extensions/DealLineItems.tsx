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
  LoadingSpinner,
  Button
} from '@hubspot/ui-extensions';

const DealLineItems = ({ context, runServerless }) => {
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const fetchLineItems = async () => {
    try {
      setLoading(true);
      // Get the current deal ID from context using the proper path
      const dealId = context?.crm?.objectId;
      
      if (!dealId) {
        setError('No deal ID found. Cannot retrieve line items.');
        setLoading(false);
        return;
      }
      
      console.log(`Fetching line items for deal: ${dealId}`);
      
      // Call the serverless function to get deal line items - UPDATED to match DealProductConfiguration pattern
      const response = await runServerless({
        name: 'get-deal-line-items', 
        parameters: { dealId }
      });
      
      // Store debug information - also update how we handle response
      setDebugInfo(response);
      
      // Safety check for response structure
      if (!response) {
        setError('Empty response received from server');
        setLoading(false);
        return;
      }
      
      // Extract data safely with the correct response pattern
      let actualResponse = response;
      if (response.status === "SUCCESS" && response.response) {
        actualResponse = response.response;
      }

      // Access data from the correct response structure
      const responseData = actualResponse.data || [];
      const items = Array.isArray(responseData) ? responseData : [];
      
      console.log(`Retrieved ${items.length} line items`);
      
      // Process items to ensure all required fields exist with proper types
      const processedItems = items.map(item => ({
        id: String(item?.id || Math.random()),
        productName: String(item?.productName || 'Unknown Product'),
        quantity: Number(item?.quantity || 0),
        price: Number(item?.price || 0),
      }));
      
      setLineItems(processedItems);
    } catch (err) {
      console.error('Error fetching deal line items:', err);
      setError(`Failed to load deal line items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
        <Button onClick={fetchLineItems}>Retry</Button>
      </Flex>
    );
  }

  if (lineItems.length === 0) {
    return (
      <Flex align="center" justify="center" padding="md" direction="column" gap="md">
        <Text>No line items found for this deal</Text>
        <Button onClick={fetchLineItems}>Refresh</Button>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="md">
      <Flex justify="space-between" align="center">
        <Text format={{ fontSize: 'large', fontWeight: 'bold' }}>
          Deal Line Items ({lineItems.length})
        </Text>
        <Button variant="secondary" onClick={fetchLineItems}>Refresh</Button>
      </Flex>
      
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
      
      <Text format={{ fontSize: 'small', color: 'gray' }}>
        Last updated: {new Date().toLocaleString()}
      </Text>
    </Flex>
  );
};

export default hubspot.extend(({ runServerless, context }) => {
  return <DealLineItems context={context} runServerless={runServerless} />;
});