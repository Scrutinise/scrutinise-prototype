import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-96px)] items-center justify-center bg-black">
      <SignUp />
    </div>
  );
}
