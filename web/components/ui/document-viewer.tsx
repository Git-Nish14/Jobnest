"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Eye, Maximize2, Loader2 } from "lucide-react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface DocumentViewerProps {
  path: string;
  downloadUrl: string;
  title: string;
  type: "resume" | "cover_letter";
}

export function DocumentViewer({ path, downloadUrl, title, type }: DocumentViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colorClass = type === "resume"
    ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
    : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400";

  useEffect(() => {
    if (isOpen && !blobUrl) {
      setLoading(true);
      setError(null);

      fetch(`/api/documents?path=${encodeURIComponent(path)}`, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load document");
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, blobUrl, path]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setError(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{title}</p>
          <p className="text-xs text-muted-foreground">PDF Document</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(true)}
            title="View document"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Download document"
          >
            <Button variant="ghost" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{title}</DialogTitle>
              <div className="flex items-center gap-2">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    <Maximize2 className="h-4 w-4" />
                    Open in new tab
                  </Button>
                </a>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {loading && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Loading document...</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center gap-2 text-destructive">
                <p>Failed to load document</p>
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    Open in new tab instead
                  </Button>
                </a>
              </div>
            )}
            {blobUrl && !loading && !error && (
              <iframe
                src={blobUrl}
                className="w-full h-full rounded-lg border"
                title={title}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
