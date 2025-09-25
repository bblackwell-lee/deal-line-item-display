// src/app/app.functions/get-deal-line-items.js
const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}, parameters = {}) => {
    console.log('=== GET DEAL LINE ITEMS START ===');

    // Get dealId from either parameters directly or context.parameters
    const dealId = parameters?.dealId || context?.parameters?.dealId;

    console.log('Input parameters:', {
        dealId,
        fromParameters: parameters?.dealId,
        fromContext: context?.parameters?.dealId,
        contextKeys: Object.keys(context || {}),
        parametersKeys: Object.keys(parameters || {})
    });

    if (!dealId) {
        console.error('No dealId provided in parameters or context');
        return {
            success: false,
            message: 'Deal ID is required',
            debug: {
                context: context,
                parameters: parameters
            }
        };
    }

    const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
    if (!token) {
        console.error('Missing PRIVATE_APP_ACCESS_TOKEN environment variable');
        return {
            success: false,
            message: 'Server configuration error: missing access token'
        };
    }

    const hubspotClient = new hubspot.Client({ accessToken: token });

    try {
        console.log(`Fetching deal with ID: ${dealId} including line_items associations`);

        // First approach: Get deal with line item associations
        let dealResponse;
        try {
            dealResponse = await hubspotClient.crm.deals.basicApi.getById(
                dealId,
                [],
                undefined,
                ['line_items']
            );

            console.log('Deal response structure:', {
                id: dealResponse.id,
                hasProperties: !!dealResponse.properties,
                hasAssociations: !!dealResponse.associations,
                associationTypes: dealResponse.associations ? Object.keys(dealResponse.associations) : []
            });
        } catch (dealError) {
            console.error('Error fetching deal:', dealError);
            return {
                success: false,
                message: `Failed to fetch deal ${dealId}: ${dealError.message}`,
                errorDetails: {
                    name: dealError.name,
                    status: dealError.status,
                    response: dealError.response ? {
                        status: dealError.response.status,
                        statusText: dealError.response.statusText,
                        data: dealError.response.data
                    } : null
                }
            };
        }

        // Second approach: Use associations API directly
        let associationsResponse;
        try {
            associationsResponse = await hubspotClient.crm.deals.associationsApi.getAll(
                dealId,
                'line_items'
            );

            console.log('Direct associations API response:', {
                hasResults: !!associationsResponse.results,
                resultsCount: associationsResponse.results ? associationsResponse.results.length : 0
            });
        } catch (assocError) {
            console.warn('Error fetching associations (non-fatal):', assocError.message);
            associationsResponse = { results: [] };
        }

        // Combine results from both approaches
        let lineItemIds = [];

        // From direct associations API
        if (associationsResponse.results && associationsResponse.results.length > 0) {
            const idsFromAssociations = associationsResponse.results.map(result => result.id);
            console.log(`Found ${idsFromAssociations.length} line items via associations API`);
            lineItemIds = [...lineItemIds, ...idsFromAssociations];
        }

        // From deal getById with associations
        if (dealResponse.associations?.line_items?.results) {
            const idsFromDeal = dealResponse.associations.line_items.results.map(r => r.id);
            console.log(`Found ${idsFromDeal.length} line items via deal getById`);
            // Add any IDs not already in the array
            idsFromDeal.forEach(id => {
                if (!lineItemIds.includes(id)) lineItemIds.push(id);
            });
        }

        // Remove duplicates and clean
        lineItemIds = [...new Set(lineItemIds.filter(Boolean))];

        if (lineItemIds.length === 0) {
            console.log('No line items found for deal:', dealId);
            return {
                success: true,
                data: [],
                message: 'No line items found for this deal'
            };
        }

        console.log(`Found ${lineItemIds.length} unique line items for deal:`, lineItemIds);

        // Fetch line items in batch
        let lineItemsResponse;
        try {
            lineItemsResponse = await hubspotClient.crm.lineItems.batchApi.read({
                inputs: lineItemIds.map(id => ({ id })),
                properties: [
                    'name',
                    'hs_product_id',
                    'quantity',
                    'price',
                    'amount',
                    'hs_sku',
                    'description',
                    'hs_line_item_currency_code',
                    'ticket_id'
                ]
            });

            console.log(`Retrieved ${lineItemsResponse.results?.length || 0} line items from batch API`);
        } catch (batchError) {
            console.error('Error fetching line items batch:', batchError);
            return {
                success: false,
                message: `Failed to fetch line items: ${batchError.message}`,
                errorDetails: {
                    name: batchError.name,
                    status: batchError.status,
                    lineItemIds: lineItemIds
                }
            };
        }

        // Get product details for each line item
        const productIds = [...new Set(lineItemsResponse.results
            .map(item => item.properties.hs_product_id)
            .filter(Boolean))];

        let productsMap = {};
        if (productIds.length > 0) {
            try {
                console.log(`Fetching product details for ${productIds.length} products:`, productIds);
                const productsResponse = await hubspotClient.crm.products.batchApi.read({
                    inputs: productIds.map(id => ({ id })),
                    properties: ['name', 'price', 'description', 'hs_sku', 'rate_type', 'required_attributes', 'automation_db_list']
                });

                productsMap = productsResponse.results.reduce((map, product) => {
                    map[product.id] = {
                        id: product.id,
                        name: product.properties.name,
                        price: parseFloat(product.properties.price) || 0,
                        description: product.properties.description,
                        sku: product.properties.hs_sku
                    };
                    return map;
                }, {});

                console.log(`Mapped ${Object.keys(productsMap).length} products`);
            } catch (err) {
                console.error('Error fetching product details (non-fatal):', err);
            }
        }

        // Format line items with better error handling
        const lineItems = lineItemsResponse.results.map((item, index) => {
            try {
                const product = productsMap[item.properties.hs_product_id] || null;

                return {
                    id: String(item.id || ''),
                    productId: String(item.properties.hs_product_id || ''),
                    productName: String(item.properties.name || (product?.name || 'Unknown Product')),
                    quantity: parseInt(item.properties.quantity) || 1,
                    price: parseFloat(item.properties.price) || 0,
                    amount: parseFloat(item.properties.amount) || 0,
                    product: product ? {
                        id: String(product.id || ''),
                        name: String(product.name || ''),
                        price: parseFloat(product.price) || 0,
                        description: String(product.description || ''),
                        sku: String(product.sku || '')
                    } : null,
                    ticketId: String(item.properties.ticket_id || '')
                };
            } catch (itemError) {
                console.error(`Error formatting line item at index ${index}:`, itemError, item);
                // Return a minimal valid item instead of crashing
                return {
                    id: String(item.id || `error-${index}`),
                    productId: '',
                    productName: 'Error loading item',
                    quantity: 0,
                    price: 0,
                    amount: 0,
                    product: null,
                    ticketId: ''
                };
            }
        }).filter(Boolean); // Remove any null/undefined items

        console.log(`Formatted ${lineItems.length} line items successfully`);

        // Validate the result
        if (!Array.isArray(lineItems)) {
            console.error('Line items is not an array:', typeof lineItems, lineItems);
            return {
                success: false,
                message: 'Internal error: failed to format line items as array'
            };
        }

        return {
            success: true,
            data: lineItems,
            meta: {
                totalFound: lineItemIds.length,
                totalFormatted: lineItems.length,
                productsFound: Object.keys(productsMap).length
            }
        };

    } catch (error) {
        console.error('Unexpected error in get-deal-line-items:', error);
        return {
            success: false,
            message: error.message || 'Failed to fetch line items',
            errorDetails: {
                name: error.name,
                status: error.status,
                stack: error.stack,
                response: error.response ? {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                } : null
            }
        };
    }
};