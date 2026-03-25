import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { ApiResponse } from "@/types";

interface User {
  id: string;
  email: string | undefined;
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    if (!user) {
      return {
        data: null,
        error: { message: "Not authenticated" },
      };
    }

    return {
      data: { id: user.id, email: user.email },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: { message: "Failed to get current user" },
    };
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<ApiResponse<User>> {
  try {
    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return {
      data: { id: data.user.id, email: data.user.email },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: { message: "Failed to sign in" },
    };
  }
}

export async function signUp(
  email: string,
  password: string
): Promise<ApiResponse<{ message: string }>> {
  try {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return {
      data: { message: "Check your email to confirm your account" },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: { message: "Failed to sign up" },
    };
  }
}

export async function signOut(): Promise<ApiResponse<null>> {
  try {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: null, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to sign out" },
    };
  }
}
