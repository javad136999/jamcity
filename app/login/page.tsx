import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { Spinner } from "@/components/Feedback";

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner label="در حال بارگذاری..." />}>
      <LoginForm />
    </Suspense>
  );
}
