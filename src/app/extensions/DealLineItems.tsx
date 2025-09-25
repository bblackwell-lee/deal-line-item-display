// src/app/extensions/DealLineItems.tsx
import React, { useState, useEffect, useCallback } from 'react';
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

interface DealLineItemsProps {
    context: any;
    runServerlessFunction: any;
}

const DealLineItems: React.FC<DealLineItemsProps> = ({ context, runServerlessFunction }) => {
    // Context
    const dealId = context?.crm?.objectId;

    // State
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
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
        } catch (err: any) {
            console.error('Error loading line items:', err);
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
    const openIframeModal = useCallback((lineItem: LineItem) => {
        if (!lineItem?.id) {
            console.warn('Cannot open modal: missing line item ID');
            return;
        }

        const baseUrl = 'http://www.myform.com';
        const url = `${baseUrl}?lineItemId=${encodeURIComponent(lineItem.id)}&productId=${encodeURIComponent(lineItem.productId || '')}`;

        try {
            hubspot.ui.openIframe({
                uri: url,
                size: 'LARGE',
                title: 'Line Item Form'
            });
        } catch (error) {
            console.error('Error opening iframe:', error);
            setError('Failed to open form');
        }
    }, []);

    // Early return for missing context
    if (!context) {
        return <Alert variant="error" title="Context Error">Missing context data</Alert>;
    }

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
        console.error('Invalid line items data:', lineItems);
        return <Alert variant="error" title="Data Error">Invalid line items data structure</Alert>;
    }

    // Render empty state
    if (lineItems.length === 0) {
        return (
            <Alert variant="info" title="No Line Items">
                This deal has no line items.
                <Button onClick={loadLineItems} variant="secondary" size="small">
                    Refresh
                </Button>
            </Alert>
        );
    }

    // Render line items table
    return (
        <Flex direction="column" gap="medium">
            <Flex justify="space-between" align="center">
                <Text format={{ fontWeight: 'bold' }}>Deal Line Items ({lineItems.length})</Text>
                <Button onClick={loadLineItems} variant="secondary" size="small">
                    Refresh
                </Button>
            </Flex>

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
                    {lineItems.map((item, index) => {
                        // Generate a stable key
                        const key = item?.id || `line-item-${index}`;

                        return (
                            <Table.Row key={key}>
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
                                        disabled={!item?.id}
                                    >
                                        Open Form
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table>
        </Flex>
    );
};

// HubSpot Extension Wrapper with better error handling
const WrappedDealLineItems = ({ context, runServerlessFunction }: any) => {
    if (!context || !runServerlessFunction) {
        console.error('Missing required props in extension:', { context: !!context, runServerlessFunction: !!runServerlessFunction });
        return (
            <Alert variant="error" title="Extension Error">
                Missing required extension props. Please refresh the page.
            </Alert>
        );
    }

    try {
        return <DealLineItems context={context} runServerlessFunction={runServerlessFunction} />;
    } catch (error) {
        console.error('Error initializing extension:', error);
        return (
            <Alert variant="error" title="Extension Error">
                There was an error initializing the extension. Please refresh the page.
                <br />
                <Text format={{ fontStyle: 'italic', fontSize: 'small' }}>
                    Error: {error instanceof Error ? error.message : 'Unknown error'}
                </Text>
            </Alert>
        );
    }
};

export default hubspot.extend(WrappedDealLineItems);