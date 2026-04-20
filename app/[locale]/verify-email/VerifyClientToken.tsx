'use client';

// Frontend component: VerifyClientOtp.tsx (renamed for clarity, place at /verify-email or similar route)

import { useState, useTransition } from 'react';
import { sendVerifyEmailAgain, verifyEmailOtp } from '@/lib/actions/user.actions';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Assuming you have Shadcn UI Input
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';



export default function VerifyClientOtp() {
  const locale = useLocale();
  const { toast } = useToast();
  const { update , data } = useSession();
  const router = useRouter()

  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('Enter the 6-digit code sent to your email.');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidationEnded, setIsValidationEnded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        variant: 'destructive',
        description: 'Please enter a valid 6-digit OTP',
      });
      return;
    }

    startTransition(async () => {
      const result = await verifyEmailOtp(otp);
      if (result.success) {
        setMessage('Email verified successfully. You can now proceed.');
        setIsSuccess(true);
        setIsValidationEnded(true);
        console.log('iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii', data);
        await update({ id: data?.user?.id }); // Update session to reflect verified status
        router.push(`/${locale}/`);
      } else {
        setIsValidationEnded(true);
        toast({
          variant: 'destructive',
          description: result.message,
        });
        setMessage(result.message);
      }
    });
  };

  const handleVerifyEmailAgain = async () => {
    startTransition(async () => {      
      const result = await sendVerifyEmailAgain();      
      if (result.success) {
        setMessage('Verification email sent successfully. Please check your inbox.');
      } else {
          toast({
            variant: 'destructive',
            description: result.message,
          });
          console.log('Email is already verified - updating session');
          // const emailVerified = data?.user?.emailVerified;
          // await update(emailVerified);   // null
          // console.log('Email is already verified - after updating session');
          await update({ id: data?.user?.id });   // string
          console.log('Email is already verified - after updating session again');
          setMessage(result.message);
          // useRouter().push(`/${locale}/`); // Redirect to home page    
          router.push(`/${locale}/`); // Redirect to home page      
        } 
      }); 
  };

  return (
    <div className="p-8 border rounded-lg shadow-md flex flex-col gap-4">
      <h1 className="text-2xl font-bold mb-4">Email Verification</h1>
      <p className={isSuccess ? 'text-green-600' : 'text-red-600'}>
        {isPending ? 'Processing...' : message}
      </p>
      <Input
        type="number"
        placeholder="Enter 6-digit OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        maxLength={6}
        className="mt-4"
        disabled={isPending || isSuccess}
      />
      <Button
        onClick={handleVerifyOtp}
        disabled={isPending || isSuccess || otp.length !== 6}
        className="mt-4 bg-green-200 hover:bg-green-300 text-black"
      >
        Verify OTP
      </Button>
      <Button
        onClick={handleVerifyEmailAgain}
        disabled={isPending || isSuccess}
        className="mt-4 bg-blue-200 hover:bg-blue-300 text-black"
      >
        Resend Verification Email
      </Button>
      {(isSuccess || isValidationEnded) && (
        <Link href={`/${locale}/`} className="mt-4 inline-block text-black hover:underline">
          Home Page
        </Link>
      )}
    </div>
  );
}
/*
import {  useRef, useState, useTransition } from 'react';
import {  useSearchParams } from 'next/navigation';
import { sendVerifyEmailAgain, verifyEmailToken } from '@/lib/actions/user.actions';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react';


export default function VerifyClientToken() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { toast } = useToast()
  const { update } = useSession();
  
  
 
  const [message, setMessage] = useState('Verifying your email, please wait...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidationEnded, setIsValidationEnded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const processedTokenRef = useRef<string | null>(null);

   const handleVerifyToken = async () => { 
     const token = searchParams.get('token');
    console.log('VerifyClientToken token =========================', token)
      if (!token) {
      setMessage('No verification token found - Please, check your email for the verification link');
      return;
    }   

    if (processedTokenRef.current === token) return;

    processedTokenRef.current = token;

    console.log('VerifyClientToken processedTokenRef.current ========================= Passed')
    startTransition(async () => {
      console.log('VerifyClientToken processedTokenRef.current ========================= START TRANSITION')
      const result = await verifyEmailToken(token);
      console.log('VerifyClientToken processedTokenRef.current ========================= START TRANSITION result', result )
      if (result.success) {
        setMessage('Email verified successfully. You can now log in.');
        setIsSuccess(true);
        setIsValidationEnded(true);
        await update(); // update the session to reflect the emailVerified status
      } else {
        setIsValidationEnded(true);
        toast({
          variant: 'destructive',
          description: result.message,
        });
        setMessage(result.message);       
      }  
    });
  
  };

  const handleVerifyEmailAgain = async () => { 


    startTransition(async () => {

      const result = await sendVerifyEmailAgain();
      if (result.success) {
        setMessage('Verification email sent successfully. Please check your inbox');
      } else {
          toast({
          variant: 'destructive',
          description: result.message,
        });
        setMessage(result.message);       
      }
    });
  
  };


  return (
    <div className="p-8 border rounded-lg shadow-md flex-col gap-4">
      <h1 className="text-2xl font-bold mb-4">Email Verification</h1>
      <div className="flex flex-col items-center">
        { isPending ?  
            <p className={'text-green-600' }>
                {message}
              </p>       
          :
            <Button 
            onClick={handleVerifyToken} 
            disabled={isPending || isSuccess}
            className="mt-4 inline-block text-black  bg-green-200 hover:bg-green-600">
              click to Verify Email
            </Button>
        }      
     
        <Button 
        onClick={handleVerifyEmailAgain} 
        disabled={isPending || isSuccess}
        className="mt-4 inline-block text-black  bg-blue-200 hover:bg-blue-600">
          Send Verification Email Again
        </Button>
     
    
        {(isSuccess || isValidationEnded) && (
          <Link href={`/${locale}/`} className="mt-4 inline-block text-black ">
            Home Page
          </Link>
        )}
     </div>
    </div>
  );
}
*/