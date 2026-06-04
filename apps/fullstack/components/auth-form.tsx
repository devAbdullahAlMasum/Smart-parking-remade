"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message || "Authentication failed");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-base-300 px-4 py-10 text-base-content">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="card w-full border border-base-content/10 bg-base-100 shadow-2xl">
          <div className="card-body gap-6">
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-primary">Smart Parking</div>
              <h1 className="mt-2 text-3xl font-bold">{isSignUp ? "Create account" : "Sign in"}</h1>
              <p className="mt-2 text-sm text-base-content/60">
                {isSignUp ? "Create a dashboard account with email and password." : "Use your dashboard account to manage the parking system."}
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {isSignUp ? (
                <label className="form-control gap-2">
                  <span className="label-text">Name</span>
                  <input className="input input-bordered" value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
              ) : null}

              <label className="form-control gap-2">
                <span className="label-text">Email</span>
                <input className="input input-bordered" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>

              <label className="form-control gap-2">
                <span className="label-text">Password</span>
                <input className="input input-bordered" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>

              {error ? <div className="alert alert-error py-3 text-sm">{error}</div> : null}

              <button className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner" /> : null}
                {isSignUp ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="text-center text-sm text-base-content/60">
              {isSignUp ? "Already have an account?" : "Need an account?"} {" "}
              <Link className="link link-primary" href={isSignUp ? "/sign-in" : "/sign-up"}>
                {isSignUp ? "Sign in" : "Sign up"}
              </Link>
            </div>

            <Link href="/" className="btn btn-ghost btn-sm">
              Back to display
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
