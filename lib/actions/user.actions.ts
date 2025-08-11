'use server'
import bcrypt from 'bcryptjs'
import { auth, signIn, signOut } from '@/auth'
import { IUserEmail, IUserName, IUserSignIn, IUserSignUp } from '@/types'
import { UserEmailSchema, UserSignUpSchema, UserUpdateSchema } from '../validator'
import { connectToDatabase } from '../db'
import User, { IUser } from '../db/models/user.model'
import { formatError } from '../utils'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import z from 'zod'
import { getSetting } from './setting.actions'


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
  try {

    const user = await UserSignUpSchema.parseAsync({
      name: userSignUp.name,
      email: userSignUp.email,
      password: userSignUp.password,
      confirmPassword: userSignUp.confirmPassword,
    })

    await connectToDatabase()

    await User.create({
      ...user,
      password: await bcrypt.hash(user.password, 5),
    })
    return { success: true, message: 'User created successfully' }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

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
    if(session?.user.role !== "Admin")
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
    if(session?.user.role !== "Admin")
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

// UPDATE USER - ADMIN
export async function updateUser(user: z.infer<typeof UserUpdateSchema>) {
  try {
    await connectToDatabase()
    const session = await auth()
    if(session?.user.role !== "Admin")
      throw new Error('Admin permission required')

    const dbUser = await User.findById(user._id)
    if (!dbUser) throw new Error('User not found')

      // Note: Mongoose _id is an object, so we convert it to a string for comparison.
      // 3. Check if this update is a demotion from the 'Admin' role
   const isAdminSelfDemoting = user._id.toString() === session.user.id && user.role !== session.user.role
        

    dbUser.name = user.name
    dbUser.email = user.email
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
    if(session?.user.role !== "Admin")
      throw new Error('Admin permission required')

  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  return JSON.parse(JSON.stringify(user)) as IUser
}


// Update User Email - PRIVATE - corrected
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


  try {    
    await connectToDatabase()
    // Check if the new email is already in use by another user
    const existingUser = await User.findOne({ email }).lean();
      if (existingUser && existingUser._id.toString() !== userId) {
        return { success: false, message: 'This email is already in use.' };
      }

    const currentUser = await User.findById(userId).select('email').lean()
      if (!currentUser) throw new Error('User not found')  

    if (currentUser.email === email) {
      return { success: false, message: 'New email is the same as current email.' };
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { 
              email: email,
              emailVerified: null,  
            } }, // The update operation
      { new: true } // Return the updated document
    ).lean();
    console.log(`Updating user ${currentUser.name} email to ${email}. Replace with your DB call.`);
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