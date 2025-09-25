// src/app/app.functions/get-deal-line-items.js
const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}, parameters = {}) => {
  console.log('=== GET DEAL LINE ITEMS START ===');
  
  // Get dealId from either parameters directly or context.parameters
  const dealId = parameters?.dealId || context?.parameters?.dealId;
  
  console.log('Input parameters:', {
    dealId,
    fromParameters: parameters?.dealId,
    fromContext: context?.parameters?.dealId
  });
  
  if (!dealId) {
    return {
      success: false,
      message: 'Deal ID is required'
    };
  }

  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  const hubspotClient = new hubspot.Client({ accessToken: token });

  try {
    console.log(`Fetching deal with ID: ${dealId} including line_items associations`);
    
    // First approach: Get deal with line item associations
    const dealResponse = await hubspotClient.crm.deals.basicApi.getById(
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

    // Second approach: Use associations API directly
    const associationsResponse = await hubspotClient.crm.deals.associationsApi.getAll(
      dealId,
      'line_items'
    );
    
    console.log('Direct associations API response:', {
      hasResults: !!associationsResponse.results,
      resultsCount: associationsResponse.results ? associationsResponse.results.length : 0
    });
    
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
        data: []
      };
    }

    console.log(`Found ${lineItemIds.length} unique line items for deal:`, lineItemIds);

    // Fetch line items in batch - removed fulfillment properties
    const lineItemsResponse = await hubspotClient.crm.lineItems.batchApi.read({
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
        'product_type',
        'ticket_id'
   
      ]
    });

    // Get product details for each line item
    const productIds = [...new Set(lineItemsResponse.results
      .map(item => item.properties.hs_product_id)
      .filter(Boolean))];

    let productsMap = {};
    if (productIds.length > 0) {
      try {
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
      } catch (err) {
        console.error('Error fetching product details:', err);
      }
    }

    // Format line items - removed all fulfillment data processing
    const lineItems = lineItemsResponse.results.map(item => {
      const product = productsMap[item.properties.hs_product_id] || null;
      
      return {
        id: item.id || '',
        productId: item.properties.hs_product_id || '',
        productName: item.properties.name || (product?.name || 'Unknown Product'),
        quantity: parseInt(item.properties.quantity) || 1,
        price: parseFloat(item.properties.price) || 0,
        amount: parseFloat(item.properties.amount) || 0,
        product: product ? {
          id: product.id || '',
          name: product.name || '',
          price: parseFloat(product.price) || 0,
          description: product.description || '',
          sku: product.sku || ''
          
        } : null,
        
        ticketId: item.properties.ticket_id || ''
      
      };
    });

    console.log(`Formatted ${lineItems.length} line items`);
    
    return {
      success: true,
      data: lineItems
    };

  } catch (error) {
    console.error('Error fetching line items:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch line items',
      errorDetails: {
        name: error.name,
        status: error.status,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null
      }
    };
  }
};
