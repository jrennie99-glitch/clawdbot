# Cost Optimization Guide

> Strategies for managing LLM costs in SUPER SUPREME GOD MODE

## Budget Configuration

### Environment Variables

```bash
# Daily limit in USD (default: $10)
DAILY_COST_LIMIT_USD=10

# Per-run limit in USD (default: $1)
PER_RUN_COST_LIMIT_USD=1

# Token limit per run (default: 100k)
TOKENS_PER_RUN_LIMIT=100000

# Tool call limit per run (default: 100)
TOOL_CALLS_PER_RUN_LIMIT=100
```

## Cost-Saving Strategies

### 1. Model Selection

Use appropriate model tiers:

| Task | Recommended Tier | Cost |
|------|-----------------|------|
| Complex reasoning | SMART | $$$ |
| General tasks | FAST | $$ |
| Simple queries | CHEAP | $ |
| Large documents | LONG_CONTEXT | $$ |
| Local development | LOCAL | FREE |

### 2. Prompt Compaction

- Summarize long contexts before sending
- Remove redundant information
- Use structured formats (JSON) for efficiency

### 3. Response Caching

Cache responses for identical queries:

```typescript
import { shouldUseCache } from './security/cost-controls.js';

if (shouldUseCache()) {
  // Check cache first
}
```

### 4. Tool Call Batching

Batch related tool calls together:

```typescript
// Instead of:
await read('file1.txt');
await read('file2.txt');
await read('file3.txt');

// Use:
await readMultiple(['file1.txt', 'file2.txt', 'file3.txt']);
```

### 5. Early Stopping

Stop streaming when answer is sufficient:

```typescript
if (hasCompleteAnswer(response)) {
  stream.abort();
}
```

### 6. Graceful Degradation

Automatically downgrade models when budget is low:

```typescript
import { getBudgetBasedTier } from './security/cost-controls.js';

const tier = getBudgetBasedTier();
// Returns 'smart', 'fast', or 'cheap' based on remaining budget
```

## Monitoring

### Check Budget Status

```typescript
import { checkBudgetStatus, getUsage } from './security/cost-controls.js';

const status = checkBudgetStatus();
console.log('Daily remaining:', status.dailyRemaining);
console.log('Warnings:', status.warnings);

const usage = getUsage();
console.log('Tokens used:', usage.tokensUsed);
console.log('Daily cost:', usage.dailyUsageUsd);
```

### Get Optimization Suggestions

```typescript
import { getOptimizationSuggestions } from './security/cost-controls.js';

const suggestions = getOptimizationSuggestions();
for (const s of suggestions) {
  console.log(s.type, '-', s.description);
}
```

## Model Costs (per million tokens)

| Model | Input | Output | Provider |
|-------|-------|--------|----------|
| deepseek-reasoner | $2.00 | $2.00 | OpenRouter |
| qwen-2.5-72b | $0.90 | $0.90 | OpenRouter |
| llama-3.1-70b | $0.80 | $0.80 | OpenRouter |
| mixtral-8x22b | $0.65 | $0.65 | OpenRouter |
| yi-1.5-34b | $0.30 | $0.30 | OpenRouter |
| yi-1.5-9b | $0.10 | $0.10 | OpenRouter |
| kimi-k2.5 | $0.50 | $0.50 | Moonshot |
| local models | FREE | FREE | Ollama/vLLM |
| claude-3.5-sonnet | $15.00 | $15.00 | Anthropic (OPTIONAL) |

## Best Practices

1. **Start with CHEAP tier** for development/testing
2. **Use LOCAL models** when possible for iteration
3. **Monitor daily usage** via `getUsage()`
4. **Set conservative limits** initially, increase as needed
5. **Enable caching** for repetitive queries
6. **Batch operations** to reduce overhead
