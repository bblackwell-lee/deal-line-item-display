// src/app/app.functions/get-deal-line-items.js2
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

    // Second approach: Use associations API directly (per documentation)
    // https://developers.hubspot.com/docs/api/crm/associations
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

    // Fetch line items in batch
    const lineItemsResponse = await hubspotClient.crm.lineItems.batchApi.read({
      inputs: lineItemIds.map(id => ({ id })),
      properties: [
        'name',
        'hs_product_id',
        'quantity',
        'price',
        'amount',
        'product_fulfillment_data',
        'product_fulfillment_information',
        'hs_sku',
        'description',
        'hs_line_item_currency_code',
        'product_type',
        'oms_automation',
        'associated_note_id',
        'associated_note_title',
        'has_associated_note',
        'ticket_id', // Added ticket_id property
        'ready_for_fulfillment' // Add this property
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
            sku: product.properties.hs_sku,
            rateType: product.properties.rate_type,
            requiredAttributes: product.properties.required_attributes,
            automationDbList: product.properties.automation_db_list?.split(',').map(s => s.trim()) || [],
            isCostPer: product.properties.rate_type === 'Cost Per'
          };
          return map;
        }, {});
      } catch (err) {
        console.error('Error fetching product details:', err);
      }
    }

    // Format line items
    const lineItems = lineItemsResponse.results.map(item => {
      const fulfillmentData = item.properties.product_fulfillment_data 
        ? parseFulfillmentData(item.properties.product_fulfillment_data)
        : {};

      const product = productsMap[item.properties.hs_product_id] || null;
      
      // Extract dates and insertion dates from fulfillment data
      let startDate = fulfillmentData.campaign_start_date || '';
      let endDate = fulfillmentData.campaign_end_date || '';
      let insertionDates = [];
      
      if (fulfillmentData.insertion_dates) {
        insertionDates = fulfillmentData.insertion_dates;
        // For Cost Per products, dates come from insertions
        if (insertionDates.length > 0 && product?.isCostPer) {
          startDate = ''; // Cost Per products don't use start/end dates
          endDate = '';
        }
      }

      // Extract custom fields (everything except known system fields)
      const systemFields = [
        'campaign_start_date', 'campaign_end_date', 'insertion_dates',
        'total_insertions', 'product_type', 'rate_type', 'oms_automation_status',
        'company_db_prefix', 'product_automation_prefixes', 'associated_note_id',
        'associated_note_title', 'associated_note_preview', 'has_associated_note'
      ];
      
      const customFields = Object.keys(fulfillmentData)
        .filter(key => !systemFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = fulfillmentData[key];
          return obj;
        }, {});

      return {
        id: item.id,
        productId: item.properties.hs_product_id || '',
        productName: item.properties.name || product?.name || 'Unknown Product',
        quantity: parseInt(item.properties.quantity) || 1,
        price: parseFloat(item.properties.price) || 0,
        amount: parseFloat(item.properties.amount) || 0,
        fulfillmentData: fulfillmentData,
        fulfillmentInfo: item.properties.product_fulfillment_information || '',
        startDate: startDate,
        endDate: endDate,
        insertionDates: insertionDates,
        customFields: customFields,
        product: product,
        // Note association data
        associatedNoteId: item.properties.associated_note_id || fulfillmentData.associated_note_id || '',
        associatedNoteTitle: item.properties.associated_note_title || fulfillmentData.associated_note_title || '',
        hasAssociatedNote: item.properties.has_associated_note === 'Yes' || fulfillmentData.has_associated_note === 'Yes',
        ticketId: item.properties.ticket_id || '',
        // Add the fulfillment readiness status
        readyForFulfillment: item.properties.ready_for_fulfillment === 'yes'
      };
    });

    console.log(`Formatted ${lineItems.length} line items`);
    
    return {
      success: true,
      data: lineItems
    };

  } catch (error) {
    console.error('Error fetching line items:', error);
    // Add more detailed error information
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

// Helper function to parse fulfillment data JSON
function parseFulfillmentData(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('Error parsing fulfillment data:', err);
    return {};
  }
}
