/** A class name, or a falsy value to skip it. */
export type ClassValue = string | false | null | undefined;

/**
 * Binds class names to a CSS module: names the module defines are mapped to their scoped names,
 * anything else (shared classes from global.css) passes through unchanged.
 */
export function createCx(styles: Readonly<Record<string, string>>) {
  return (...values: ClassValue[]): string =>
    values
      .flatMap((v) => (v ? v.split(/\s+/) : []))
      .filter(Boolean)
      .map((name) => styles[name] ?? name)
      .join(" ");
}
