/** Same shape as the English source, every leaf a string. Missing keys fail the type check. */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };
