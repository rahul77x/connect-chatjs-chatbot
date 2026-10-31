/**
 * AWS Lambda Function: StartAmazonConnectChat
 * 
 * Purpose:
 * Serves as the Control Plane backend for Amazon Connect Chat.
 * When the frontend requests a new chat, this function securely calls
 * Amazon Connect's StartChatContact API using IAM execution role permissions,
 * and returns the ephemeral ParticipantToken, ParticipantId, and ContactId to the client.
 * 
 * Runtime: Node.js 18.x or 20.x
 */

const { ConnectClient, StartChatContactCommand } = require('@aws-sdk/client-connect');

// Cache the Connect client across warm invocations
const region = process.env.CONNECT_REGION || process.env.AWS_REGION || 'us-east-1';
const connectClient = new ConnectClient({ region });

const INSTANCE_ID = process.env.CONNECT_INSTANCE_ID;
const CONTACT_FLOW_ID = process.env.CONNECT_CONTACT_FLOW_ID;

// CORS headers for your plant website domain (or '*' for testing)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  // Handle HTTP OPTIONS pre-flight request for CORS
  if (event.httpMethod === 'OPTIONS' || (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS')) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'CORS OK' })
    };
  }

  try {
    let body = {};
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }

    const customerName = body.customerName || 'Plant Enthusiast';
    const initialMessage = body.initialMessage;
    const customAttributes = body.attributes || {};

    if (!INSTANCE_ID || !CONTACT_FLOW_ID) {
      throw new Error('CONNECT_INSTANCE_ID or CONNECT_CONTACT_FLOW_ID environment variable is missing.');
    }

    const startChatParams = {
      InstanceId: INSTANCE_ID,
      ContactFlowId: CONTACT_FLOW_ID,
      ParticipantDetails: {
        DisplayName: customerName
      },
      Attributes: {
        Source: 'VerdantAndWildBotanicalSite',
        CustomerName: customerName,
        Topic: 'PlantCare',
        ...customAttributes
      },
      InitialMessage: initialMessage ? {
        ContentType: 'text/plain',
        Content: initialMessage
      } : undefined
    };

    console.log(`Starting chat for customer: ${customerName} on instance: ${INSTANCE_ID}`);

    const command = new StartChatContactCommand(startChatParams);
    const response = await connectClient.send(command);

    console.log(`Chat created successfully. ContactId: ${response.ContactId}`);

    // Return the tokens needed by amazon-connect-chatjs
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        data: {
          contactId: response.ContactId,
          participantId: response.ParticipantId,
          participantToken: response.ParticipantToken
        },
        region
      })
    };
  } catch (error) {
    console.error('Error starting Amazon Connect chat contact:', error);

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal Server Error starting chat contact'
      })
    };
  }
};

