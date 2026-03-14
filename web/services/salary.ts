import { createClient } from "@/lib/supabase/server";
import type {
  SalaryDetails,
  SalaryDetailsInsert,
  SalaryDetailsUpdate,
  ApiResponse,
} from "@/types";

export async function getSalaryDetails(
  applicationId: string
): Promise<ApiResponse<SalaryDetails | null>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("salary_details")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as SalaryDetails | null, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch salary details" },
    };
  }
}

export async function getAllSalaryDetails(): Promise<ApiResponse<(SalaryDetails & { job_applications: { company: string; position: string; status: string } })[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("salary_details")
      .select("*, job_applications(company, position, status)")
      .order("final_offer", { ascending: false, nullsFirst: false });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as any, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch salary details" },
    };
  }
}

export async function createSalaryDetails(
  salary: SalaryDetailsInsert
): Promise<ApiResponse<SalaryDetails>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("salary_details")
      .insert(salary)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as SalaryDetails, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to create salary details" },
    };
  }
}

export async function updateSalaryDetails(
  applicationId: string,
  updates: SalaryDetailsUpdate
): Promise<ApiResponse<SalaryDetails>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("salary_details")
      .update(updates)
      .eq("application_id", applicationId)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as SalaryDetails, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to update salary details" },
    };
  }
}

export async function upsertSalaryDetails(
  salary: SalaryDetailsInsert
): Promise<ApiResponse<SalaryDetails>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("salary_details")
      .upsert(salary, { onConflict: "application_id" })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as SalaryDetails, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to save salary details" },
    };
  }
}

export async function deleteSalaryDetails(
  applicationId: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("salary_details")
      .delete()
      .eq("application_id", applicationId);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to delete salary details" },
    };
  }
}

// Helper functions for salary comparison
export function formatSalary(amount: number | null, currency = "USD"): string {
  if (!amount) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateTotalCompensation(salary: SalaryDetails): number {
  let total = salary.base_salary || 0;
  total += salary.bonus || 0;
  total += salary.signing_bonus || 0;
  return total;
}

export function compareSalaries(
  salaries: SalaryDetails[]
): { highest: SalaryDetails | null; average: number } {
  if (salaries.length === 0) {
    return { highest: null, average: 0 };
  }

  const withTotals = salaries.map((s) => ({
    ...s,
    total: calculateTotalCompensation(s),
  }));

  const highest = withTotals.reduce((max, s) =>
    s.total > (max?.total || 0) ? s : max
  );

  const average =
    withTotals.reduce((sum, s) => sum + s.total, 0) / withTotals.length;

  return { highest, average };
}
