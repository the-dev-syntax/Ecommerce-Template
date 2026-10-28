'use server'
import bcrypt from 'bcryptjs'
import { auth, signIn, signOut } from '@/auth'
import { IChangePassword, IRequestPasswordReset, IResetPassword, IUserEmail, IUserName, IUserSignIn, IUserSignUp, IUserUpdate, VerificationPropsType } from '@/types'
import { ChangePasswordSchema, RequestPasswordResetSchema, ResetPasswordSchema, UserEmailSchema, UserNameSchema, UserSignUpSchema, UserUpdateSchema } from '../validator'
import { connectToDatabase } from '../db'
import User, { IUser } from '../db/models/user.model'
import { clampLimit, clampPage, formatError, generateOtp, generateVerificationToken, normalizeEmail } from '../utils'
import { redirect } from 'next/navigation'
import { getSetting } from './setting.actions'
import { sendPasswordResetEmail, sendVerificationEmail } from '@/emails'
import { incrementIPEmailTokenAttempt, resetIPAttempt, checkAndSetEmailRateLimit, limitAuthActionsByIP, limitPasswordResetRequests, limitPasswordResetConfirm } from '@/lib/rate-limit';
import crypto from 'crypto';
import { revalidateAllLocales } from '../utils-serverOnly'
import { EMAIL_EXPIRATION_TIME, MAX_OTP_ATTEMPTS, OTP_LOCKOUT_TIME, PASSWORD_RESET_EXPIRATION_TIME } from '../constants'
// import { getToken } from 'next-auth/jwt';







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
    // 1. FIRST DEFENSE: Stop bots/spam by IP (No DB connection yet)
    await limitAuthActionsByIP();

    await connectToDatabase()

    // Check if the email is already in use (case-insensitive)
    const existingUser = await User.findOne({ email: normalizedEmail })
      .collation({ locale: 'en', strength: 2 })

    if (existingUser) {
      // Enumeration-safe: always report success. If the address belongs to an
      // unverified account, re-send the code to its owner (the caller cannot
      // tell whether the account exists). Verified accounts get no email.
      if (!existingUser.emailVerified) {
        try {
          await checkAndSetEmailRateLimit(normalizedEmail)
          const { otp, hashedOtp } = await generateOtp()
          await User.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                verificationToken: hashedOtp,
                verificationTokenExpires: new Date(
                  Date.now() + EMAIL_EXPIRATION_TIME
                ),
              },
            }
          )
          await sendVerificationEmail({
            name: existingUser.name,
            email: normalizedEmail,
            token: otp,
            update: false,
          })
        } catch (error) {
          // Never turn a mail/limiter failure into an account-existence oracle.
          console.error('Unable to resend verification email', error)
        }
      }
      return {
        success: true,
        message: 'If this email can be used, a verification code has been sent.',
      }
    }

    // Check the per-email limiter BEFORE creating the account and sending mail.
    await checkAndSetEmailRateLimit(normalizedEmail)

    const { otp, hashedOtp } = await generateOtp()

    const createdUser = await User.create({
      ...user,
      password: await bcrypt.hash(user.password, 12),
      emailVerified: null,
      verificationToken: hashedOtp,
      verificationTokenExpires: new Date(Date.now() + EMAIL_EXPIRATION_TIME),
    })

    const verificationProps: VerificationPropsType = {
      name: createdUser.name,
      email: normalizedEmail,
      token: otp,
      update: false,
    }
    await sendVerificationEmail(verificationProps)

    return { success: true, message: 'User created successfully' }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// UPDATE USER NAME- PRIVATE -
export async function updateUserName(user: IUserName) {

  const session = await auth()
  if (!session) {
    throw new Error('User is not authenticated')
  }
  const userName = UserNameSchema.parse(user)
  try {
    await connectToDatabase()

    const updatedUser = await User.findByIdAndUpdate(
      session.user.id,
      { name: userName.name },
      { new: true }
    )    
   
    if (!updatedUser) throw new Error('User not found')

    // currentUser.name = userName.name
    // const updatedUser = await currentUser.save()
    //! should add useSession.update here

    await revalidateAllLocales('/');

    return {
      success: true,
      message: 'User updated successfully',
      data: JSON.parse(JSON.stringify(updatedUser)), // return updated user to the frontend
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// UPDATE USER PASSWORD - PRIVATE
export async function updateUserPassword(values: IChangePassword) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User is not authenticated')

    const { currentPassword, newPassword } =
      ChangePasswordSchema.parse(values)

    // Slow down password guessing from a hijacked session.
    await limitAuthActionsByIP()

    await connectToDatabase()

    const user = await User.findById(session.user.id).select('+password')
    if (!user) throw new Error('User not found')
    if (!user.password)
      return {
        success: false,
        message: 'This account does not have a password set.',
      }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch)
      return { success: false, message: 'Current password is incorrect' }

    const newHash = await bcrypt.hash(newPassword, 12)

    // Guard on the old hash and bump the version in one write so concurrent
    // password changes cannot lose a version increment.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, password: user.password },
      {
        $set: {
          password: newHash,
          passwordChangedAt: new Date(),
        },
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
        $inc: { tokenVersion: 1 },
      }
    )

    if (!updated)
      return {
        success: false,
        message: 'Password was changed by another request. Please try again.',
      }

    return { success: true, message: 'Password updated successfully' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// REVOKE ALL SESSIONS - PRIVATE
export async function revokeAllSessions() {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('User is not authenticated')

    await connectToDatabase()
    const user = await User.findByIdAndUpdate(session.user.id, {
      $inc: { tokenVersion: 1 },
    })
    if (!user) throw new Error('User not found')

    return { success: true, message: 'Signed out of all devices' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// REQUEST PASSWORD RESET - PUBLIC
export async function requestPasswordReset(values: IRequestPasswordReset) {
  try {
    const { email } = RequestPasswordResetSchema.parse(values)
    const normalizedEmail = normalizeEmail(email)

    await limitPasswordResetRequests(normalizedEmail)
    await connectToDatabase()

    // Collation makes the lookup case-insensitive for OAuth-created accounts.
    const user = await User.findOne({ email: normalizedEmail })
      .collation({ locale: 'en', strength: 2 })
      .select('name email')

    if (user) {
      const { token, hashedToken } = generateVerificationToken()

      await User.findByIdAndUpdate(user._id, {
        $set: {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(
            Date.now() + PASSWORD_RESET_EXPIRATION_TIME
          ),
        },
      })

      const { site } = await getSetting()
      const resetLink = new URL(
        `/reset-password?token=${encodeURIComponent(token)}`,
        site.url
      ).toString()

      try {
        await sendPasswordResetEmail({
          name: user.name || 'User',
          email: user.email,
          resetLink,
        })
      } catch {
        console.error('Password reset email failed')
      }
    }

    return {
      success: true,
      message:
        'If an account exists for that email, a reset link has been sent.',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// RESET PASSWORD WITH TOKEN - PUBLIC
export async function resetPassword(values: IResetPassword) {
  try {
    const { token, newPassword } = ResetPasswordSchema.parse(values)

    await limitPasswordResetConfirm()

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const password = await bcrypt.hash(newPassword, 12)

    await connectToDatabase()

    // The filter makes the token single-use and time-limited.
    const user = await User.findOneAndUpdate(
      {
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      },
      {
        $set: {
          password,
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordChangedAt: new Date(),
        },
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    )

    if (!user)
      return {
        success: false,
        message: 'This reset link is invalid or has expired.',
      }

    return {
      success: true,
      message: 'Password reset successfully. You can now sign in.',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// DELETE USER - ADMIN
export async function deleteUser(id:string) {
  const session = await auth()
  if(session?.user.role !== "admin")
    throw new Error('Admin permission required')

  try {
    await connectToDatabase()

    if (id === session.user.id)
      return {
        success: false,
        message: 'You cannot delete your own account.',
      }

    const target = await User.findById(id).select('role')
    if (!target) throw new Error('User not found')

    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' })
      if (adminCount <= 1)
        return {
          success: false,
          message: 'You cannot delete the last admin account.',
        }
    }

    const res = await User.findByIdAndDelete(id)
    if (!res) throw new Error('User not found')

    await revalidateAllLocales('/admin/users');

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
    
    limit = clampLimit(limit, pageSize)
    
    const skipAmount = (clampPage(page) - 1) * limit

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
export async function updateUser(rawUser: IUserUpdate) {
  
  const validatedData = UserUpdateSchema.safeParse(rawUser);
    if (!validatedData.success) {
    return {
      success: false,
      message: "Invalid input provided.",
      // Provide detailed errors for the form to display
      errors: validatedData.error.flatten().fieldErrors,
    };
  }
  const user = validatedData.data
  const session = await auth()
    if(session?.user.role !== "admin")
      throw new Error('Admin permission required')
    
    if (user.role !== 'admin' && user._id === session.user.id) {
    await connectToDatabase()
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return { success: false, message: "You cannot demote the last admin account." };
    }
  }
  try {
    await connectToDatabase()      
    const normalizedEmail = normalizeEmail(user.email)  

    const emailTaken = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    })
      .collation({ locale: 'en', strength: 2 })
      .select('_id')

    if (emailTaken)
      return {
        success: false,
        message: 'This email is already in use by another account.',
      }

      const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      [
        {
          $set: {
            name: user.name, 
            email: normalizedEmail, 
            role: user.role, 
            tokenVersion: {
              $cond: {
                if: { $eq: ['$role', user.role] },
                then: { $ifNull: ['$tokenVersion', 0] },
                else: {
                  $add: [{ $ifNull: ['$tokenVersion', 0] }, 1],
                },
              },
            },
            emailVerified: {
              $cond: [
                { $ne: [user.emailVerified, null] },
                { $ifNull: ['$emailVerified', new Date()] },
                null,
              ],
            },
          }
        }
      ],
      { new: true }
    );
    if (!updatedUser) throw new Error('User not found')
  
    await revalidateAllLocales('/admin/users');

    const isAdminSelfDemoting = user._id.toString() === session.user.id && user.role !== session.user.role
    
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
    if (error.code === 11000 && error.keyPattern?.email) {
      return { success: false, message: 'This email is already in use by another account.' };
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
    return { success: false, message: 'Authentication required' }
  }

  const validatedFields = UserEmailSchema.safeParse(values)
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid data provided.' }
  }
  const { email, currentPassword } = validatedFields.data

  const normalizedEmail = normalizeEmail(email)

  try {   
    // 1. FIRST DEFENSE: Stop bots/spam by IP (No DB connection yet)
    await limitAuthActionsByIP();
    
    await connectToDatabase()

    const currentUser = await User.findById(userId)
      .select('name email +password')
      .lean()
    if (!currentUser) throw new Error('User not found')  

    if (normalizeEmail(currentUser.email) === normalizedEmail) {
      return { success: false, message: 'New email is the same as current email' };
    }

    // A stolen session must not be able to move the account to another
    // mailbox: require the current password before starting the change.
    if (!currentUser.password) {
      return {
        success: false,
        message:
          'This account does not use a password. Please contact support to change its email.',
      }
    }
    const passwordMatches = await bcrypt.compare(
      currentPassword,
      currentUser.password
    )
    if (!passwordMatches) {
      return { success: false, message: 'Current password is incorrect' }
    }

    // Do not reveal whether the address is taken, and never email an address
    // controlled by someone else.
    const existingUser = await User.findOne({ email: normalizedEmail })
      .collation({ locale: 'en', strength: 2 })
    if (existingUser && existingUser._id.toString() !== userId) {
      return {
        success: true,
        message: 'If this email can be used, a verification code has been sent.',
      };
    }

    await checkAndSetEmailRateLimit(normalizedEmail)

    const { token, hashedToken } = generateVerificationToken()

    // Keep the current email active until the new address proves ownership.
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pendingEmail: normalizedEmail,
          pendingEmailToken: hashedToken,
          pendingEmailExpires: new Date(Date.now() + EMAIL_EXPIRATION_TIME),
        },
      }
    )

    const verificationProps = {
      name: currentUser.name || 'User',
      email: normalizedEmail,
      token,
      update: true
    }

    await sendVerificationEmail(verificationProps)

    await revalidateAllLocales('/');

    return {
      success: true,
      message:
        'Check your new inbox to verify the address before it becomes active',
      data: { email: normalizedEmail },
    }

  } catch (error) {
    console.error('Error updating user email')
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again',
      data: { error: formatError(error) },  
    }
  }
}


// Verify Email OTP
export async function verifyEmailOtp(otp: string) {

    const session = await auth()
    if (!session) {
      throw new Error('User is not authenticated')
    }

    const userId = session.user.id
    if (!userId) {
      return { success: false, message: 'Authentication required' }
    }
  
if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    return { success: false, message: 'Invalid OTP format' };
  }

  try {
    // 1. CHECK AND INCREMENT IP ATTEMPT
    // This will throw an error if the IP is already locked out.
    await incrementIPEmailTokenAttempt();

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    await connectToDatabase();

    const user = await User.findById(userId)
      .select(
        'email emailVerified failedOtpAttempts otpLockedUntil' +
          ' +pendingEmail +pendingEmailToken +pendingEmailExpires' +
          ' +verificationToken +verificationTokenExpires'
      )
      .lean();

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Verified accounts with no pending email change have nothing to do.
    if (user.emailVerified && !user.pendingEmail) {
      return { success: false, message: 'Email is already verified' };
    }

    // Per-account lockout: the IP limiter alone can be bypassed with rotating
    // addresses, so count failures against the account as well.
    if (
      user.otpLockedUntil &&
      new Date(user.otpLockedUntil).getTime() > Date.now()
    ) {
      return {
        success: false,
        message: 'Too many invalid attempts. Please try again later.',
      };
    }

    const now = Date.now();
    const pendingEmail = user.pendingEmail;
    const pendingEmailValid =
      !!pendingEmail &&
      user.pendingEmailToken === hashedOtp &&
      !!user.pendingEmailExpires &&
      new Date(user.pendingEmailExpires).getTime() > now;
    const verificationValid =
      user.verificationToken === hashedOtp &&
      !!user.verificationTokenExpires &&
      new Date(user.verificationTokenExpires).getTime() > now;

    const recordFailedAttempt = async () => {
      const updated = await User.findByIdAndUpdate(
        userId,
        { $inc: { failedOtpAttempts: 1 } },
        { new: true, projection: { failedOtpAttempts: 1 } }
      ).lean();
      if ((updated?.failedOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
        await User.updateOne(
          { _id: userId },
          {
            $set: {
              otpLockedUntil: new Date(Date.now() + OTP_LOCKOUT_TIME),
              failedOtpAttempts: 0,
            },
          }
        );
      }
    };

    if (pendingEmailValid && pendingEmail) {
      // Swap the address only after the token matches (single use). Until this
      // point the old email stays active and the account is not locked out.
      const swapped = await User.findOneAndUpdate(
        {
          _id: userId,
          pendingEmailToken: hashedOtp,
          pendingEmailExpires: { $gt: new Date() },
        },
        {
          $set: {
            email: pendingEmail,
            emailVerified: new Date(),
            failedOtpAttempts: 0,
          },
          $unset: {
            pendingEmail: 1,
            pendingEmailToken: 1,
            pendingEmailExpires: 1,
            verificationToken: 1,
            verificationTokenExpires: 1,
            otpLockedUntil: 1,
          },
        },
        { new: true }
      );

      if (!swapped) {
        await recordFailedAttempt();
        return { success: false, message: 'Token is invalid or has expired' };
      }

      await revalidateAllLocales('/');
      await revalidateAllLocales('/account');
      await revalidateAllLocales('/checkout');
      await resetIPAttempt();

      return {
        success: true,
        message: 'Email updated and verified successfully!',
      };
    }

    if (verificationValid) {
      const verified = await User.findOneAndUpdate(
        {
          _id: userId,
          verificationToken: hashedOtp,
          verificationTokenExpires: { $gt: new Date() },
        },
        {
          $set: { emailVerified: new Date(), failedOtpAttempts: 0 },
          $unset: {
            verificationToken: 1,
            verificationTokenExpires: 1,
            otpLockedUntil: 1,
          },
        },
        { new: true }
      );

      if (!verified) {
        await recordFailedAttempt();
        return { success: false, message: 'Token is invalid or has expired' };
      }

      await revalidateAllLocales('/');
      await revalidateAllLocales('/account');
      await revalidateAllLocales('/checkout');
      await revalidateAllLocales('/Admin');

      await resetIPAttempt();

      return { success: true, message: 'Email verified successfully! You can now log in' };
    }

    await recordFailedAttempt();
    return { success: false, message: 'Token is invalid or has expired' };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// RESEND RESEND VERIFICATION EMAIL
export async function sendVerifyEmailAgain() {

  const session = await auth()
  if (!session) {
    throw new Error('User is not authenticated')
  }

  const { id: userId, name: userName } = session.user;
  if (!userId) {
    return { success: false, message:'User Data is Missing' };
  } 

   try {
    // 1. FIRST DEFENSE: Stop bots/spam by IP (No DB connection yet)
    await limitAuthActionsByIP();
    
    await connectToDatabase()
    
    const DBUser = await User.findById(userId)
      .select(
        'name email emailVerified +pendingEmail +pendingEmailToken +pendingEmailExpires'
      )
      .lean()
    if (!DBUser) {
      return { success: false, message: 'User not found' };
    }

    const pendingEmail = DBUser.pendingEmail

    // Enumeration-neutral: verified accounts have nothing to resend.
    if (!pendingEmail && DBUser.emailVerified) {
      return {
        success: true,
        message: 'If your email needs verification, a new code has been sent.',
      }
    }

    const targetEmail = pendingEmail || DBUser.email
    if (!targetEmail) {
      return { success: false, message: 'User Data is Missing' };
    }

    // Check the per-email limiter BEFORE sending.
    await checkAndSetEmailRateLimit(targetEmail)

    const { otp, hashedOtp } = await generateOtp()

    if (pendingEmail) {
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            pendingEmailToken: hashedOtp,
            pendingEmailExpires: new Date(Date.now() + EMAIL_EXPIRATION_TIME),
          },
        }
      )
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            verificationToken: hashedOtp,
            verificationTokenExpires: new Date(Date.now() + EMAIL_EXPIRATION_TIME),
          },
        }
      )
    }

    await sendVerificationEmail({
      name: DBUser.name || userName || 'User',
      email: targetEmail,
      token: otp,
      update: !!pendingEmail,
    })

    await revalidateAllLocales('/');
  
    return {
      success: true,
      message: 'If your email needs verification, a new code has been sent.',
    };

  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
