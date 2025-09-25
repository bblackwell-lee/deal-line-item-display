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

    // Function to load line items with error handling
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

            // Handle different response formats
            let actualResponse = response;
            if (response?.status === "SUCCESS" && response?.response) {
                actualResponse = response.response;
            } else if (response?.response && typeof response.response === 'object') {
                actualResponse = response.response;
            }

            // Process the response
            if (actualResponse && actualResponse.success === true) {
                const data = actualResponse.data;
                if (Array.isArray(data)) {
                    // Validate each line item before setting state
                    const validatedItems = data.filter(item => {
                        if (!item || typeof item !== 'object' || !item.id) return false;
                        
                        try {
                            return true;
                        } catch (err) {
                            console.error("Failed to validate line item:", err, item);
                            return false;
                        }
                    });
                    setLineItems(validatedItems);
                } else {
                    console.warn('Invalid data format or empty data');
                    setLineItems([]);
                }
            } else {
                const errorMsg = actualResponse?.message || response?.message || 'Failed to load line items';
                console.error('API error:', errorMsg);
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

    // Early return for missing context
    if (!context) {
        return <Alert variant="error" title="Context Error"><Text>Missing context data</Text></Alert>;
    }

    if (!dealId) {
        return <Alert variant="error" title="Deal ID Error"><Text>No deal ID found</Text></Alert>;
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

    // Render line items table - simplified
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
                        <Table.Cell>Quantity</Table.Cell>
                        <Table.Cell>Price</Table.Cell>
                        <Table.Cell>Amount</Table.Cell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {(Array.isArray(lineItems) ? lineItems : []).map((item, index) => {
                        if (!item || typeof item !== 'object') {
                            return null;
                        }

                        // Generate a stable key
                        const key = item.id || `line-item-${index}`;

                        return (
                            <Table.Row key={key}>
                                <Table.Cell>
                                    <Text>{typeof item.productName === 'string' ? item.productName : 'N/A'}</Text>
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
                            </Table.Row>
                        );
                    }).filter(Boolean)}
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

// Simple HubSpot Extension Wrapper
const WrappedDealLineItems = (props: any) => {
    const { context, runServerlessFunction } = props;

    if (!context || !runServerlessFunction) {
        return (
            <Alert variant="error" title="Error">
                <Text>Missing required dependencies</Text>
            </Alert>
        );
    }

    return (
        <ErrorBoundary>
            <DealLineItems context={context} runServerlessFunction={runServerlessFunction} />
        </ErrorBoundary>
    );
};

export default hubspot.extend(WrappedDealLineItems);