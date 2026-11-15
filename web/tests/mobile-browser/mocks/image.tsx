import type { ImgHTMLAttributes } from "react";

export default function Image({ priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
  void priority;
  // Keep the real image box without requesting Next's image optimizer.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
}
