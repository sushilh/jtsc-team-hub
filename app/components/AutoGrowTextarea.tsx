"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export default function AutoGrowTextarea({ style, value, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (field.current) { field.current.style.height = "auto"; field.current.style.height = `${Math.min(560, field.current.scrollHeight)}px`; }
  }, [value]);
  return <textarea className={`resize-none ${className || ""}`} {...props} ref={field} value={value} style={{ ...style, resize: "none", maxHeight: 560, overflowY: "auto" }} />;
}
