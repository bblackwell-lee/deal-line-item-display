// src/app/extensions/DealLineItems.tsx
import { useState, useEffect, useRef } from 'react';
import {
    Alert,
    Flex,
    LoadingSpinner,
    Text,
    Tile,
    Image,
    Button,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    TableFooter,
    hubspot
} from '@hubspot/ui-extensions';

// Type definitions
interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    sku?: string;
}

interface LineItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    amount: number;
    product?: Product;
    startDate?: string;
    endDate?: string;
    ticketId?: string;
}

interface DealInfo {
    id: string;
    name: string;
    amount: number;
    stage: string;
    stageLabel: string;
    companyName: string;
    isClosed: boolean;
}

const DealLineItems = ({ context, runServerlessFunction, actions }) => {
    // Validate required props
    if (!context?.crm?.objectId) {
        return (
            <Alert variant="error" title="Configuration Error">
                Missing deal context information
            </Alert>
        );
    }

    if (!runServerlessFunction) {
        return (
            <Alert variant="error" title="Configuration Error">
                Serverless function not available
            </Alert>
        );
    }

    // Context
    const dealId = context.crm.objectId;

    // Component mounted ref to prevent state updates on unmounted component
    const isMountedRef = useRef(true);

    // Loading states
    const [dealLoading, setDealLoading] = useState(false);
    const [lineItemsLoading, setLineItemsLoading] = useState(false);

    // Message states
    const [error, setError] = useState('');

    // Data states
    const [dealInfo, setDealInfo] = useState<DealInfo | null>(null);
    const [existingLineItems, setExistingLineItems] = useState<LineItem[]>([]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Load initial data
    useEffect(() => {
        const initializeData = async () => {
            try {
                console.log('Initializing data for deal:', dealId);
                await Promise.all([loadDealInfo(), loadLineItems()]);
            } catch (error) {
                console.error('Initialization error:', error);
                if (isMountedRef.current) {
                    setError('Failed to initialize data: ' + (error?.message || 'Unknown error'));
                }
            }
        };

        initializeData();
    }, [dealId]);

    // Load deal info
    const loadDealInfo = async () => {
        if (!isMountedRef.current) return;

        console.log('Loading deal info for:', dealId);
        setDealLoading(true);
        setError('');

        try {
            const response = await runServerlessFunction({
                name: 'get-deal-info',
                parameters: { dealId }
            });

            if (!isMountedRef.current) return;

            let actualResponse = response;
            if (response?.status === "SUCCESS" && response?.response) {
                actualResponse = response.response;
            }

            if (actualResponse?.success) {
                const deal = actualResponse.data;
                if (deal && isMountedRef.current) {
                    setDealInfo({
                        ...deal,
                        isClosed: deal.stage === 'closedwon' ||
                            deal.stage === 'closedlost' ||
                            deal.stage === '1030569063' // Custom closed won stage
                    });
                }
            } else {
                if (isMountedRef.current) {
                    setError(actualResponse?.message || 'Failed to load deal information');
                }
            }
        } catch (err) {
            console.error('Error loading deal:', err);
            if (isMountedRef.current) {
                setError('Error loading deal: ' + (err?.message || 'Unknown error'));
            }
        } finally {
            if (isMountedRef.current) {
                setDealLoading(false);
            }
        }
    };

    // Load line items
    const loadLineItems = async () => {
        if (!isMountedRef.current) return;

        console.log('Loading line items for deal:', dealId);
        setLineItemsLoading(true);

        try {
            const response = await runServerlessFunction({
                name: 'get-deal-line-items',
                parameters: { dealId }
            });

            if (!isMountedRef.current) return;

            let actualResponse = response;
            if (response?.status === "SUCCESS" && response?.response) {
                actualResponse = response.response;
            }

            if (actualResponse?.success) {
                const lineItems = actualResponse.data || [];
                if (isMountedRef.current) {
                    setExistingLineItems(Array.isArray(lineItems) ? lineItems : []);
                }
                console.log('Loaded line items:', lineItems);
            } else {
                if (isMountedRef.current) {
                    setError(actualResponse?.message || 'Failed to load line items');
                }
            }
        } catch (err) {
            console.error('Error loading line items:', err);
            if (isMountedRef.current) {
                setError('Error loading line items: ' + (err?.message || 'Unknown error'));
            }
        } finally {
            if (isMountedRef.current) {
                setLineItemsLoading(false);
            }
        }
    };

    // Generate form URL with parameters
    const getFormUrl = (lineItemId, productId) => {
        const baseUrl = 'https://www.jotform.com/252675934646066';
        const params = new URLSearchParams();
        
        if (lineItemId) params.append('lineitemid', lineItemId); // Lowercase parameter name
        if (productId) params.append('productid', productId); // Lowercase parameter name
        if (dealId) params.append('dealid', dealId); // Lowercase parameter name
        
        const queryString = params.toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    };

    // Open iframe modal with line item details
    const openItemDetailsModal = (item) => {
        // Add comprehensive validation
        if (!actions || typeof actions.openIframeModal !== 'function') {
            console.error('openIframeModal action not available');
            setError('Modal action not available');
            return;
        }

        if (!item || !item.id) {
            console.error('Invalid line item data');
            setError('Invalid line item data');
            return;
        }

        try {
            // Use the same URL generator as the direct link
            const modalUrl = getFormUrl(item.id, item.productId);
            console.log('Opening modal with URL:', modalUrl);

            actions.openIframeModal(
                {
                    uri: modalUrl,
                    height: 700,
                    width: 900,
                    title: `Details for ${item.productName || 'Line Item'}`,
                    flush: false
                },
                () => {
                    console.log('Modal closed for line item:', item.id);
                    // Optionally refresh data when modal closes
                    // loadLineItems();
                }
            );
        } catch (error) {
            console.error('Error opening modal:', error);
            if (isMountedRef.current) {
                setError('Failed to open modal: ' + (error?.message || 'Unknown error'));
            }
        }
    };

    // Total calculations for footer
    const calculateTotals = () => {
        if (!existingLineItems || !Array.isArray(existingLineItems) || existingLineItems.length === 0) {
            return { quantity: 0, amount: 0 };
        }

        try {
            return existingLineItems.reduce((totals, item) => {
                // Add null checks and type safety
                const quantity = typeof item?.quantity === 'number' ? item.quantity : 0;
                const amount = typeof item?.amount === 'number' ? item.amount : 0;

                return {
                    quantity: totals.quantity + quantity,
                    amount: totals.amount + amount
                };
            }, { quantity: 0, amount: 0 });
        } catch (error) {
            console.error('Error calculating totals:', error);
            return { quantity: 0, amount: 0 };
        }
    };

    const totals = calculateTotals();

    // Format currency safely
    const formatCurrency = (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '$0.00';
        }
        return `$${value.toFixed(2)}`;
    };

    // Format number safely
    const formatNumber = (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '0';
        }
        return value.toLocaleString();
    };

    // Format ID for display (truncate if too long)
    const formatId = (id) => {
        if (!id) return 'N/A';
        return id.length > 10 ? `${id.substring(0, 7)}...` : id;
    };

    // Render loading state
    if (dealLoading && !dealInfo) {
        return (
            <Flex direction="column" align="center" justify="center" gap="small">
                <LoadingSpinner />
                <Text>Loading deal information...</Text>
            </Flex>
        );
    }

    // Render error state if no deal info
    if (!dealLoading && !dealInfo) {
        return (
            <Alert variant="error" title="Error">
                Unable to load deal information
            </Alert>
        );
    }

    // Main render
    return (
        <Flex direction="column" gap="medium">
            <Image
                src="https://6728858.fs1.hubspotusercontent-na1.net/hubfs/6728858/Express_IO_Logo.png"
                alt="Sales Order Express"
            />

            {/* Deal Info Header */}
            {dealInfo && (
                <Tile>
                    <Flex direction="column" gap="small">
                        <Text format={{ fontWeight: 'bold' }}>
                            Deal: {dealInfo.name || 'Unknown Deal'}
                        </Text>
                        <Flex direction="row" gap="medium">
                            <Text>Stage: {dealInfo.stageLabel || 'Unknown'}</Text>
                            <Text>Amount: {formatCurrency(dealInfo.amount)}</Text>
                            <Text>Company: {dealInfo.companyName || 'Unknown'}</Text>
                            {dealInfo.isClosed && (
                                <Text format={{ fontWeight: 'bold' }} style={{ color: '#dc2626' }}>
                                    (CLOSED - Read Only)
                                </Text>
                            )}
                        </Flex>
                    </Flex>
                </Tile>
            )}

            {/* Messages */}
            {error && <Alert variant="error" title="Error">{error}</Alert>}

            {/* Line Items Table */}
            <Flex direction="column" gap="medium">
                {lineItemsLoading ? (
                    <Flex justify="center" align="center" gap="small">
                        <LoadingSpinner />
                        <Text>Loading line items...</Text>
                    </Flex>
                ) : existingLineItems && existingLineItems.length > 0 ? (
                    <Table bordered={true}>
                        <TableHead>
                            <TableRow>
                                <TableHeader width="min">Line Item ID</TableHeader>
                                <TableHeader width="min">Product ID</TableHeader>
                                <TableHeader width="auto">Product Name</TableHeader>
                                <TableHeader width="min">Quantity</TableHeader>
                                <TableHeader width="min">Unit Price</TableHeader>
                                <TableHeader width="min">Total</TableHeader>
                                <TableHeader width="auto">Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {existingLineItems.map((item, index) => {
                                if (!item || !item.id) return null;

                                return (
                                    <TableRow key={item.id} style={{
                                        backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff'
                                    }}>
                                        <TableCell>{formatId(item.id)}</TableCell>
                                        <TableCell>{formatId(item.productId)}</TableCell>
                                        <TableCell>{item.productName || 'Unknown Product'}</TableCell>
                                        <TableCell>{item.quantity || 0}</TableCell>
                                        <TableCell>{formatCurrency(item.price)}</TableCell>
                                        <TableCell>{formatCurrency(item.amount)}</TableCell>
                                        <TableCell>
                                            <Flex direction="row" gap="small">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    href={getFormUrl(item.id, item.productId)}
                                                >
                                                    Open
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => openItemDetailsModal(item)}
                                                    disabled={!actions || typeof actions.openIframeModal !== 'function'}
                                                >
                                                    Modal
                                                </Button>
                                            </Flex>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter>
                            <TableRow style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell>Totals</TableCell>
                                <TableCell>{totals.quantity}</TableCell>
                                <TableCell></TableCell>
                                <TableCell>{formatCurrency(totals.amount)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                ) : (
                    <Alert variant="info" title="No Line Items">
                        This deal has no line items yet.
                    </Alert>
                )}
            </Flex>
        </Flex>
    );
};

// Export the component for use in the extension
export default DealLineItems;

// HubSpot Extension Entry Point
hubspot.extend(({ context, runServerlessFunction, actions }) => {
    try {
        console.log('Initializing HubSpot extension with context:', context);

        // Validate extension parameters
        if (!context) {
            console.error('Context not provided to extension');
            throw new Error('Context not provided to extension');
        }

        if (!runServerlessFunction) {
            console.error('runServerlessFunction not provided to extension');
            throw new Error('runServerlessFunction not provided to extension');
        }

        // Log available actions for debugging
        console.log('Available actions:', Object.keys(actions || {}));

        return <DealLineItems
            context={context}
            runServerlessFunction={runServerlessFunction}
            actions={actions}
        />;
    } catch (error) {
        console.error('Critical error initializing extension:', error);
        return (
            <Flex direction="column" align="center" justify="center" gap="medium">
                <Alert variant="error" title="Extension Initialization Error">
                    There was a critical error initializing the extension: {error?.message || 'Unknown error'}.
                    Please refresh the page or contact support.
                </Alert>
                <Button
                    variant="secondary"
                    onClick={() => window.location.reload()}
                >
                    Refresh Page
                </Button>
            </Flex>
        );
    }
});