'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {  useSearchParams } from 'next/navigation';
import { sendVerifyEmailAgain, verifyEmailToken } from '@/lib/actions/user.actions';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'


export default function VerifyClientToken() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const locale = useLocale();
  const { toast } = useToast()
  

  const [message, setMessage] = useState('Verifying your email...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidationEnded, setIsValidationEnded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const processedTokenRef = useRef<string | null>(null);

  
 
  useEffect(() => {
    

    if (!token) {
      setMessage('No verification token found - Please, check your email for the verification link');
      return;
    }   

    if (processedTokenRef.current === token) return;

    processedTokenRef.current = token;

    startTransition(async () => {
      const result = await verifyEmailToken(token);
      setMessage(result.message);
      setIsValidationEnded(true);
      if (result.success) {
        setIsSuccess(true);    
      }
    });
  }, [token]);

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
      <p className={isSuccess ? 'text-green-600' : 'text-red-600'}>
        {isPending ? 'Verifying...' : message}
      </p>
      
      {isValidationEnded && !isSuccess && (
        <Button 
        onClick={handleVerifyEmailAgain} 
        disabled={isPending}
        className="mt-4 inline-block text-blue-500 hover:underline">
          Send Verification Email Again
        </Button>
      )}
      {isSuccess && (
        <Link href={`/${locale}/`} className="mt-4 inline-block text-blue-500 hover:underline">
          Home Page
        </Link>
      )}
    </div>
  );
}
