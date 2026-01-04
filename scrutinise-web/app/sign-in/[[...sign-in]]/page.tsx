import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-96px)] items-center justify-center bg-black">
      <SignIn />
    </div>
  );
}
