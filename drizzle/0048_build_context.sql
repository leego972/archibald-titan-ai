-- Migration: Add buildContext column to chatConversations for cross-conversation build memory
ALTER TABLE `chat_conversations`
  ADD COLUMN `buildContext` JSON NULL;
