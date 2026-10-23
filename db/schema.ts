import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('repwise_accounts', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const credentials = sqliteTable('repwise_credentials', {
  userId:text('user_id').primaryKey().references(()=>accounts.userId,{onDelete:'cascade'}),
  email:text('email').notNull().unique(),
  password:text('password').notNull(),
});
export const sessions = sqliteTable('repwise_sessions', {
  tokenHash:text('token_hash').primaryKey(),
  userId:text('user_id').notNull().references(()=>accounts.userId,{onDelete:'cascade'}),
  expiresAt:integer('expires_at').notNull(),
});
export const attempts = sqliteTable('repwise_auth_attempts', {
  key:text('key').primaryKey(),
  count:integer('count').notNull(),
  expiresAt:integer('expires_at').notNull(),
});
