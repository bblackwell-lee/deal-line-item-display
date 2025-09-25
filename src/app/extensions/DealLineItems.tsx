// src/app/extensions/DealLineItems.tsx
import { useState, useEffect, useCallback } from 'react';
import {
    Alert,
    Button,
    Flex,
    LoadingSpinner,
    Table,
    Text,
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
    product: {
        id: string;
        name: string;
        price: number;
        description: string;
        sku: string;
    } | null;
    ticketId?: string;
}

const DealLineItems = ({ context, runServerlessFunction }) => {
    // Context
    const dealId = context?.crm?.objectId;
    
    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    
    // Function to load line items
    const loadLineItems = useCallback(async () => {
        if (!dealId) {
            setError('Missing deal ID');
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError('');

        try {
            const response = await runServerlessFunction({
                name: 'get-deal-line-items',
                parameters: { dealId }
            });

            let actualResponse = response;
            if (response?.status === "SUCCESS" && response?.response) {
                actualResponse = response.response;
            }

            if (actualResponse?.success) {
                setLineItems(Array.isArray(actualResponse.data) ? actualResponse.data : []);
            } else {
                setError(actualResponse?.message || 'Failed to load line items');
            }
        } catch (err) {
            setError('Error loading line items: ' + (err?.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [runServerlessFunction, dealId]);

    // Load line items on component mount
    useEffect(() => {
        loadLineItems();
    }, [loadLineItems]);

    // Open the iframe using HubSpot's UI Extensions SDK
    const openIframeModal = (lineItem: LineItem) => {
        if (!lineItem?.id) return;
        
        const baseUrl = 'http://www.myform.com';
        const url = `${baseUrl}?lineItemId=${encodeURIComponent(lineItem.id)}&productId=${encodeURIComponent(lineItem.productId || '')}`;
        
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

    // Validate line items before rendering
    if (!Array.isArray(lineItems)) {
        return <Alert variant="error" title="Data Error">Invalid line items data structure</Alert>;
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
                        <Table.Row key={item?.id || Math.random().toString()}>
                            <Table.Cell>{item?.productName || 'N/A'}</Table.Cell>
                            <Table.Cell>{item?.productId || 'N/A'}</Table.Cell>
                            <Table.Cell>{item?.quantity || 0}</Table.Cell>
                            <Table.Cell>${(item?.price || 0).toFixed(2)}</Table.Cell>
                            <Table.Cell>${(item?.amount || 0).toFixed(2)}</Table.Cell>
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

// HubSpot Extension Wrapper with defensive coding
export default hubspot.extend(({ context, runServerlessFunction }) => {
    if (!context || !runServerlessFunction) {
        console.error('Missing required props in extension');
        return <Alert variant="error">Extension initialization error</Alert>;
    }
    
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