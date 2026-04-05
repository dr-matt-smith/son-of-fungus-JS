/**
 * Shared pure functions used by both engine.js and the standalone build runtime.
 * No imports — these are dependency-free utility functions.
 */

/**
 * Coerce a value to the given variable type.
 */
export function coerceToType(val, varType) {
  if (varType === 'Integer') return parseInt(val, 10) || 0;
  if (varType === 'Float')   return parseFloat(val) || 0;
  if (varType === 'Boolean') return val === true || val === 'true';
  return String(val ?? '');
}

/**
 * Evaluate a single condition against a variables array.
 * @param {Object} cond - condition with variableName, operator, compareType, compareValue, compareVarName
 * @param {Array} variables - array of { name, type, value } objects
 */
export function evaluateOneCondition(cond, variables) {
  const v = variables.find(x => x.name === cond.variableName);
  const varType = v ? v.type : 'String';
  const leftVal = v ? coerceToType(v.value, varType) : undefined;

  let rightVal;
  if (cond.compareType === 'variable') {
    const rv = variables.find(x => x.name === cond.compareVarName);
    rightVal = rv ? coerceToType(rv.value, varType) : undefined;
  } else {
    rightVal = coerceToType(cond.compareValue, varType);
  }

  switch (cond.operator) {
    case '==': return leftVal == rightVal;
    case '!=': return leftVal != rightVal;
    case '<':  return leftVal < rightVal;
    case '<=': return leftVal <= rightVal;
    case '>':  return leftVal > rightVal;
    case '>=': return leftVal >= rightVal;
    default:   return false;
  }
}

/**
 * Evaluate a full condition (with optional AND/OR extra conditions).
 */
export function evaluateCondition(cmd, variables) {
  let result = evaluateOneCondition(cmd, variables);
  if (cmd.extraConditions) {
    for (const ec of cmd.extraConditions) {
      const ecResult = evaluateOneCondition(ec, variables);
      if (ec.logic === 'OR') result = result || ecResult;
      else result = result && ecResult;
    }
  }
  return result;
}

/**
 * Build a human-readable summary of a condition.
 */
export function conditionSummary(cmd) {
  let s = `${cmd.variableName} ${cmd.operator} ${cmd.compareType === 'variable' ? cmd.compareVarName : cmd.compareValue}`;
  if (cmd.extraConditions) {
    for (const ec of cmd.extraConditions) {
      s += ` ${ec.logic} ${ec.variableName} ${ec.operator} ${ec.compareType === 'variable' ? ec.compareVarName : ec.compareValue}`;
    }
  }
  return s;
}

/**
 * Substitute {$varName} placeholders in text with variable values.
 */
export function substituteVars(text, variables) {
  return text.replace(/\{\$(\w+)\}/g, (_, name) => {
    const v = variables.find(x => x.name === name);
    return v ? String(v.value) : `{$${name}}`;
  });
}
