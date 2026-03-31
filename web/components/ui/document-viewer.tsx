"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Eye, ExternalLink, Loader2 } from "lucide-react";
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
  const [isMobile, setIsMobile] = useState(false);
  const [canRenderPdf, setCanRenderPdf] = useState(true);

  const colorClass = type === "resume"
    ? "bg-red-100 text-red-600"
    : "bg-blue-100 text-blue-600";

  // Detect mobile device and PDF support
  useEffect(() => {
    const checkDevice = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 640;

      // iOS Safari and some mobile browsers can't render PDFs in iframes
      const mobile = isIOS || isAndroid || (isTouchDevice && isSmallScreen);
      setIsMobile(mobile);

      // iOS specifically can't render PDFs in iframes
      if (isIOS) {
        setCanRenderPdf(false);
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  useEffect(() => {
    if (isOpen && !blobUrl && canRenderPdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [isOpen, blobUrl, path, canRenderPdf]);

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

  // On mobile devices that can't render PDFs, open directly in browser
  const handleViewClick = () => {
    if (!canRenderPdf) {
      window.open(downloadUrl, '_blank');
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted">
        <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm sm:text-base">{title}</p>
          <p className="text-xs text-muted-foreground">PDF Document</p>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleViewClick}
            title="View document"
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Download document"
          >
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] sm:h-[85vh] flex flex-col p-3 sm:p-6 gap-2 sm:gap-4">
          <DialogHeader className="flex-shrink-0">
            {/* pr-10 clears the Radix absolute close button (right-4 + ~24px wide) */}
            <div className="flex items-center gap-2 pr-10">
              <DialogTitle className="flex-1 text-base sm:text-lg truncate">{title}</DialogTitle>
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 px-2 sm:px-3">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline text-xs sm:text-sm">Open</span>
                  </Button>
                </a>
                <a href={downloadUrl} download>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9 px-2 sm:px-3">
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline text-xs sm:text-sm">Download</span>
                  </Button>
                </a>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex items-center justify-center rounded-lg border bg-muted/30 overflow-hidden">
            {loading && (
              <div className="flex flex-col items-center gap-3 text-muted-foreground p-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Loading document...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center gap-4 text-center p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <FileText className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Unable to preview PDF</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This PDF cannot be displayed in the viewer.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="gap-2 w-full sm:w-auto">
                      <ExternalLink className="h-4 w-4" />
                      Open in Browser
                    </Button>
                  </a>
                  <a href={downloadUrl} download>
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Mobile fallback view */}
            {isMobile && !loading && !error && !blobUrl && canRenderPdf && (
              <div className="flex flex-col items-center gap-4 text-center p-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-lg">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tap below to view or download this PDF
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="gap-2 w-full" size="lg">
                      <ExternalLink className="h-4 w-4" />
                      Open PDF
                    </Button>
                  </a>
                  <a href={downloadUrl} download className="w-full">
                    <Button variant="outline" className="gap-2 w-full" size="lg">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Desktop iframe view */}
            {blobUrl && !loading && !error && (
              <iframe
                src={blobUrl}
                className="w-full h-full rounded border-0 bg-white"
                title={title}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
