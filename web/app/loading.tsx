import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-14 sm:h-16 border-b bg-white flex items-center px-4 sm:px-8">
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-3xl space-y-6 text-center">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <div className="flex gap-3 justify-center mt-4">
            <Skeleton className="h-11 w-36 rounded-lg" />
            <Skeleton className="h-11 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
