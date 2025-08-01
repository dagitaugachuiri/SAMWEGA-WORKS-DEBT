# Samwega Works Ltd. Debt Repayment Management System

A lightweight debt repayment management system for Samwega Works Ltd., optimized for low-bandwidth environments in Kenya.

## Architecture

- **Frontend**: Next.js with Tailwind CSS (client/ directory)
- **Backend**: Standalone Node.js server with Express (server/ directory)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **SMS**: Vonage SMS API
- **Payments**: Payhero API

## Project Structure

```
samwega-debt-system/
├── client/                 # Next.js frontend
│   ├── components/
│   ├── pages/
│   ├── styles/
│   └── package.json
├── server/                 # Node.js backend
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── package.json
├── firestore.rules
└── README.md
```

## Setup Instructions

### Prerequisites

1. Node.js (v18 or higher)
2. Firebase project with Firestore and Authentication enabled
3. Payhero API credentials
4. Vonage SMS API credentials

### Environment Variables

Create `.env` files in both client and server directories:

**client/.env.local**
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

**server/.env**
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
PAYHERO_API_KEY=your_payhero_api_key
PAYHERO_BASE_URL=https://api.payhero.co.ke
VONAGE_API_KEY=your_vonage_api_key
VONAGE_API_SECRET=your_vonage_api_secret
SAMWEGA_PAYBILL=your_paybill_number
PORT=5000
```

### Installation

1. **Clone and setup the project:**
```bash
cd samwega-debt-system
```

2. **Install server dependencies:**
```bash
cd server
npm install
```

3. **Install client dependencies:**
```bash
cd ../client
npm install
```

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore and Authentication
3. Generate a service account key and add to server/.env
4. Deploy firestore.rules to your Firebase project

### Running the Application

1. **Start the backend server:**
```bash
cd server
npm run dev
```

2. **Start the frontend (in a new terminal):**
```bash
cd client
npm run dev
```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## API Endpoints

- `POST /api/debts` - Create new debt record
- `GET /api/debts` - Get all debts for authenticated user
- `GET /api/debts/:id` - Get specific debt
- `POST /api/debts/:id/payment` - Process payment for debt
- `POST /api/test/simulate-payment` - Test payment simulation

## Testing

Run the test script to validate system functionality:

```bash
cd server
npm run test
```

## Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Backend (Heroku/VPS)
1. Deploy to Heroku or your preferred VPS
2. Set environment variables
3. Update NEXT_PUBLIC_API_BASE_URL in frontend

## Features

- ✅ User authentication with Firebase Auth
- ✅ Debt record creation with unique 6-digit codes
- ✅ SMS notifications via Vonage
- ✅ M-Pesa payment integration via Payhero
- ✅ Bank payment and cheque management
- ✅ Responsive UI optimized for low-bandwidth
- ✅ Complete test procedure

## Security

- HTTPS enforced for all API endpoints
- Firebase Security Rules implemented
- Input validation on both frontend and backend
- JWT token verification for API access

## Support

For technical support, contact the development team or refer to the documentation in each service's respective directory.
