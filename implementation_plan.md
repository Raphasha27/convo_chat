# implementation_plan.md

## Project: CONVO
**Tagline**: Real-Time Conversations. Simplified.
**Goal**: Build a real-time messaging application similar to WhatsApp.

### 1. Requirements Overview
- **User Accounts**: Phone/Email auth (OTP), Profile (Name, Photo, Status), Online/Last Seen.
- **Messaging**: 1-to-1, Groups, Real-time (WebSockets), Message States (Sent, Delivered, Read), Typing Indicators.
- **Media**: Images, Voice Notes, Documents.
- **Calls**: Voice and Video (WebRTC).
- **Notifications**: Push & In-app.
- **Security**: JWT Auth, Secure Storage.

### 2. Technology Stack
- **Backend**: 
    - Framework: FastAPI (Python)
    - Real-time: WebSockets
    - Database: PostgreSQL
    - Caching/Presence: Redis
    - Tasks: Celery + RabbitMQ (Future)
- **Frontend**: 
    - React / React Native (User to confirm choice, defaulting to React Web for MVP)
    - Tailwind CSS
- **Storage**: S3 / Cloudinary

### 3. Database Schema (CONVO Naming)
- **users**: `user_id`, `phone`, `email`, `username`, `avatar_url`, `status`, `last_seen`, `created_at`
- **chats**: `chat_id`, `is_group`, `name`, `created_at`
- **chat_members**: `chat_id`, `user_id`, `role`, `joined_at`
- **messages**: `message_id`, `chat_id`, `sender_id`, `content`, `media_url`, `created_at`
- **message_status**: `status_id`, `message_id`, `user_id`, `status` (sent/delivered/read), `updated_at`
- **media_files**: `media_id`, `message_id`, `url`, `type`, `size`
- **calls**: `call_id`, `caller_id`, `chat_id`, `type`, `status`, `started_at`, `ended_at`

### 4. Implementation Stages
#### Phase 1: Foundation & Schema ✅
- Define SQL Schema ✅
- Setup FastAPI structure ✅
- Database connection ✅

#### Phase 2: Core Features (MVP) ✅
- Auth Flow (Register/Login) ✅
- WebSocket Connection Manager ✅
- Basic 1nd 1-on-1 Chat API ✅

#### Phase 3: UI & Advanced ✅
- React Frontend Setup ✅
- Real-time Message Rendering ✅
- Media Uploads ✅
- Voice/Video Calls (WebRTC) ✅

#### Phase 4: Polish & Real-time Enhancements ✅
- Typing Indicators ✅
- Message Status (Delivery/Read Receipts) ✅
- In-app Notifications ✅
- Online Presence (Real-time) ✅
- Refined Dashboard UI ✅

#### Phase 5: Finalization & Deployment
- Production Database Migration
- AWS S3 / Cloudinary Integration
- Mobile Responsive Polish
- Final Bug Testing

#### Phase 6: Connection & Social Features ✅
- User Search (by Email/Username) ✅
- Contact/Friendship System (Add/Remove) ✅
- Invite Link Sharing ✅
- Invite Friends Modal ✅

#### Phase 7: Group Chat & Chat Management ✅
- Create Group Modal with member selection ✅
- Leave Group functionality ✅
- Delete Chat functionality ✅
- Chat Details Sidebar ✅

#### Phase 8: User Profile Management ✅
- Profile Sidebar (edit name, about, phone) ✅
- PUT /users/me API endpoint ✅
- Avatar placeholder ✅

#### Phase 9: UI/UX Polish ✅
- Premium styling with gradients ✅
- Improved chat list and message bubbles ✅
- Empty states with CTA buttons ✅
- Welcome screen with actions ✅

#### Phase 10: Future Enhancements ✅
- Avatar upload ✅
- Message search ✅
- Dark mode ✅
- Push notifications ✅ (Permissions UI Added)
- **Blue Theme Refresh** ✅ (Messenger-inspired blue UI)
- **GitHub Repository** ✅ (convo_chat repo created)
