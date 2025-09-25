
// src/app/extensions/DealLineItems.tsx
import { useState, useEffect, useCallback } from 'react';
import {
    Alert,
    Button,
    Flex,
    LoadingSpinner,
    Table,
    Text,
    Modal,
    ModalBody,
    hubspot
} from '@hubspot/ui-extensions';

// Type definitions
interface LineItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    amount: number;
}

const DealLineItems = ({ context, runServerlessFunction }) => {
    // Context
    const dealId = context.crm.objectId;

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    // Function to load line items - memoized to prevent recreation on each render
    const loadLineItems = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await runServerlessFunction({
                name: 'get-deal-line-items',
                parameters: { dealId }
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                setLineItems(actualResponse.data || []);
            } else {
                setError(actualResponse.message || 'Failed to load line items');
            }
        } catch (err) {
            setError('Error loading line items: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [runServerlessFunction, dealId]);

    // Load line items on component mount with proper dependencies
    useEffect(() => {
        loadLineItems();
    }, [loadLineItems]);

    // Open the iframe using HubSpot's UI Extensions SDK
    const openIframeModal = (lineItem: LineItem) => {
        // Generate URL with parameters
        const baseUrl = 'http://www.myform.com';
        const url = `${baseUrl}?lineItemId=${encodeURIComponent(lineItem.id)}&productId=${encodeURIComponent(lineItem.productId)}`;
        
        // Open the iframe in a modal using the proper HubSpot method
        hubspot.ui.openIframe({
            uri: url,
            size: 'LARGE',
            title: 'Line Item Form'
        });
    };

    // Render loading state
    if (loading) {
        return (
            <Flex direction="column" align="center" justify="center" gap="small">
                <LoadingSpinner />
                <Text>Loading line items...</Text>
            </Flex>
        );
    }

    // Render error state
    if (error) {
        return <Alert variant="error" title="Error">{error}</Alert>;
    }

    // Render empty state
    if (lineItems.length === 0) {
        return <Alert variant="info" title="No Line Items">This deal has no line items.</Alert>;
    }

    // Render line items table
    return (
        <Flex direction="column" gap="medium">
            <Text format={{ fontWeight: 'bold' }}>Deal Line Items</Text>
            
            <Table>
                <Table.Head>
                    <Table.Row>
                        <Table.Cell>Product Name</Table.Cell>
                        <Table.Cell>Product ID</Table.Cell>
                        <Table.Cell>Quantity</Table.Cell>
                        <Table.Cell>Price</Table.Cell>
                        <Table.Cell>Amount</Table.Cell>
                        <Table.Cell>Actions</Table.Cell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {lineItems.map((item) => (
                        <Table.Row key={item.id}>
                            <Table.Cell>{item.productName}</Table.Cell>
                            <Table.Cell>{item.productId}</Table.Cell>
                            <Table.Cell>{item.quantity}</Table.Cell>
                            <Table.Cell>${item.price.toFixed(2)}</Table.Cell>
                            <Table.Cell>${item.amount.toFixed(2)}</Table.Cell>
                            <Table.Cell>
                                <Button
                                    variant="primary"
                                    size="small"
                                    onClick={() => openIframeModal(item)}
                                >
                                    Open Form
                                </Button>
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </Flex>
    );
};

// HubSpot Extension Wrapper
export default hubspot.extend(({ context, runServerlessFunction }) => {
    try {
        return <DealLineItems context={context} runServerlessFunction={runServerlessFunction} />;
    } catch (error) {
        console.error('Error initializing extension:', error);
        return (
            <Alert variant="error" title="Extension Error">
                There was an error initializing the extension. Please refresh the page.
            </Alert>
        );
    }
});