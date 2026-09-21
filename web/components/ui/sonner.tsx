"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <div role="status" aria-live="polite" aria-atomic="false" aria-label="Notifications">
      <Sonner
        theme="system"
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            // Success: light = soft sage green, dark = deep emerald
            success:
              "!bg-green-50 !border-green-300 !text-green-800 dark:!bg-emerald-950 dark:!border-emerald-700 dark:!text-emerald-300",
            // Error: light = soft red, dark = deep red
            error:
              "!bg-red-50 !border-red-300 !text-red-700 dark:!bg-red-950 dark:!border-red-800 dark:!text-red-300",
            // Warning: light = soft amber, dark = deep amber
            warning:
              "!bg-amber-50 !border-amber-300 !text-amber-800 dark:!bg-amber-950 dark:!border-amber-700 dark:!text-amber-300",
            // Info: light = soft blue, dark = deep blue
            info:
              "!bg-blue-50 !border-blue-300 !text-blue-700 dark:!bg-blue-950 dark:!border-blue-700 dark:!text-blue-300",
          },
        }}
        {...props}
      />
    </div>
  );
};

export { Toaster };
