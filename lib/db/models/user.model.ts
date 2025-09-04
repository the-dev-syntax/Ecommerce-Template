import { Schema, Model, model, models } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUserInput } from '@/types'; 
import { AuthenticatedUser } from '@/types/next-auth';


export interface IUser extends Document, IUserInput {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Interface for statics
export interface IUserModel extends Model<IUser> {
  authenticate(email: string, password: string): Promise<AuthenticatedUser | null>;
}

// 3. Define schema with statics typing
const UserSchema = new Schema<IUser, IUserModel>({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  emailVerified: { type: Date, default: null },
  verificationToken: { type: String, select: false },
  verificationTokenExpires: { type: Date, select: false },
}, { timestamps: true });

// 4. Static method implementation
UserSchema.statics.authenticate = async function (
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
 
  const user = await this.findOne({ email }).select("+password");
  if (!user || !user.password) return null;

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return null;
  
  return {
    id: user._id.toString(),
    name: user.name || user.email.split("@")[0],
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  };
};

// 5. Export the model
const User = models.User as unknown as IUserModel || model<IUser, IUserModel>("User", UserSchema);

export default User;

/*
import { IUserInput } from '@/types'

import {
  Document, 
  Model,
  model,
  models,
  Schema,
} from 'mongoose'


export interface IUser extends Document, IUserInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}



const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    password: { type: String, required: true, select: false, minlength: 6 },
    image: { type: String },
    emailVerified: { type: Date, default: null },
    verificationToken: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null },    
  },   
  {
    timestamps: true,
  },

)


// if you make a Schema before use it , if not make a new Schema "Schema = Blueprint"
const User = (models.User as Model<IUser>) || model<IUser>('User', userSchema)

export default User
*/