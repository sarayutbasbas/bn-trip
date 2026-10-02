"use client";

import { useState } from "react";

export function twoLineTripName(value: string) {
  const [first, ...rest] = value.replace(/\r\n?/g, "\n").split("\n");
  return rest.length ? `${first}\n${rest.join(" ")}` : first;
}

export function TripNameInput({defaultValue = "", value, onChange, placeholder}: {
  defaultValue?: string; value?: string; onChange?: (value: string) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState(defaultValue);
  return <textarea name="name" aria-label="ชื่อทริป" className="trip-name-input" rows={2} required maxLength={160}
    value={value ?? draft} placeholder={placeholder}
    onChange={event => {const next = twoLineTripName(event.target.value);setDraft(next);onChange?.(next)}}
    onKeyDown={event => {if(event.key === "Enter" && event.currentTarget.value.includes("\n") && event.currentTarget.selectionStart === event.currentTarget.selectionEnd)event.preventDefault()}} />;
}
