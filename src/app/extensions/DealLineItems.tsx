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
    actions: {
        openIframeModal: (config: any, callback?: () => void) => void;
    };
}

const DealLineItems: React.FC<DealLineItemsProps> = ({ context, runServerlessFunction, actions }) => {
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
                    // MORE RIGOROUS VALIDATION HERE:
                    const validatedItems = data.filter(item => {
                        // Basic structure validation
                        if (!item || typeof item !== 'object' || !item.id) return false;
                        
                        // Ensure properties are the expected types
                        try {
                            // Convert properties to expected types to ensure they're valid
                            const validItem = {
                                id: String(item.id || ''),
                                productId: String(item.productId || ''),
                                productName: String(item.productName || ''),
                                quantity: Number(item.quantity || 0),
                                price: Number(item.price || 0),
                                amount: Number(item.amount || 0),
                                product: item.product ? {
                                    id: String(item.product.id || ''),
                                    name: String(item.product.name || ''),
                                    price: Number(item.product.price || 0),
                                    description: String(item.product.description || ''),
                                    sku: String(item.product.sku || '')
                                } : null,
                                ticketId: String(item.ticketId || '')
                            };
                            
                            // If we got here without errors, the item is valid
                            return true;
                        } catch (err) {
                            console.error("Failed to validate line item:", err, item);
                            return false;
                        }
                    });
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
            actions.openIframeModal(
                {
                    uri: url,
                    height: 600,
                    width: 800,
                    title: 'Line Item Form',
                    flush: true,
                },
                () => console.log('Modal closed for line item:', lineItem.id)
            );
        } catch (error) {
            console.error('Error opening iframe:', error);
            setError('Failed to open form');
        }
    }, [actions]);

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
                                    <Text>{typeof item.productName === 'string' ? item.productName : 'N/A'}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>{typeof item.productId === 'string' ? item.productId : 'N/A'}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>{String(typeof item.quantity === 'number' ? item.quantity : 0)}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>${(typeof item.price === 'number' && isFinite(item.price) ? 
                                        Number(item.price) : 0).toFixed(2)}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text>${(typeof item.amount === 'number' && isFinite(item.amount) ? 
                                        Number(item.amount) : 0).toFixed(2)}</Text>
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
    const { context, runServerlessFunction, actions } = props;

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

    // Validate actions is available
    if (!actions || !actions.openIframeModal) {
        console.error('Missing actions.openIframeModal in extension props');
        return (
            <Alert variant="error" title="Function Error">
                <Text>Modal function not available. Please refresh the page.</Text>
            </Alert>
        );
    }

    // Wrap the main component in error boundary
    return (
        <ErrorBoundary>
            <DealLineItems 
                context={context} 
                runServerlessFunction={runServerlessFunction} 
                actions={actions} 
            />
        </ErrorBoundary>
    );
};

export default hubspot.extend(WrappedDealLineItems);