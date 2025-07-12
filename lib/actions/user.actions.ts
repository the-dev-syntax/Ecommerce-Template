'use server'
import bcrypt from 'bcryptjs'
import { auth, signIn, signOut } from '@/auth'
import { IUserName, IUserSignIn, IUserSignUp } from '@/types'
import { UserSignUpSchema } from '../validator'
import { connectToDatabase } from '../db'
import User, { IUser } from '../db/models/user.model'
import { formatError } from '../utils'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { PAGE_SIZE } from '../constants'

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

// CREATE USER - ADMIN
export async function registerUser(userSignUp: IUserSignUp) {
  try {

    const user = await UserSignUpSchema.parseAsync({
      name: userSignUp.name,
      email: userSignUp.email,
      password: userSignUp.password,
      confirmPassword: userSignUp.confirmPassword,
    })

    await connectToDatabase()
     const session = await auth()
      if(session?.user.role !== "Admin")
        throw new Error('Admin permission required')



    await User.create({
      ...user,
      password: await bcrypt.hash(user.password, 5),
    })
    return { success: true, message: 'User created successfully' }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// UPDATE USER NAME- ADMIN
export async function updateUserName(user: IUserName) {
  try {
    await connectToDatabase()
    const session = await auth()
    if(session?.user.role !== "Admin")
      throw new Error('Admin permission required')

    const currentUser = await User.findById(session?.user?.id)
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

    limit = limit || PAGE_SIZE
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


/*
? zod validated the data client side , now validated again with zod server side
?  before sending it to be authenticated by DB


*/