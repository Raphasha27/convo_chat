-- CONVO Database Schema
-- Version: 1.0.0

-- Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    status_message VARCHAR(100),
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Chats / Conversations Table
CREATE TABLE chats (
    chat_id SERIAL PRIMARY KEY,
    is_group BOOLEAN DEFAULT FALSE,
    name VARCHAR(100), -- Null for 1-to-1 chats
    description TEXT,
    group_avatar_url TEXT,
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Members (Many-to-Many for Groups and 1-to-1)
CREATE TABLE chat_members (
    chat_id INT REFERENCES chats(chat_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- admin, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
);

-- Messages Table
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    chat_id INT REFERENCES chats(chat_id) ON DELETE CASCADE,
    sender_id INT REFERENCES users(user_id),
    content TEXT, -- Can be null if it's purely media key
    msg_type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, document
    reply_to_message_id INT REFERENCES messages(message_id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message Status (Read Receipts)
CREATE TABLE message_status (
    status_id SERIAL PRIMARY KEY,
    message_id INT REFERENCES messages(message_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id), -- The user who received/read the message
    status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- Media Files Table
CREATE TABLE media_files (
    media_id SERIAL PRIMARY KEY,
    message_id INT REFERENCES messages(message_id) ON DELETE CASCADE,
    uploader_id INT REFERENCES users(user_id),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50), -- mime type
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calls Table
CREATE TABLE calls (
    call_id SERIAL PRIMARY KEY,
    chat_id INT REFERENCES chats(chat_id),
    initiator_id INT REFERENCES users(user_id),
    call_type VARCHAR(20) DEFAULT 'voice', -- voice, video
    status VARCHAR(20) DEFAULT 'initiated', -- initiated, ongoing, ended, missed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INT
);

-- Indexes for Performance
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_message_status_msg ON message_status(message_id);
