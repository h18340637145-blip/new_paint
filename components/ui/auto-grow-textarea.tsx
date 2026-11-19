"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

export interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeightPx?: number;
}

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  function AutoGrowTextarea({ value, minHeightPx = 120, style, className = "", onChange, ...rest }, forwardedRef) {
    const innerRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const adjustHeight = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.max(minHeightPx, el.scrollHeight);
      el.style.height = `${next}px`;
    }, [minHeightPx]);

    useLayoutEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    return (
      <textarea
        {...rest}
        ref={innerRef}
        value={value}
        onChange={(e) => {
          adjustHeight();
          onChange?.(e);
        }}
        style={{
          ...style,
          minHeight: `${minHeightPx}px`,
          overflowY: "hidden",
          resize: "none",
        }}
        className={className}
      />
    );
  },
);
