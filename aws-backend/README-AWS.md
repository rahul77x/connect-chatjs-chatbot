# ☁️ Amazon Connect Chat Backend & Cloud Architecture Guide

This guide details the complete end-to-end integration architecture between **Amazon Connect**, **Amazon Lex V2 / Bedrock**, **Participant Service**, and the **custom ChatJS client**.

---

## 1. High-Level Architecture Overview

Amazon Connect Chat works on a two-tier separation between the **Control Plane** (Session Creation) and the **Data Plane** (Real-Time Communication):

```
+---------------------------------------------------------------------------------------------+
|                                    1. CLIENT BROWSER                                        |
|  [Botanical Website]                                                                        |
|         |                                                                                   |
|         | 1. HTTP POST /api/start-chat                                                      |
|         v                                                                                   |
|  +-----------------------+     3. Return ParticipantToken & ContactId                       |
|  | custom ChatJS Widget  |<--------------------------------------------------+             |
|  +-----------------------+                                                    |             |
+-------------|-----------------------------------------------------------------|-------------+
              |                                                                 |
              |                                                                 |
+-------------v-----------------------------------------------------------------|-------------+
|                                    2. CONTROL PLANE                                          |
|                                                                               |             |
|   [API Gateway / Node.js Backend]                                             |             |
|         |                                                                     |             |
|         | Calls StartChatContactCommand(...)                                  |             |
|         v                                                                     |             |
|   [AWS IAM Authenticated Service]                                             |             |
|         |                                                                     |             |
|         | 2. connect:StartChatContact                                         |             |
|         v                                                                     |             |
|   [Amazon Connect Service] ---------------------------------------------------+             |
|         |                                                                                   |
|         | Starts Inbound Contact Flow                                                       |
|         v                                                                                   |
|   [Contact Flow Engine] ---> [Amazon Lex V2 Bot / Bedrock Agent / Agent Queue]              |
+---------------------------------------------------------------------------------------------+
              ^
              | 4. WSS (WebSocket) Direct Connection via amazon-connect-chatjs
              |    (wss://participant.connect.<region>.amazonaws.com/participant/connection)
+-------------|-------------------------------------------------------------------------------+
|             v                      3. DATA PLANE                                            |
|   [Amazon Connect Participant Service (ACM)]                                                |
|   Handles:                                                                                  |
|   - Real-time messages (Lex bot responses, Customer text)                                   |
|   - Real-time typing events (application/vnd.amazonaws.connect.event.typing)                |
|   - Participant events (Agent joined/left)                                                  |
|   - Read & Delivered receipts                                                               |
+---------------------------------------------------------------------------------------------+
```

---

## 2. Where Does Integration Happen?

### A. AWS Console (Contact Flow & Bot Setup)
1. **Amazon Connect Instance**:
   - Create or identify your Amazon Connect instance.
   - Note the **Instance ID** (e.g. `12345678-1234-1234-1234-1234567890ab`).
2. **Inbound Contact Flow**:
   - Navigate to **Routing -> Contact Flows** in your Amazon Connect Admin portal.
   - Create a contact flow (or use the default "Sample Inbound Flow (First Contact)").
   - Add a **"Set Logging Behavior"** block (enabled).
   - Add a **"Get Customer Input"** block and link it to an **Amazon Lex V2 Bot** (e.g., PlantCareBot).
   - Add a fallback path to a **"Set Working Queue"** (e.g., Master Gardener Queue) and **"Transfer to Queue"** to escalate to human agents.
   - Publish the flow and copy the **Contact Flow ID** from the ARN (the GUID at the end).

### B. Control Plane (Backend API / Lambda)
- **File**: `server.js` (for local Node server) or `aws-backend/lambda-start-chat.js` (for AWS serverless).
- **IAM Permission required**: `connect:StartChatContact`.
- **Payload sent to Connect**:
  ```javascript
  const command = new StartChatContactCommand({
    InstanceId: process.env.CONNECT_INSTANCE_ID,
    ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID,
    ParticipantDetails: {
      DisplayName: "Plant Friend"
    },
    Attributes: {
      Topic: "Houseplant Care",
      Source: "VerdantAndWildWebsite"
    }
  });
  ```
- **Response received from Connect**:
  - `ContactId`: Unique identifier for the conversation session.
  - `ParticipantId`: ID assigned to the web visitor.
  - `ParticipantToken`: Ephemeral JWT credential used solely by ChatJS to authorize the WebSocket.

### C. Data Plane (Client-side Website via `amazon-connect-chatjs`)
- **File**: `public/js/chat-client.js`
- Uses the `ParticipantToken` to open the WebSocket:
  ```javascript
  const session = connect.ChatSession.create({
    chatDetails: {
      contactId: data.contactId,
      participantId: data.participantId,
      participantToken: data.participantToken
    },
    type: connect.ChatSession.SessionTypes.CUSTOMER,
    options: {
      region: "us-east-1"
    }
  });

  // Open WebSocket connection
  await session.connect();

  // Listen for bot and agent messages
  session.onMessage((event) => {
    console.log("New message:", event.data.Content);
  });

  // Listen for agent typing
  session.onTyping((event) => {
    console.log("Typing indicator:", event.data);
  });

  // Send a customer message
  session.sendMessage({
    contentType: "text/plain",
    message: "Why are my Monstera leaves turning yellow?"
  });
  ```

---

## 3. When Does the Integration Trigger?

1. **On Session Launch**:
   - The user clicks the chat launcher or clicks an "Ask Plant Doctor" button on a plant card.
   - The frontend calls `chatClient.startChat()`.
   - `StartChatContact` initiates the contact flow inside Amazon Connect.
2. **On Message Exchange**:
   - Every keystroke or message is handled directly over the low-latency WebSocket connection (`session.sendMessage`).
   - Responses from Amazon Lex V2 bots or live contact center agents arrive instantaneously via `session.onMessage`.
3. **On Session Tear-Down**:
   - When the customer closes or resets the chat, `session.disconnectParticipant()` releases the contact center connection.

---

## 4. One-Click Cloud Deployment via AWS SAM / CloudFormation

To deploy the serverless backend directly to AWS:

```bash
# 1. Package and deploy with AWS SAM or CloudFormation CLI
aws cloudformation deploy \
  --template-file aws-backend/cloudformation-template.yaml \
  --stack-name verdant-connect-chatbot \
  --parameter-overrides \
      ConnectInstanceId="YOUR-CONNECT-INSTANCE-ID" \
      ConnectContactFlowId="YOUR-CONTACT-FLOW-ID" \
  --capabilities CAPABILITY_IAM
```

Once deployed, copy the `ChatEndpointUrl` output and update your frontend `apiEndpoint`.

