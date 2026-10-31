/**
 * Verdant & Wild - Plant Boutique & Botanical Care
 * Amazon Connect Custom ChatJS Backend Server
 */

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to check if AWS Connect credentials are configured
function isConnectConfigured() {
  return !!(
    process.env.CONNECT_INSTANCE_ID &&
    process.env.CONNECT_CONTACT_FLOW_ID &&
    (process.env.AWS_REGION || process.env.CONNECT_REGION)
  );
}

/**
 * GET /api/config-status
 * Informs the frontend whether real Amazon Connect credentials are provided
 */
app.get('/api/config-status', (req, res) => {
  const configured = isConnectConfigured();
  const region = process.env.AWS_REGION || process.env.CONNECT_REGION || 'us-east-1';
  const instanceId = process.env.CONNECT_INSTANCE_ID || '';
  const contactFlowId = process.env.CONNECT_CONTACT_FLOW_ID || '';

  res.json({
    configured,
    region,
    instanceIdMasked: instanceId ? `${instanceId.substring(0, 8)}...` : null,
    contactFlowIdMasked: contactFlowId ? `${contactFlowId.substring(0, 8)}...` : null,
    mode: configured ? 'live-connect' : 'simulation'
  });
});

/**
 * POST /api/start-chat
 * Control Plane: Initiates the chat session via Amazon Connect's StartChatContact API
 * 
 * Required in production:
 * - InstanceId (Amazon Connect Instance ID)
 * - ContactFlowId (Amazon Connect Inbound Contact Flow ID)
 * - ParticipantDetails (e.g. DisplayName)
 * 
 * Returns:
 * - ContactId
 * - ParticipantId
 * - ParticipantToken (used by amazon-connect-chatjs to establish WebSocket connection)
 */
app.post('/api/start-chat', async (req, res) => {
  // Reload .env in case user updated temporary credentials or session tokens
  dotenv.config({ override: true });

  const { customerName = 'Plant Lover', initialMessage, attributes = {} } = req.body;
  const region = process.env.AWS_REGION || process.env.CONNECT_REGION || 'us-east-1';

  // Check if live Amazon Connect credentials are configured
  if (isConnectConfigured()) {
    try {
      const { ConnectClient, StartChatContactCommand } = require('@aws-sdk/client-connect');

      // Sanitize credentials from .env to prevent issues with accidental quotes or whitespace
      const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
      const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim().replace(/^["']|["']$/g, '');
      const sessionToken = (process.env.AWS_SESSION_TOKEN || '').trim().replace(/^["']|["']$/g, '');

      const credentials = (accessKeyId && secretAccessKey) ? {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {})
      } : undefined;

      // Initialize AWS Connect Client with explicit credentials and region
      const client = new ConnectClient({
        region,
        ...(credentials ? { credentials } : {})
      });

      const command = new StartChatContactCommand({
        InstanceId: process.env.CONNECT_INSTANCE_ID,
        ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID,
        ParticipantDetails: {
          DisplayName: customerName
        },
        Attributes: {
          Source: 'VerdantAndWildWebsite',
          WebsiteTheme: 'PlantsAndNature',
          CustomerName: customerName,
          ...attributes
        },
        InitialMessage: initialMessage ? {
          ContentType: 'text/plain',
          Content: initialMessage
        } : undefined
      });

      console.log(`[Amazon Connect] Calling StartChatContact in region ${region}...`);
      const response = await client.send(command);

      console.log(`[Amazon Connect] Chat started successfully. ContactId: ${response.ContactId}`);

      return res.json({
        success: true,
        mode: 'live-connect',
        data: {
          contactId: response.ContactId,
          participantId: response.ParticipantId,
          participantToken: response.ParticipantToken
        },
        region
      });
    } catch (err) {
      console.error('[Amazon Connect] Error starting chat contact:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to start Amazon Connect chat contact',
        details: 'Check AWS credentials, Connect Instance ID, and Contact Flow ID in .env'
      });
    }
  }

  // Fallback to Intelligent Botanical Simulation Mode if no AWS Connect instance is linked yet
  console.log(`[Simulation Mode] Starting mock session for ${customerName}`);
  const mockContactId = 'mock-contact-' + Math.random().toString(36).substring(2, 10);
  const mockParticipantId = 'mock-part-' + Math.random().toString(36).substring(2, 10);
  const mockParticipantToken = 'mock-token-' + Math.random().toString(36).substring(2, 18);

  return res.json({
    success: true,
    mode: 'simulation',
    data: {
      contactId: mockContactId,
      participantId: mockParticipantId,
      participantToken: mockParticipantToken
    },
    region: 'us-east-1',
    note: 'Running in Botanical Simulator mode. Configure .env with your Amazon Connect instance to switch to live AWS Connect.'
  });
});

app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`  🌿 Verdant & Wild - Plant Care & Amazon Connect Chat`);
  console.log(`  🌐 Server running at: http://localhost:${PORT}`);
  console.log(`  ⚙️  Connect Status: ${isConnectConfigured() ? 'LIVE AWS CONNECT READY' : 'SIMULATION MODE (Set .env for live)'}`);
  console.log(`=========================================================\n`);
});

