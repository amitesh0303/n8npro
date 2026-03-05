"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLLMClient = registerLLMClient;
exports.createLLMClient = createLLMClient;
exports.listRegisteredProviders = listRegisteredProviders;
const registry = new Map();
function registerLLMClient(provider, factory) {
    registry.set(provider, factory);
}
function createLLMClient(provider, config) {
    const factory = registry.get(provider);
    if (!factory) {
        throw new Error(`No LLM client registered for provider "${provider}"`);
    }
    return factory(config);
}
function listRegisteredProviders() {
    return Array.from(registry.keys());
}
//# sourceMappingURL=llmRegistry.js.map