// src/app/extensions/DealProductConfiguration.tsx
// Complete file with inline editing functionality - FIXED VERSION
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Alert,
    Button,
    Divider,
    Flex,
    LoadingSpinner,
    Text,
    Tabs,
    Tab,
    Tile,
    Image,
    hubspot
} from '@hubspot/ui-extensions';

// Import components
import CartDisplay from './CartDisplay';
import ViewTickets from './ViewTickets';
import SendToFulfillment from './SendToFulfillment';
import CopyFromClosedDeals from './CopyFromClosedDeals';
import Packages from './Packages';
import SharedProductConfiguration from './SharedProductConfiguration';

// Import utilities
import { formatDateForSubmission } from './useProductCartManager';

// Type definitions
interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    sku?: string;
    requiredAttributes?: string;
    rateType?: string;
    monthlyBudgetMinimum?: number;
    termMinimum?: number;
    type?: string;
    hubspotOrdering?: string;
    adServing?: string;
    isCostPer?: boolean;
}

interface LineItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    amount: number;
    fulfillmentData?: any;
    fulfillmentInfo?: string;
    startDate?: string;
    endDate?: string;
    insertionDates?: any[];
    customFields?: any;
    product?: Product;
    associatedNoteId?: string;
    associatedNoteTitle?: string;
    associatedNotePreview?: string;
}

interface DealInfo {
    id: string;
    name: string;
    amount: number;
    stage: string;
    stageLabel: string;
    closeDate: string;
    ownerId: string;
    ownerName: string;
    companyId: string;
    companyName: string;
    isClosed: boolean;
    companyDbPrefix?: string;
}

interface CartItem {
    productId: string;
    product: Product;
    productName: string;
    quantity: number;
    startDate?: string;
    endDate?: string;
    insertionDates?: any[];
    customFields: any;
    subtotal: number;
    customCost?: number;
    isAutoQuantity?: boolean;
    isCostPer?: boolean;
    associatedNoteId?: string;
    associatedNoteTitle?: string;
    associatedNotePreview?: string;
    lineItemId?: string;
    ticketId?: string;
    customSchedule?: boolean;
    customPeriods?: Array<{
      id: string;
      startDate: any;
      endDate: any;
      quantity: number;
      budget?: number;
    }>;
}

const DealProductConfiguration = ({ context, runServerlessFunction }) => {
    // Context
    const dealId = context.crm.objectId;

    // Add refs to track loading states and prevent duplicate calls
    const isInitialLoadRef = useRef(true);
    const loadingStatesRef = useRef({
        dealInfo: false,
        lineItems: false,
        products: false,
        attributes: false
    });

    // Loading states
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dealLoading, setDealLoading] = useState(false);
    const [lineItemsLoading, setLineItemsLoading] = useState(false);

    // Message states
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Data states
    const [dealInfo, setDealInfo] = useState<DealInfo | null>(null);
    const [existingLineItems, setExistingLineItems] = useState<LineItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [totalAmount, setTotalAmount] = useState(0);

    // UI states
    const [activeTab, setActiveTab] = useState<'items' | 'new' | 'history' | 'fulfillment'>('items');

    // Memoize the current user object to prevent unnecessary re-renders
    const [currentUser, setCurrentUser] = useState(null);
    const currentUserMemo = useMemo(() => currentUser, [currentUser?.userId]);

    // Editing state
    const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);

    // Attribute configurations (for product config form)
    const [allAttributeConfigs, setAllAttributeConfigs] = useState({});
    const [allLevel2AttributeConfigs, setAllLevel2AttributeConfigs] = useState({});
    const [allLevel3AttributeConfigs, setAllLevel3AttributeConfigs] = useState({});

    // Load initial data - only run once on mount
    useEffect(() => {
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            loadInitialData();
        }
    }, []); // Empty dependency array - only run once

    // FIXED: Combine all initial loads into one function
    const loadInitialData = async () => {
        // Load all data in parallel to reduce total load time
        await Promise.all([
            loadDealInfo(),
            loadLineItems(),
            loadProducts(),
            loadAllAttributeConfigs(),
            loadAllLevel2AttributeConfigs(),
            loadAllLevel3AttributeConfigs()
        ]);
    };

    // Update total when cart changes
    useEffect(() => {
        const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
        setTotalAmount(total);
    }, [cart]);

    // Optimize loadDealInfo to prevent duplicate calls
    const loadDealInfo = useCallback(async () => {
        if (loadingStatesRef.current.dealInfo) return;
        loadingStatesRef.current.dealInfo = true;

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
            loadingStatesRef.current.dealInfo = false;
        }
    }, [dealId, runServerlessFunction]);

    // Similar optimization for loadLineItems
    const loadLineItems = useCallback(async () => {
        if (loadingStatesRef.current.lineItems) return;
        loadingStatesRef.current.lineItems = true;

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
            loadingStatesRef.current.lineItems = false;
        }
    }, [dealId, runServerlessFunction]);

    // Optimize loadProducts to prevent duplicate calls
    const loadProducts = useCallback(async () => {
        if (loadingStatesRef.current.products) return;
        loadingStatesRef.current.products = true;

        setLoading(true);

        try {
            const response = await runServerlessFunction({
                name: 'get-products',
                parameters: {}
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success && actualResponse.data) {
                setProducts(actualResponse.data);
            } else {
                setError(actualResponse.message || 'Failed to load products');
            }
        } catch (err) {
            setError('Error loading products: ' + err.message);
        } finally {
            setLoading(false);
            loadingStatesRef.current.products = false;
        }
    }, [runServerlessFunction]);

    // Load attribute configs
    const loadAllAttributeConfigs = async () => {
        try {
            const response = await runServerlessFunction({
                name: 'get-product-attributes'
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                setAllAttributeConfigs(actualResponse.data || {});
            } else {
                setAllAttributeConfigs({});
            }
        } catch (err) {
            setAllAttributeConfigs({});
        }
    };

    const loadAllLevel2AttributeConfigs = async () => {
        try {
            const response = await runServerlessFunction({
                name: 'get-product-attributes-level-two'
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                setAllLevel2AttributeConfigs(actualResponse.data || {});
            } else {
                setAllLevel2AttributeConfigs({});
            }
        } catch (err) {
            setAllLevel2AttributeConfigs({});
        }
    };

    const loadAllLevel3AttributeConfigs = async () => {
        try {
            const response = await runServerlessFunction({
                name: 'get-product-attributes-level-three'
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                setAllLevel3AttributeConfigs(actualResponse.data || {});
            } else {
                setAllLevel3AttributeConfigs({});
            }
        } catch (err) {
            setAllLevel3AttributeConfigs({});
        }
    };

    // Edit existing line item
    const handleEditLineItem = async (lineItem: LineItem) => {
        if (dealInfo?.isClosed) {
            setError('Cannot edit line items on closed deals');
            return;
        }

        try {
            // Set up editing state
            setEditingLineItemId(lineItem.id);
            setActiveTab('items');
        } catch (error) {
            console.error('Error setting up edit form:', error);
            setError('Failed to prepare form for editing: ' + error.message);
        }
    };

    // Save edited line item
    const handleSaveLineItem = async (lineItemId, updatedData) => {
        if (!lineItemId) return;

        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const response = await runServerlessFunction({
                name: 'update-line-item',
                parameters: {
                    dealId,
                    lineItemId,
                    updates: updatedData
                }
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                setSuccess('Line item updated successfully');

                // Calculate the new line item locally
                const newPrice = updatedData.price;
                const newAmount = newPrice * updatedData.quantity;

                // Update line items locally instead of reloading
                setExistingLineItems(prevItems =>
                    prevItems.map(item =>
                        item.id === lineItemId ? {
                            ...item,
                            quantity: updatedData.quantity,
                            price: newPrice,
                            amount: newAmount,
                            startDate: updatedData.startDate,
                            endDate: updatedData.endDate,
                            insertionDates: updatedData.insertionDates,
                            customFields: updatedData.customFields,
                            associatedNoteId: updatedData.associatedNoteId,
                            associatedNoteTitle: updatedData.associatedNoteTitle,
                            associatedNotePreview: updatedData.associatedNotePreview
                        } : item
                    )
                );

                // Update deal amount locally
                if (dealInfo) {
                    // Find the old line item to calculate difference
                    const oldLineItem = existingLineItems.find(item => item.id === lineItemId);
                    const oldAmount = oldLineItem ? oldLineItem.amount : 0;
                    const amountDifference = newAmount - oldAmount;

                    setDealInfo(prevDealInfo => ({
                        ...prevDealInfo,
                        amount: prevDealInfo.amount + amountDifference
                    }));
                }

                // Reset editing state
                setEditingLineItemId(null);

                return true;
            } else {
                setError(actualResponse.message || 'Failed to update line item');
                return false;
            }
        } catch (err) {
            setError('Error updating line item: ' + err.message);
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    // Handle delete line item
    const handleDeleteLineItem = async (lineItemId: string) => {
        if (dealInfo?.isClosed) {
            setError('Cannot delete line items on closed deals');
            return;
        }

        try {
            // Find the line item to be deleted (to update amount later)
            const lineItemToDelete = existingLineItems.find(item => item.id === lineItemId);
            if (!lineItemToDelete) {
                setError('Line item not found');
                return;
            }

            const response = await runServerlessFunction({
                name: 'delete-line-item',
                parameters: {
                    dealId,
                    lineItemId
                }
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                setSuccess('Line item deleted successfully');

                // Update line items locally - remove the deleted item
                setExistingLineItems(prevItems =>
                    prevItems.filter(item => item.id !== lineItemId)
                );

                // Update deal amount locally
                if (dealInfo) {
                    const deletedAmount = lineItemToDelete.amount || 0;
                    setDealInfo(prevDealInfo => ({
                        ...prevDealInfo,
                        amount: Math.max(0, prevDealInfo.amount - deletedAmount)
                    }));
                }
            } else {
                setError(actualResponse.message || 'Failed to delete line item');
            }
        } catch (err) {
            setError('Error deleting line item: ' + err.message);
        }
    };

    // Submit new items to deal
    const handleSubmitNewItems = async () => {
        if (cart.length === 0) return;

        setSubmitting(true);
        setError('');

        try {
            // Format parameters to match what create-configuration expects
            const response = await runServerlessFunction({
                name: 'create-configuration',
                parameters: {
                    orderName: `${dealInfo.name} - Additional Items`,
                    totalAmount: cart.reduce((sum, item) => sum + item.subtotal, 0),
                    contextType: 'deal',
                    recordId: dealId,
                    selectedOwnerId: dealInfo.ownerId,
                    companyDbPrefix: dealInfo.companyDbPrefix || '',
                    // These parameters are critical for adding to existing deals
                    useExistingDeal: true,
                    existingDealId: dealId,
                    cartItems: cart.map(item => ({
                        productId: item.productId,
                        productName: item.productName || item.product.name,
                        product: item.product,
                        quantity: item.quantity,
                        startDate: formatDateForSubmission(item.startDate),
                        endDate: formatDateForSubmission(item.endDate),
                        insertionDates: item.insertionDates?.map(insertion => ({
                            date: formatDateForSubmission(insertion.date),
                            label: insertion.label
                        })),
                        subtotal: item.subtotal,
                        customFields: item.customFields || {},
                        customCost: item.customCost,
                        isAutoQuantity: item.isAutoQuantity || false,
                        isCostPer: item.isCostPer || false,
                        associatedNoteId: item.associatedNoteId,
                        associatedNoteTitle: item.associatedNoteTitle,
                        associatedNotePreview: item.associatedNotePreview,
                        forceFulfillment: item.forceFulfillment || false,
                        customSchedule: item.customSchedule || false,
                        customPeriods: item.customSchedule ? item.customPeriods.map(period => ({
                            id: period.id,
                            startDate: formatDateForSubmission(period.startDate),
                            endDate: formatDateForSubmission(period.endDate),
                            quantity: period.quantity,
                            budget: period.budget
                        })) : []
                    }))
                }
            });

            let actualResponse = response;
            if (response.status === "SUCCESS" && response.response) {
                actualResponse = response.response;
            }

            if (actualResponse.success) {
                // Reload line items to show the changes
                await loadLineItems();
                await loadDealInfo();
                
                setSuccess(`Successfully added ${cart.length} items to the deal`);
                setCart([]);
                setActiveTab('items');
            } else {
                setError(actualResponse.message || 'Failed to add items');
            }
        } catch (err) {
            setError('Error adding items: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Convert line items to cart format for display
    const convertLineItemsToCart = (): CartItem[] => {
        return existingLineItems.map(item => ({
            productId: item.productId,
            product: item.product || {
                id: item.productId,
                name: item.productName,
                price: item.price
            },
            productName: item.productName,
            quantity: item.quantity,
            startDate: item.startDate,
            endDate: item.endDate,
            insertionDates: item.insertionDates,
            customFields: item.customFields || {},
            subtotal: item.amount,
            customCost: item.price,
            isAutoQuantity: false,
            isCostPer: item.product?.isCostPer || false,
            lineItemId: item.id,
            ticketId: item.ticketId
        }));
    };

    // Handler for copying from closed deals
    const handleCopyFromClosedDeals = useCallback((lineItems, dealName) => {
        try {
            if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
                throw new Error('No items selected to copy');
            }
            
            const sanitizedCartItems = lineItems.map(item => ({
                productId: String(item?.productId || ''),
                product: item?.product || {},
                productName: item?.productName || item?.product?.name || 'Unknown Product',
                quantity: Number(item?.quantity) || 1,
                subtotal: Number(item?.subtotal) || 0,
                customFields: (item?.customFields && typeof item.customFields === 'object') ? 
                    { ...item.customFields } : {},
                isAutoQuantity: Boolean(item?.isAutoQuantity),
                isCostPer: Boolean(item?.isCostPer),
                forceFulfillment: Boolean(item?.forceFulfillment),
                customCost: item?.customCost,
                associatedNoteId: item?.associatedNoteId,
                associatedNoteTitle: item?.associatedNoteTitle || 'Copied Note',
                associatedNotePreview: item?.associatedNotePreview || '',
                insertionDates: item?.insertionDates,
                startDate: item?.startDate,
                endDate: item?.endDate,
                customSchedule: item?.customSchedule,
                customPeriods: item?.customPeriods
            }));
            
            setCart(prev => [...prev, ...sanitizedCartItems]);
            setActiveTab('new');
            setSuccess(`Successfully copied ${sanitizedCartItems.length} items from "${dealName}"`);
            
        } catch (error) {
            setError(`Failed to copy items: ${error.message}`);
        }
    }, []);

    // Handler for copying packages
    const handleCopyPackage = useCallback((cartItems, packageName) => {
        try {
            if (!cartItems || !Array.isArray(cartItems)) {
                throw new Error('Invalid cart items received');
            }
            
            if (!packageName || typeof packageName !== 'string') {
                throw new Error('Invalid package name received');
            }
            
            const sanitizedCartItems = cartItems.map(item => ({
                productId: String(item?.productId || ''),
                product: item?.product || {},
                productName: item?.productName || item?.product?.name || 'Unknown Product',
                quantity: Number(item?.quantity) || 1,
                subtotal: Number(item?.subtotal) || 0,
                customFields: (item?.customFields && typeof item.customFields === 'object') ? 
                    { ...item.customFields } : {},
                isAutoQuantity: Boolean(item?.isAutoQuantity),
                isCostPer: Boolean(item?.isCostPer),
                customCost: item?.customCost,
                associatedNoteId: item?.associatedNoteId,
                associatedNoteTitle: item?.associatedNoteTitle || 'Package Note',
                associatedNotePreview: item?.associatedNotePreview || '',
                insertionDates: item?.insertionDates,
                startDate: item?.startDate,
                endDate: item?.endDate,
                customSchedule: item?.customSchedule,
                customPeriods: item?.customPeriods
            }));
            
            setCart(prev => [...prev, ...sanitizedCartItems]);
            setActiveTab('new');
            
            const notesCount = sanitizedCartItems.filter(item => item.associatedNoteId).length;
            const successMessage = `Package "${packageName}" loaded successfully - ${sanitizedCartItems.length} items added to cart${notesCount > 0 ? ` (${notesCount} with notes)` : ''}`;
            setSuccess(successMessage);
            
        } catch (error) {
            setError(`Failed to copy package: ${error.message}`);
        }
    }, []);

    // Function to handle cart updates from SharedProductConfiguration
    const handleCartUpdate = (updatedCart, updatedTotal) => {
        setCart(updatedCart);
        setTotalAmount(updatedTotal);
    };

    // Handle canceling edit mode
    const handleCancelEdit = () => {
        setEditingLineItemId(null);
    };

    // Render
    return loading || dealLoading ? (
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
            {success && <Alert variant="success" title="Success">{success}</Alert>}

            {/* Tabs */}
            <Tabs selected={activeTab} onSelectedChange={(tabId) => setActiveTab(tabId)} variant="enclosed" fill={true}>
                <Tab tabId="items" title={`📋 Line Items (${existingLineItems.length})`} tooltip="View and edit existing line items">
                    <Flex direction="column" gap="medium" style={{ paddingTop: '16px' }}>
                        {/* Show editing notice */}
                        {editingLineItemId && (
                            <Alert variant="info" title="Editing Line Item">
                                <Flex direction="column" gap="small">
                                    <Text>You are currently editing a line item. Make your changes below and click "Save Changes" to update.</Text>
                                    <Button variant="secondary" size="small" onClick={handleCancelEdit}>
                                        Cancel Editing
                                    </Button>
                                </Flex>
                            </Alert>
                        )}

                        {editingLineItemId ? (
                            // Use SharedProductConfiguration for editing
                            <SharedProductConfiguration
                                products={products}
                                allAttributeConfigs={allAttributeConfigs}
                                allLevel2AttributeConfigs={allLevel2AttributeConfigs}
                                allLevel3AttributeConfigs={allLevel3AttributeConfigs}
                                companyInfo={{
                                    id: dealInfo.companyId,
                                    name: dealInfo.companyName
                                }}
                                runServerlessFunction={runServerlessFunction}
                                initialCart={[]}
                                initialTotalAmount={0}
                                onCartUpdate={() => {}}
                                onSubmitOrder={() => {}}
                                submitButtonText="Save Changes"
                                isSubmitting={submitting}
                                dealClosed={dealInfo?.isClosed}
                                onError={setError}
                                onSuccess={setSuccess}
                                isEditMode={true}
                                editingLineItemId={editingLineItemId}
                                onSaveLineItem={handleSaveLineItem}
                                onCancelEdit={handleCancelEdit}
                                existingLineItems={existingLineItems}
                            />
                        ) : (
                            // Show existing line items
                            lineItemsLoading ? (
                                <Flex justify="center" align="center" gap="small">
                                    <LoadingSpinner />
                                    <Text>Loading line items...</Text>
                                </Flex>
                            ) : existingLineItems.length > 0 ? (
                                <CartDisplay
                                    cart={convertLineItemsToCart()}
                                    totalAmount={existingLineItems.reduce((sum, item) => sum + item.amount, 0)}
                                    onRemoveFromCart={(index) => {
                                        const lineItem = existingLineItems[index];
                                        if (lineItem?.id) {
                                            handleDeleteLineItem(lineItem.id);
                                        }
                                    }}
                                    onUpdateCartItemQuantity={() => {}}
                                    onEditCartItem={(index) => {
                                        const lineItem = existingLineItems[index];
                                        handleEditLineItem(lineItem);
                                    }}
                                    companyInfo={{ id: dealInfo.companyId }}
                                />                          
                            ) : (
                                <Alert variant="info" title="No Line Items">
                                    This deal has no line items yet. Use the "Add New Items" tab to add products.
                                </Alert>
                            )
                        )}
                    </Flex>

                    <SendToFulfillment
                      dealId={dealId}
                      dealInfo={dealInfo}
                      cart={existingLineItems}
                      runServerlessFunction={runServerlessFunction}
                      onRefresh={() => {
                        loadDealInfo();
                        loadLineItems();
                      }}
                    />
                </Tab>

                <Tab tabId="new" title="➕ Add New Items" tooltip="Add new products to this deal" disabled={dealInfo.isClosed}>
                    <Flex direction="column" gap="medium" style={{ paddingTop: '16px' }}>
                        <SharedProductConfiguration
                            products={products}
                            allAttributeConfigs={allAttributeConfigs}
                            allLevel2AttributeConfigs={allLevel2AttributeConfigs}
                            allLevel3AttributeConfigs={allLevel3AttributeConfigs}
                            companyInfo={{
                                id: dealInfo.companyId,
                                name: dealInfo.companyName
                            }}
                            runServerlessFunction={runServerlessFunction}
                            initialCart={cart}
                            initialTotalAmount={totalAmount}
                            onCartUpdate={handleCartUpdate}
                            onSubmitOrder={handleSubmitNewItems}
                            submitButtonText={submitting 
                                ? 'Adding Items...' 
                                : `Add ${cart.length} Items to Deal`
                            }
                            isSubmitting={submitting}
                            dealClosed={dealInfo?.isClosed}
                            onError={setError}
                            onSuccess={setSuccess}
                        />
                    </Flex>
                </Tab>

                <Tab tabId="history" title="📜 Order History" tooltip="View order history for this company">
                  {activeTab === 'history' && (
                    <Flex direction="column" gap="medium" style={{ paddingTop: '16px' }}>
                      {/* Copy From Closed Deals */}
                      <CopyFromClosedDeals
                        companyId={dealInfo.companyId}
                        products={products}
                        onCopyItems={handleCopyFromClosedDeals}
                        runServerlessFunction={runServerlessFunction}
                      />
                      
                      {/* Packages */}
                      <Packages
                        currentUser={currentUserMemo}
                        products={products}
                        onCopyPackage={handleCopyPackage}
                        runServerlessFunction={runServerlessFunction}
                      />
                    </Flex>
                  )}
                </Tab>

                <Tab 
                  tabId="fulfillment" 
                  title="🚚 Fulfillment" 
                  tooltip="View fulfillment tickets for this deal"
                >
                  {/* Fulfillment Tab Content */}
                  <Flex direction="column" gap="medium" style={{ paddingTop: '16px' }}>
                    <ViewTickets
                      companyId={dealInfo.id}
                      runServerlessFunction={(params) => {
                        // Override the function name to use get-deal-tickets
                        if (params.name === 'get-company-tickets') {
                          return runServerlessFunction({
                            ...params,
                            name: 'get-deal-tickets',
                            parameters: { dealId: dealInfo.id }
                          });
                        }
                        return runServerlessFunction(params);
                      }}
                    />
                  </Flex>
                </Tab>
            </Tabs>
        </Flex>
    ) : (
        <Alert variant="error" title="Error">
            Unable to load deal information
        </Alert>
    );
};

// Export the component for use in the extension
export default DealProductConfiguration;

// HubSpot Extension Wrapper - with proper error handling
hubspot.extend(({ context, runServerlessFunction }) => {
    try {
        return <DealProductConfiguration context={context} runServerlessFunction={runServerlessFunction} />;
    } catch (error) {
        console.error('Error initializing extension:', error);
        return (
            <Alert variant="error" title="Extension Error">
                There was an error initializing the extension. Please refresh the page or contact support.
            </Alert>
        );
    }
});
