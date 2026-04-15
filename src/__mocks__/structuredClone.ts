// Use Node.js built-in structuredClone (available since Node 17).
export default structuredClone as (val: unknown) => unknown;
