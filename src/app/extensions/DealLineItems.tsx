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
    // Context - add safety check
    const dealId = context?.crm?.objectId;

    // State with proper initialization
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    // Function to load line items with better error handling
    const loadLineItems = useCallback(async () => {
        if (!dealId) {
            setError('Missing deal ID');
            setLoading(false);
            return;
        }

        if (!runServerlessFunction) {
            setError('Serverless function not available');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('Loading line items for deal:', dealId);

            const response = await runServerlessFunction({
                name: 'get-deal-line-items',
                parameters: { dealId }
            });

            console.log('Raw response:', response);

            // Handle different response formats more robustly
            let actualResponse = response;

            // Handle nested response structures
            if (response?.status === "SUCCESS" && response?.response) {
                actualResponse = response.response;
            } else if (response?.response && typeof response.response === 'object') {
                actualResponse = response.response;
            }

            // Check for success in the response
            if (actualResponse && actualResponse.success === true) {
                const data = actualResponse.data;
                if (Array.isArray(data)) {
                    console.log('Setting line items:', data);
                    // Validate each line item before setting state
                    const validatedItems = data.filter(item =>
                        item && typeof item === 'object' && item.id
                    );
                    setLineItems(validatedItems);
                } else if (data === null || data === undefined) {
                    console.log('No line items returned');
                    setLineItems([]);
                } else {
                    console.warn('Invalid data format:', data);
                    setLineItems([]);
                }
            } else {
                const errorMsg = actualResponse?.message || response?.message || 'Failed to load line items';
                console.error('API error:', errorMsg, 'Full response:', response);
                setError(errorMsg);
                setLineItems([]);
            }
        } catch (err: any) {
            console.error('Error loading line items:', err);
            const errorMessage = err?.message || err?.toString() || 'Unknown error';
            setError('Error loading line items: ' + errorMessage);
            setLineItems([]);
        } finally {
            setLoading(false);
        }
    }, [runServerlessFunction, dealId]);

    // Load line items on component mount
    useEffect(() => {
        if (dealId && runServerlessFunction) {
            loadLineItems();
        } else {
            setLoading(false);
            if (!dealId) setError('No deal ID available');
            if (!runServerlessFunction) setError('Serverless function not available');
        }
    }, [loadLineItems, dealId, runServerlessFunction]);

    // Open the iframe using HubSpot's UI Extensions SDK
    const openIframeModal = useCallback((lineItem: LineItem) => {
        // Add this null check
        if (!lineItem) {
            console.warn('Cannot open modal: line item is null or undefined');
            setError('Cannot open form: invalid line item data');
            return;
        }

        if (!lineItem?.id) {
            console.warn('Cannot open modal: missing line item ID');
            setError('Cannot open form: missing line item data');
            return;
        }

        const baseUrl = 'http://www.myform.com';
        const url = `${baseUrl}?lineItemId=${encodeURIComponent(lineItem.id)}&productId=${encodeURIComponent(lineItem.productId || '')}`;

        try {
            console.log('Opening iframe with URL:', url);
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
        return (
            <Alert variant="error" title="Context Error">
                <Text>Missing context data. Please refresh the page.</Text>
            </Alert>
        );
    }

    if (!dealId) {
        return (
            <Alert variant="error" title="Deal ID Error">
                <Text>No deal ID found in context. Context: {JSON.stringify(context)}</Text>
            </Alert>
        );
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
        return (
            <Alert variant="error" title="Error">
                <Text>{error}</Text>
                <Button onClick={loadLineItems} variant="secondary" size="small">
                    Try Again
                </Button>
            </Alert>
        );
    }

    // Render empty state
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return (
            <Flex direction="column" gap="medium">
                <Alert variant="info" title="No Line Items">
                    <Text>This deal has no line items.</Text>
                </Alert>
                <Button onClick={loadLineItems} variant="secondary" size="small">
                    Refresh
                </Button>
            </Flex>
        );
    }

    // Render line items table
    return (
        <Flex direction="column" gap="medium">
            <Flex justify="space-between" align="center">
                <Text format={{ fontWeight: 'bold' }}>
                    Deal Line Items ({lineItems.length})
                </Text>
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
                    {(Array.isArray(lineItems) ? lineItems : []).map((item, index) => {
                        // Ensure we have valid data for each item
                        if (!item || typeof item !== 'object') {
                            console.warn('Invalid line item at index', index, item);
                            return null;
                        }

                        // Generate a stable key - prefer ID, fallback to index
                        const key = item.id || `line-item-${index}`;

                        return (
                            <Table.Row key={key}>
                                <Table.Cell>
                                    <Text>{item.productName || 'N/A'}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>{item.productId || 'N/A'}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>{String(item.quantity || 0)}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>${Number(item.price || 0).toFixed(2)}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>${Number(item.amount || 0).toFixed(2)}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Button
                                        variant="primary"
                                        size="small"
                                        onClick={() => openIframeModal(item)}
                                        disabled={!item.id}
                                    >
                                        Open Form
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        );
                    }).filter(Boolean)} {/* Remove null items */}
                </Table.Body>
            </Table>
        </Flex>
    );
};

// Error Boundary Component
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('DealLineItems Error Boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Alert variant="error" title="Component Error">
                    <Text>Something went wrong with the line items component.</Text>
                    <Text format={{ fontStyle: 'italic', fontSize: 'small' }}>
                        {this.state.error?.message || 'Unknown error occurred'}
                    </Text>
                    <Button
                        onClick={() => this.setState({ hasError: false, error: undefined })}
                        variant="secondary"
                        size="small"
                    >
                        Reset Component
                    </Button>
                </Alert>
            );
        }

        return this.props.children;
    }
}

// HubSpot Extension Wrapper with comprehensive error handling
const WrappedDealLineItems = (props: any) => {
    const { context, runServerlessFunction } = props;

    // Validate props
    if (!props) {
        console.error('No props provided to extension');
        return (
            <Alert variant="error" title="Extension Error">
                <Text>No props provided. Please refresh the page.</Text>
            </Alert>
        );
    }

    if (!context) {
        console.error('Missing context in extension props');
        return (
            <Alert variant="error" title="Context Error">
                <Text>Missing context data. Please refresh the page.</Text>
            </Alert>
        );
    }

    if (!runServerlessFunction) {
        console.error('Missing runServerlessFunction in extension props');
        return (
            <Alert variant="error" title="Function Error">
                <Text>Serverless function not available. Please refresh the page.</Text>
            </Alert>
        );
    }

    // Wrap the main component in error boundary
    return (
        <ErrorBoundary>
            <DealLineItems context={context} runServerlessFunction={runServerlessFunction} />
        </ErrorBoundary>
    );
};

export default hubspot.extend(WrappedDealLineItems);