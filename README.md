# 🌿 Verdant & Wild — Custom Amazon Connect Chatbot (ChatJS)

A production-grade, beautifully themed plant and nature chatbot built with **Amazon Connect ChatJS** (`amazon-connect-chatjs`), **AWS SDK v3**, and vanilla JavaScript/CSS.

---

## ✨ Features

- 🌿 **Lush Botanical Theme**: Custom-styled for indoor plants, houseplant diagnosis, rare flora, and nature enthusiasts.
- ⚡ **Official Amazon Connect ChatJS Integration**: Leverages the official `amazon-connect-chatjs` library to communicate directly with Amazon Connect's Participant Service over secure WebSockets.
- 🔄 **Two-Tier Architecture**:
  - **Control Plane**: Secure backend calling `connect:StartChatContact` via AWS SDK v3.
  - **Data Plane**: Frontend ChatJS managing WebSocket streams, typing events, participant notices, and message receipts.
- 🤖 **Dual-Mode Engine**:
  - **Live Amazon Connect Mode**: Connects directly to your AWS Amazon Connect instance and Lex V2 Bot.
  - **Interactive Botanical Simulator Mode**: Immediate out-of-the-box local testing with simulated botanist intelligence when AWS credentials are not yet configured.
- 💬 **Rich Chat Features**:
  - Quick action suggestion chips (e.g. *Why are my leaves yellowing?*, *Succulent watering schedule*).
  - Floating launcher with unread badge counter.
  - Real-time typing indicators with botanical bouncing animations.
  - Settings modal to inspect AWS Connect credentials and toggle display names.
  - Direct plant card integration: Click "Ask Doctor" on any plant to pre-fill specific care questions.

---

## 📁 Directory Structure

```
connect-custom-chatjs/
├── server.js                        # Node.js backend with Express & AWS SDK (@aws-sdk/client-connect)
├── package.json                     # Project manifest and scripts
├── .env.example                     # Sample Amazon Connect configuration
├── public/                          # Frontend client files
│   ├── index.html                   # Botanical store & care landing page with chat widget
│   ├── css/
│   │   ├── style.css                # Botanical website design
│   │   └── chat-widget.css          # Chat widget layout, bubbles, launcher, and animations
│   └── js/
│       ├── amazon-connect-chat.js   # Official amazon-connect-chatjs bundle
│       ├── chat-client.js           # ChatJS lifecycle wrapper (WebSocket, onMessage, onTyping)
│       ├── chat-ui.js               # Chat widget UI controller & event binder
│       └── main.js                  # Main website app coordinator
└── aws-backend/
    ├── lambda-start-chat.js         # Production AWS Lambda function for serverless deployment
    ├── cloudformation-template.yaml # CloudFormation template for API Gateway + Lambda + IAM
    └── README-AWS.md                # In-depth AWS Connect & Lex setup guide
```

---

## 🚀 Quick Start (Running Locally)

### 1. Start the Server
```bash
npm start
```
By default, the server runs on [http://localhost:3000](http://localhost:3000).

### 2. Immediate Testing (Simulation Mode)
Open [http://localhost:3000](http://localhost:3000) in your browser:
- Click the floating green leaf button in the bottom-right corner.
- Chat with **Sprout 🌱**, click quick reply chips, or test questions like:
  - *"Why are my monstera leaves yellowing?"*
  - *"How often do I water succulents?"*
  - *"Best low light indoor plants?"*
  - *"Connect with human horticulturist"*

---

## 🔌 Integrating With Your Live Amazon Connect Instance

### Step 1: Set up Amazon Connect in the AWS Console
1. **Find your Instance ID**: In the AWS Management Console, go to **Amazon Connect** &rarr; Select your instance &rarr; Note the **Instance ID** (GUID).
2. **Create / Identify your Contact Flow**:
   - In Amazon Connect Admin Portal, go to **Routing** &rarr; **Contact Flows**.
   - Ensure you have an inbound contact flow configured for Chat.
   - Attach your **Amazon Lex V2 Bot** (e.g., PlantCareBot) via a **"Get Customer Input"** block.
   - Note the **Contact Flow ID** (the GUID at the end of the ARN).

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your Amazon Connect details:
```env
PORT=3000
AWS_REGION=us-east-1
CONNECT_INSTANCE_ID=your-amazon-connect-instance-id
CONNECT_CONTACT_FLOW_ID=your-inbound-contact-flow-id

# Optional: AWS Credentials if not using default AWS CLI credentials / IAM role
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
```

### Step 3: Restart the Server
```bash
npm start
```
The server will detect your Amazon Connect credentials and switch from **Simulation Mode** to **Live Connect Mode**. Every chat opened will initiate a live session with your contact center!

