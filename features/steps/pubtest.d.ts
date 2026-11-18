// pubtest is JavaScript without types: what the suite uses of it.
declare module "@sustenaut/pubtest" {
  export class Answer {
    constructor(status: number, headers: Record<string, string>, text: string);
    status: number;
    text: string;
  }
  export class Result {
    constructor(fields?: { value?: unknown });
  }
  export function register(api: unknown, options?: { client?: (world: any) => unknown }): void;
}
