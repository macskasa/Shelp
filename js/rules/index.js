// Part A – the rule checker (story D2). Owner: Stephen. Pure logic: no screens, no init.
// v1 (checkStack, checkPlan) stays until Bruce's map has moved to schema 2, then it is deleted.
// v2 (checkStack2, checkPlan2) has severity 'block' | 'warn'; the Data screen shows checkPlan2().
export { checkStack, checkPlan, RULES } from './check.js';
export { checkStack2, checkPlan2, RULES2, SEVERITY, blocking, forStack, groupWarnings, boardLine } from './check2.js';
