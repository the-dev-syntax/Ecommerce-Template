// lib/db/models/account.model.ts
import { IAccountInput } from '@/types';
import { Document, Model, model, models, Schema } from 'mongoose';

export interface IAccount extends Document, IAccountInput {
  userId: Schema.Types.ObjectId;
  createdAt: Date
  updatedAt: Date  
}

const accountSchema = new Schema<IAccount>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  provider: { type: String, required: true },
  providerAccountId: { type: String, required: true },
  access_token: { type: String },
  refresh_token: { type: String },
  expires_at: { type: Number },
  token_type: { type: String },
  scope: { type: String },
  id_token: { type: String },
  session_state: { type: String },
});

// Create a compound index to ensure a provider account can only be linked once.
accountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });

const Account = (models.Account as Model<IAccount>) || model<IAccount>('Account', accountSchema);

export default Account;