CREATE TABLE IF NOT EXISTS `user_secrets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `secretType` varchar(64) NOT NULL,
  `encryptedValue` text NOT NULL,
  `label` varchar(128),
  `lastUsedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_secrets_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_user_secrets_userId_type` ON `user_secrets` (`userId`, `secretType`);
