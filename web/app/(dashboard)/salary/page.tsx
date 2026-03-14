import Link from "next/link";
import { DollarSign, TrendingUp, Building, Award } from "lucide-react";
import { getAllSalaryDetails, formatSalary, calculateTotalCompensation } from "@/services";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SalaryComparisonPage() {
  const { data: salaryData } = await getAllSalaryDetails();

  const offers = (salaryData || []).filter(
    (s) => s.job_applications?.status === "Offer"
  );

  const allWithSalary = salaryData || [];

  // Calculate stats
  const totalOffers = offers.length;
  const highestOffer = offers.reduce((max, s) => {
    const total = calculateTotalCompensation(s);
    const maxTotal = max ? calculateTotalCompensation(max) : 0;
    return total > maxTotal ? s : max;
  }, null as (typeof offers)[0] | null);

  const averageSalary =
    offers.length > 0
      ? offers.reduce((sum, s) => sum + (s.base_salary || 0), 0) / offers.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salary Comparison</h1>
        <p className="text-muted-foreground">
          Compare and track offers across your applications
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Total Offers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalOffers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Highest Offer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {highestOffer
                ? formatSalary(calculateTotalCompensation(highestOffer))
                : "N/A"}
            </p>
            {highestOffer && (
              <p className="text-sm text-muted-foreground">
                {highestOffer.job_applications?.company}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Average Base Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {averageSalary > 0 ? formatSalary(averageSalary) : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" />
              Applications with Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{allWithSalary.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Offers Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Offer Comparison</CardTitle>
          <CardDescription>
            Compare compensation packages across your offers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offers with salary data yet</p>
              <p className="text-sm mt-1">
                Add salary details to your applications to compare them here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Position</th>
                    <th className="text-right py-3 px-4 font-medium">Base Salary</th>
                    <th className="text-right py-3 px-4 font-medium">Bonus</th>
                    <th className="text-right py-3 px-4 font-medium">Signing</th>
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-center py-3 px-4 font-medium">Benefits</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr key={offer.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <Link
                          href={`/applications/${offer.application_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {offer.job_applications?.company}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {offer.job_applications?.position}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatSalary(offer.base_salary)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatSalary(offer.bonus)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatSalary(offer.signing_bonus)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-green-600">
                        {formatSalary(calculateTotalCompensation(offer))}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-1">
                          {offer.health_insurance && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                              Health
                            </span>
                          )}
                          {offer.retirement_401k && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              401k
                            </span>
                          )}
                          {offer.pto_days && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                              {offer.pto_days}d PTO
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Salary Data */}
      {allWithSalary.length > 0 && allWithSalary.length !== offers.length && (
        <Card>
          <CardHeader>
            <CardTitle>All Salary Information</CardTitle>
            <CardDescription>
              Salary data from all applications (including non-offers)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allWithSalary.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <Link
                      href={`/applications/${item.application_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.job_applications?.company}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {item.job_applications?.position}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatSalary(item.base_salary)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.job_applications?.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
