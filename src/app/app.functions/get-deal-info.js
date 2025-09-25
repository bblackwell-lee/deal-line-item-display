// src/app/app.functions/get-deal-info.js
const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}, parameters) => {
  console.log('=== GET DEAL INFO START ===');
  
  // Handle parameters regardless of how they're passed
  let dealId;
  
  // Check if the second parameter is an object (parameters) or function (sendResponse)
  if (typeof parameters === 'function') {
    // Old-style with sendResponse callback
    const sendResponse = parameters;
    dealId = context.parameters?.dealId;
    
    if (!dealId) {
      sendResponse({
        success: false,
        message: 'Deal ID is required'
      });
      return;
    }

    try {
      const result = await getDealInfo(dealId);
      sendResponse({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching deal info:', error);
      sendResponse({
        success: false,
        message: error.message || 'Failed to fetch deal information'
      });
    }
  } else {
    // New-style returning a promise
    dealId = parameters?.dealId || context.parameters?.dealId;
    
    if (!dealId) {
      return {
        success: false,
        message: 'Deal ID is required'
      };
    }

    try {
      const result = await getDealInfo(dealId);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error fetching deal info:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch deal information'
      };
    }
  }
};

// Extracted core functionality into a separate function
async function getDealInfo(dealId) {
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  const hubspotClient = new hubspot.Client({ accessToken: token });

  // Get deal details with associations
  const dealResponse = await hubspotClient.crm.deals.basicApi.getById(
    dealId,
    [
      'dealname',
      'amount',
      'dealstage',
      'closedate',
      'hubspot_owner_id',
      'deal_type',
      'program_type'
    ],
    undefined,
    ['companies', 'line_items']
  );

  const deal = dealResponse;
  
  // Get stage label
  const stageLabel = await getStageLabel(hubspotClient, deal.properties.dealstage);
  
  // Get owner name
  let ownerName = 'Unassigned';
  if (deal.properties.hubspot_owner_id) {
    try {
      const ownerResponse = await hubspotClient.crm.owners.ownersApi.getById(
        deal.properties.hubspot_owner_id
      );
      ownerName = `${ownerResponse.firstName || ''} ${ownerResponse.lastName || ''}`.trim();
    } catch (err) {
      console.log('Could not fetch owner name:', err.message);
    }
  }

  // Get associated company
  let companyId = null;
  let companyName = 'No Company';
  let companyDbPrefix = null;
  
  if (deal.associations?.companies?.results?.length > 0) {
    companyId = deal.associations.companies.results[0].id;
    
    try {
      const companyResponse = await hubspotClient.crm.companies.basicApi.getById(
        companyId,
        ['name', 'db_account_number']
      );
      
      companyName = companyResponse.properties.name || 'Unknown Company';
      companyDbPrefix = companyResponse.properties.db_account_number || null;
    } catch (err) {
      console.log('Could not fetch company details:', err.message);
    }
  }

  // Format response
  const dealInfo = {
    id: deal.id,
    name: deal.properties.dealname || 'Untitled Deal',
    amount: parseFloat(deal.properties.amount) || 0,
    stage: deal.properties.dealstage,
    stageLabel: stageLabel,
    closeDate: deal.properties.closedate,
    ownerId: deal.properties.hubspot_owner_id,
    ownerName: ownerName,
    companyId: companyId,
    companyName: companyName,
    companyDbPrefix: companyDbPrefix,
    dealType: deal.properties.deal_type || '',
    programType: deal.properties.program_type || ''
  };

  console.log('Deal info retrieved:', dealInfo);
  return dealInfo;
}

// Helper function to get stage label
async function getStageLabel(hubspotClient, stageId) {
  try {
    const pipeline = await hubspotClient.crm.pipelines.pipelinesApi.getById(
      'deals',
      'default'
    );
    
    const stage = pipeline.stages.find(s => s.id === stageId);
    return stage ? stage.label : stageId;
  } catch (err) {
    console.log('Could not fetch stage label:', err.message);
    return stageId;
  }
}
