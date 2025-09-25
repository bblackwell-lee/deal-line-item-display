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
    // Context
    const dealId = context.crm.objectId;

    // Add ref to track loading states and prevent duplicate calls
    const isInitialLoadRef = useRef(true);
    
    // Loading states
    const [dealLoading, setDealLoading] = useState(false);
    const [lineItemsLoading, setLineItemsLoading] = useState(false);

    // Message states
    const [error, setError] = useState('');

    // Data states
    const [dealInfo, setDealInfo] = useState<DealInfo | null>(null);
    const [existingLineItems, setExistingLineItems] = useState<LineItem[]>([]);

    // Load initial data - only run once on mount
    useEffect(() => {
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            loadDealInfo();
            loadLineItems();
        }
    }, []);

    // Load deal info
    const loadDealInfo = async () => {
        setDealLoading(true);
        setError('');

        try {
            const response = await runServerlessFunction({
                name: 'get-deal-info',
                parameters: { dealId }
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                const deal = actualResponse.data;
                setDealInfo({
                    ...deal,
                    isClosed: deal.stage === 'closedwon' || deal.stage === 'closedlost' ||
                        deal.stage === '1030569063' // Custom closed won stage
                });
            } else {
                setError(actualResponse.message || 'Failed to load deal information');
            }
        } catch (err) {
            setError('Error loading deal: ' + err.message);
        } finally {
            setDealLoading(false);
        }
    };

    // Load line items
    const loadLineItems = async () => {
        setLineItemsLoading(true);

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
                setExistingLineItems(actualResponse.data || []);
            } else {
                setError(actualResponse.message || 'Failed to load line items');
            }
        } catch (err) {
            setError('Error loading line items: ' + err.message);
        } finally {
            setLineItemsLoading(false);
        }
    };

    // Open iframe modal with line item details
    const openItemDetailsModal = (item) => {
        if (!actions.openIframeModal) {
            console.error('openIframeModal action not available');
            return;
        }

        // Construct URL with query parameters
        const baseUrl = 'http://www.form.com/formname';
        const queryParams = new URLSearchParams({
            lineItemId: item.id,
            productId: item.productId || '',
            productName: item.productName || '',
            dealId: dealId
        }).toString();

        const modalUrl = `${baseUrl}?${queryParams}`;

        actions.openIframeModal(
            {
                uri: modalUrl,
                height: 700,
                width: 900,
                title: `Details for ${item.productName}`,
                flush: false
            },
            () => {
                console.log('Modal closed for line item:', item.id);
                // Optionally refresh data when modal closes
                // loadLineItems();
            }
        );
    };

    // Total calculations for footer
    const calculateTotals = () => {
        if (!existingLineItems || existingLineItems.length === 0) {
            return { quantity: 0, amount: 0 };
        }

        return existingLineItems.reduce((totals, item) => {
            return {
                quantity: totals.quantity + (item.quantity || 0),
                amount: totals.amount + (item.amount || 0)
            };
        }, { quantity: 0, amount: 0 });
    };

    const totals = calculateTotals();

    // Render
    return dealLoading ? (
        <Flex direction="column" align="center" justify="center" gap="small">
            <LoadingSpinner />
            <Text>Loading deal information...</Text>
        </Flex>
    ) : dealInfo ? (
        <Flex direction="column" gap="medium">
            <Image
                src="https://6728858.fs1.hubspotusercontent-na1.net/hubfs/6728858/Express_IO_Logo.png"
                alt="Sales Order Express"
            />

            {/* Deal Info Header */}
            <Tile>
                <Flex direction="column" gap="small">
                    <Text format={{ fontWeight: 'bold' }}>Deal: {dealInfo.name}</Text>
                    <Flex direction="row" gap="medium">
                        <Text>Stage: {dealInfo.stageLabel}</Text>
                        <Text>Amount: ${dealInfo.amount.toLocaleString()}</Text>
                        <Text>Company: {dealInfo.companyName}</Text>
                        {dealInfo.isClosed && (
                            <Text format={{ fontWeight: 'bold' }} style={{ color: '#dc2626' }}>
                                (CLOSED - Read Only)
                            </Text>
                        )}
                    </Flex>
                </Flex>
            </Tile>

            {/* Messages */}
            {error && <Alert variant="error" title="Error">{error}</Alert>}

            {/* Line Items Table */}
            <Flex direction="column" gap="medium">
                {lineItemsLoading ? (
                    <Flex justify="center" align="center" gap="small">
                        <LoadingSpinner />
                        <Text>Loading line items...</Text>
                    </Flex>
                ) : existingLineItems.length > 0 ? (
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell width="25%">Product Name</Table.HeaderCell>
                                <Table.HeaderCell width="10%">Quantity</Table.HeaderCell>
                                <Table.HeaderCell width="15%">Unit Price</Table.HeaderCell>
                                <Table.HeaderCell width="15%">Total</Table.HeaderCell>
                                <Table.HeaderCell width="20%">Dates</Table.HeaderCell>
                                <Table.HeaderCell width="15%">Actions</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {existingLineItems.map((item, index) => (
                                <Table.Row key={item.id} style={{
                                    backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff'
                                }}>
                                    <Table.Cell>{item.productName}</Table.Cell>
                                    <Table.Cell>{item.quantity}</Table.Cell>
                                    <Table.Cell>${item.price.toFixed(2)}</Table.Cell>
                                    <Table.Cell>${item.amount.toFixed(2)}</Table.Cell>
                                    <Table.Cell>
                                        {item.startDate && item.endDate 
                                            ? `${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}`
                                            : 'N/A'}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Button 
                                            variant="primary"
                                            onClick={() => openItemDetailsModal(item)}
                                        >
                                            View Details
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                        <Table.Footer>
                            <Table.Row style={{ fontWeight: 'bold', backgroundColor: '#f3f4f6' }}>
                                <Table.Cell>Totals</Table.Cell>
                                <Table.Cell>{totals.quantity}</Table.Cell>
                                <Table.Cell></Table.Cell>
                                <Table.Cell>${totals.amount.toFixed(2)}</Table.Cell>
                                <Table.Cell></Table.Cell>
                                <Table.Cell></Table.Cell>
                            </Table.Row>
                        </Table.Footer>
                    </Table>
                ) : (
                    <Alert variant="info" title="No Line Items">
                        This deal has no line items yet.
                    </Alert>
                )}
            </Flex>
        </Flex>
    ) : (
        <Alert variant="error" title="Error">
            Unable to load deal information
        </Alert>
    );
};

// Export the component for use in the extension
export default DealLineItems;

// HubSpot Extension Wrapper
hubspot.extend(({ context, runServerlessFunction, actions }) => {
    try {
        return <DealLineItems 
            context={context} 
            runServerlessFunction={runServerlessFunction} 
            actions={actions} 
        />;
    } catch (error) {
        console.error('Error initializing extension:', error);
        return (
            <Alert variant="error" title="Extension Error">
                There was an error initializing the extension. Please refresh the page or contact support.
            </Alert>
        );
    }
});
