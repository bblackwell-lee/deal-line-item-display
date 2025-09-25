// src/app/extensions/DealLineItems.tsx
import { useState, useEffect, useRef } from 'react';
import {
    Alert,
    Flex,
    LoadingSpinner,
    Text,
    Tile,
    Image,
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

const DealLineItems = ({ context, runServerlessFunction }) => {
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
                    <Flex direction="column" gap="small">
                        {/* Table header */}
                        <Flex direction="row" gap="small" style={{ 
                            padding: '8px', 
                            borderBottom: '1px solid #e5e7eb',
                            fontWeight: 'bold'
                        }}>
                            <Text style={{ width: '30%' }}>Product Name</Text>
                            <Text style={{ width: '15%' }}>Quantity</Text>
                            <Text style={{ width: '15%' }}>Unit Price</Text>
                            <Text style={{ width: '15%' }}>Total</Text>
                            <Text style={{ width: '25%' }}>Dates</Text>
                        </Flex>
                        
                        {/* Table rows */}
                        {existingLineItems.map((item, index) => (
                            <Flex key={item.id} direction="row" gap="small" align="center" style={{ 
                                padding: '8px', 
                                borderBottom: '1px solid #e5e7eb',
                                backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff'
                            }}>
                                <Text style={{ width: '30%' }}>{item.productName}</Text>
                                <Text style={{ width: '15%' }}>{item.quantity}</Text>
                                <Text style={{ width: '15%' }}>${item.price.toFixed(2)}</Text>
                                <Text style={{ width: '15%' }}>${item.amount.toFixed(2)}</Text>
                                <Text style={{ width: '25%' }}>
                                    {item.startDate && item.endDate 
                                        ? `${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}`
                                        : 'N/A'}
                                </Text>
                            </Flex>
                        ))}
                        
                        {/* Total row */}
                        <Flex direction="row" gap="small" align="center" style={{ 
                            padding: '8px', 
                            borderBottom: '1px solid #e5e7eb',
                            fontWeight: 'bold',
                            backgroundColor: '#f3f4f6'
                        }}>
                            <Text style={{ width: '30%' }}>Total</Text>
                            <Text style={{ width: '15%' }}>{existingLineItems.reduce((sum, item) => sum + item.quantity, 0)}</Text>
                            <Text style={{ width: '15%' }}></Text>
                            <Text style={{ width: '15%' }}>${existingLineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</Text>
                            <Text style={{ width: '25%' }}></Text>
                        </Flex>
                    </Flex>
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
hubspot.extend(({ context, runServerlessFunction }) => {
    try {
        return <DealLineItems context={context} runServerlessFunction={runServerlessFunction} />;
    } catch (error) {
        console.error('Error initializing extension:', error);
        return (
            <Alert variant="error" title="Extension Error">
                There was an error initializing the extension. Please refresh the page or contact support.
            </Alert>
        );
    }
});
