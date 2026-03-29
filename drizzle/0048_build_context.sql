-- Migration: Add buildContext column to chatConversations for cross-conversation build memory
ALTER TABLE `chatConversations`
  ADD COLUMN IF NOT EXISTS `buildContext` JSON NULL;
