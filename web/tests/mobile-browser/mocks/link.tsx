import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./navigation";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  prefetch?: boolean;
  scroll?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, onClick, prefetch, scroll, ...props }, ref,
) {
  void prefetch;
  void scroll;
  return <a {...props} ref={ref} href={href} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && !props.target && href.startsWith("/")) {
      event.preventDefault();
      navigate(href);
    }
  }} />;
});

export default Link;
