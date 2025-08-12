'use server'
import bcrypt from 'bcryptjs'
import { auth, signIn, signOut } from '@/auth'
import { IUserEmail, IUserName, IUserSignIn, IUserSignUp, IUserUpdate } from '@/types'
import { UserEmailSchema, UserSignUpSchema } from '../validator'
import { connectToDatabase } from '../db'
import User, { IUser } from '../db/models/user.model'
import { formatError, generateVerificationToken, normalizeEmail } from '../utils'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSetting } from './setting.actions'
import { sendVerificationEmail } from '@/emails'


// SIGN IN
export async function signInWithCredentials(user: IUserSignIn) {    
  return await signIn('credentials', { ...user, redirect: false })
}

// SIGN OUT
export const SignOut = async () => {
  const redirectTo = await signOut({ redirect: false })
  redirect(redirectTo.redirect)
}

// SIGN IN WITH GOOGLE
export const SignInWithGoogle = async () => {
  await signIn('google')
}

// CREATE USER - PUBLIC
export async function registerUser(userSignUp: IUserSignUp) {

  const normalizedEmail = normalizeEmail(userSignUp.email) 

  const user = await UserSignUpSchema.parseAsync({
    name: userSignUp.name,
    email: normalizedEmail,
    password: userSignUp.password,
    confirmPassword: userSignUp.confirmPassword,
  })

  if (user.password !== user.confirmPassword) {
    throw new Error('Passwords do not match')
  }

  try {
    await connectToDatabase()
    // Check if the email is already in use
    const existingUser = await User.findOne({ email: normalizedEmail }).lean()
    if (existingUser) {
      return { success: false, message: 'Email is already in use' }
    }

    const { token, hashedToken } = generateVerificationToken()

    await User.create({
      ...user,
      password: await bcrypt.hash(user.password, 12),
      emailVerified: false,
      verificationToken: hashedToken,
      verificationTokenExpires: Date.now() + 1000 * 60 * 30 ,// 30 minutes
    })

    console.log('user created:', user)

    await sendVerificationEmail( user.name, user.email, token,)

    return { success: true, message: 'User created successfully' }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// user.emailVerified = true
// user.verificationToken = undefined
// user.verificationTokenExpires = undefined
// await user.save()

// UPDATE USER NAME- PRIVATE -
export async function updateUserName(user: IUserName) {
  try {
    await connectToDatabase()
    const session = await auth()
    if (!session) {
      throw new Error('User is not authenticated')
    }

    const currentUser = await User.findById(session.user.id)
    if (!currentUser) throw new Error('User not found')

    currentUser.name = user.name
    const updatedUser = await currentUser.save()

    return {
      success: true,
      message: 'User updated successfully',
      data: JSON.parse(JSON.stringify(updatedUser)), // return updated user to the frontend
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// DELETE USER - ADMIN
export async function deleteUser(id:string) {
  try {
    await connectToDatabase()
    const session = await auth()
    if(session?.user.role !== "admin")
      throw new Error('Admin permission required')

    const res = await User.findByIdAndDelete(id)
    if (!res) throw new Error('User not found')
    revalidatePath('/admin/users')
    return {
      success: true,
      message: 'User deleted successfully',
    }
  }catch (error) {
    return {
      success: false,
      message: formatError(error),
    }
  }
}

// GET ALL USERS - ADMIN
export async function getAllUsers({
    page = 1,
    limit 
  }: {
    page:number,
    limit?:number
  }) {   
    await connectToDatabase()
    const session = await auth()
    if(session?.user.role !== "admin")
      throw new Error('Admin permission required')

    const { common: { pageSize } } = await getSetting()
    
    limit = limit || pageSize
    
    const skipAmount = (Number(page) -1)  * limit

    const usersQuery = User.find()
      .sort({ createdAt: 'desc' })
      .skip(skipAmount)
      .limit(limit)

    // Execute queries in parallel for efficiency
    const [users, totalUsers] = await Promise.all([
        usersQuery.exec(),
        User.countDocuments()
    ])

    const totalPages = Math.ceil(totalUsers / limit)

    return {
      data : JSON.parse(JSON.stringify(users)) as IUser[],
      totalPages : totalPages,
    }
 
  }

// UPDATE USER - BY ADMIN
export async function updateUser(user: IUserUpdate) {
  try {
    await connectToDatabase()

    const session = await auth()
    if(session?.user.role !== "admin")
      throw new Error('Admin permission required')

    const dbUser = await User.findById(user._id)
    if (!dbUser) throw new Error('User not found')

    const normalizedEmail = normalizeEmail(user.email)  

    const existingUser = await User.findOne({ normalizedEmail }).lean();
    if (existingUser) {
      return { success: false, message: 'This email is already in use' };
    }

    // Note: Mongoose _id is an object, so we convert it to a string for comparison.
    // 3. Check if this update is a demotion from the 'Admin' role
    const isAdminSelfDemoting = user._id.toString() === session.user.id && user.role !== session.user.role
        

    dbUser.name = user.name
    dbUser.email = normalizedEmail
    dbUser.role = user.role
    const updatedUser = await dbUser.save()
    revalidatePath('/admin/users')

    
    if (isAdminSelfDemoting) {
      // If the updated user is the current session user and their role has changed, sign them out
      await signOut({ redirect: false })
      redirect('/sign-in');
    }

    return {
      success: true,
      message: 'User updated successfully',
      data: JSON.parse(JSON.stringify(updatedUser)),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
    if (error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    return { success: false, message: formatError(error) }
  }
}

// GET USER BY ID - ADMIN
export async function getUserById(userId: string) {
  await connectToDatabase()
  const session = await auth()
  if(session?.user.role !== "admin")
    throw new Error('Admin permission required')

  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  return JSON.parse(JSON.stringify(user)) as IUser
}


// Update User Email - PRIVATE BY USER - corrected
export async function updateUserEmail(values: IUserEmail) {
  const session = await auth()
  if (!session) {
        throw new Error('User is not authenticated')
  }

  const userId = session.user.id
  if (!userId) {
    return { success: false, message: 'Authentication required.' }
  }

  const validatedFields = UserEmailSchema.safeParse(values)
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid data provided.' }
  }
  const { email } = validatedFields.data

  const normalizedEmail = normalizeEmail(email)

  try {    
    await connectToDatabase()

    // Check if the new email is already in use by another user
    const existingUser = await User.findOne({ normalizedEmail }).lean();
      if (existingUser && existingUser._id.toString() !== userId) {
        return { success: false, message: 'This email is already in use' };
      }

    const currentUser = await User.findById(userId).select('email').lean()
    if (!currentUser) throw new Error('User not found')  

    if (currentUser.email === normalizedEmail ) {
      return { success: false, message: 'New email is the same as current email' };
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { 
              email : normalizedEmail,
              emailVerified: null,  
            } }, // The update operation
      { new: true } // Return the updated document
    ).lean();

    console.log(`Updating user ${currentUser.name} email to ${normalizedEmail}. Replace with your DB call`);
    console.log(updatedUser);

    revalidatePath('/account/manage')

    return {
      success: true,
      message: 'Your email has been updated successfully. Please check your inbox to verify the new address',
      data: { email },
    }

  } catch (error) {
    console.error('Error updating user email:', error)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again',
      data: { error: formatError(error) },  
    }
  }
}






/*
? zod validated the data client side , now validated again with zod server side
?  before sending it to be authenticated by DB


*/