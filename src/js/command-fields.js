/**
 * Command field rendering — thin wrapper that re-exports from the registry
 * and field-builders modules.
 *
 * Existing imports from this file (renderCommandFields, labeledSelect,
 * labeledInput, labeledCheckbox, createInput, initCommandFieldCallbacks)
 * continue to work unchanged.
 */

export { renderCommandFields } from './command-registry.js';

export {
  labeledInput,
  labeledSelect,
  labeledCheckbox,
  createInput,
  initFieldBuilderCallbacks as initCommandFieldCallbacks,
} from './field-builders.js';
