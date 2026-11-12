import { useSyncExternalStore } from "react";

type Gender = "female" | "male";

const KEY = "recuidado:patient-gender";
const EVENT = "recuidado:patient-gender";

/** Words that change with the patient's gender, as the family screens use them. */
export function pronouns(gender: Gender | null | undefined) {
  const he = gender === "male";
  return {
    ela: he ? "ele" : "ela",
    Ela: he ? "Ele" : "Ela",
    dela: he ? "dele" : "dela",
    a: he ? "o" : "a",
  };
}

/** Called by getFamily: remembers the patient's gender for screens that do not load the family. */
export function rememberGender(gender: Gender | null | undefined) {
  if (gender !== "female" && gender !== "male") return;
  try {
    if (localStorage.getItem(KEY) === gender) return;
    localStorage.setItem(KEY, gender);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

function read(): Gender {
  try {
    return localStorage.getItem(KEY) === "male" ? "male" : "female";
  } catch {
    return "female";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Pronouns for the patient on screens without the family loaded ("ela" until it is known). */
export function usePronouns() {
  const gender = useSyncExternalStore(subscribe, read, () => "female" as Gender);
  return pronouns(gender);
}
