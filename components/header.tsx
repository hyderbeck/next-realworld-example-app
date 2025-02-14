import Link from "next/link";
import Nav from "./nav";
import Login from "./login";
import { createClient } from "@/supabase";
import { cookies } from "next/headers";
import { z } from "zod";
import { usernameExists } from "@/utils";
import { revalidatePath } from "next/cache";

async function signUp(formData: FormData) {
  "use server";

  const supabase = createClient(cookies());

  const User = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    username: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9]+$/),
  });

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  if (!User.safeParse({ email, password, username }).success) return;

  if (await usernameExists(supabase, username)) return "Username already taken";

  const {
    data: { user },
    error,
  } = await supabase.auth.signUp({
    email,
    password,
  });

  if (!error) {
    await supabase.schema("conduit").from("profiles").insert({
      username,
      email,
      user_id: user!.id,
    });
    revalidatePath("/", "layout");
    return "signed up";
  }

  if (error.message === "User already registered")
    return "Email already registered";
}

async function logIn(formData: FormData) {
  "use server";

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await createClient(cookies()).auth.signInWithPassword({
    email,
    password,
  });

  if (!error) {
    revalidatePath("/", "layout");
    return "logged in";
  }

  if (error.message === "Invalid login credentials")
    return "Invalid credentials";
}

async function logOut() {
  "use server";

  await createClient(cookies()).auth.signOut();
  revalidatePath("/", "layout");
}

export default async function Header() {
  const supabase = createClient(cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const username = user
    ? (
        await supabase
          .schema("conduit")
          .from("profiles")
          .select()
          .eq("user_id", user.id)
          .single()
      ).data!.username
    : undefined;

  return (
    <header>
      <div className="px-6 py-4 flex justify-between items-center max-w-screen-lg mx-auto">
        <h1>
          <Link href="/" className="text-emerald-300 text-xl font-black">
            conduit
          </Link>
        </h1>
        {username ? (
          <Nav username={username} logOut={logOut} />
        ) : (
          <Login signUp={signUp} logIn={logIn} />
        )}
      </div>
    </header>
  );
}
