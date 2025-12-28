import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { SpecLoader } from '../core/spec-loader.js';

interface PlanOptions {
  output?: string;
}

export async function planCommand(options: PlanOptions): Promise<void> {
  const spinner = ora('Generating implementation plan...').start();

  try {
    const loader = new SpecLoader();
    const spec = await loader.load();

    const outputPath = options.output || 'docs/plan.md';

    // Generate plan document
    const plan = generatePlan(spec);

    // Write plan
    await fs.mkdir(path.dirname(path.join(process.cwd(), outputPath)), { recursive: true });
    await fs.writeFile(path.join(process.cwd(), outputPath), plan);

    spinner.succeed(chalk.green(`Implementation plan generated: ${outputPath}`));
  } catch (error) {
    spinner.fail(chalk.red('Plan generation failed'));
    console.error(error);
    process.exit(1);
  }
}

function generatePlan(spec: ReturnType<typeof SpecLoader.prototype.load> extends Promise<infer T> ? T : never): string {
  const entityCount = Object.keys(spec.entities).length;
  const actionCount = Object.keys(spec.actions).length;
  const flowCount = Object.keys(spec.flows).length;
  const screenCount = Object.keys(spec.ui.screens || {}).length;
  const jobCount = Object.keys(spec.jobs.jobs || {}).length;

  let plan = `# Implementation Plan

Generated for: **${spec.product.name}** v${spec.product.version}
Generated at: ${new Date().toISOString()}

## Overview

This document outlines the implementation plan based on the Product Spec Language (PSL) files.

| Component | Count |
|-----------|-------|
| Entities  | ${entityCount} |
| Actions   | ${actionCount} |
| Flows     | ${flowCount} |
| Screens   | ${screenCount} |
| Jobs      | ${jobCount} |

---

## Database Schema

The following tables will be generated:

`;

  for (const [name, entity] of Object.entries(spec.entities)) {
    const fieldCount = Object.keys(entity.fields).length;
    plan += `### ${name}\n\n`;
    plan += `${entity.description || 'No description'}\n\n`;
    plan += `- **Fields:** ${fieldCount}\n`;
    plan += `- **Tenant Scoped:** ${entity.tenant_scoped !== false ? 'Yes' : 'No'}\n`;
    plan += `- **Auditable:** ${entity.auditable !== false ? 'Yes' : 'No'}\n`;
    plan += `- **Immutable:** ${entity.immutable ? 'Yes' : 'No'}\n`;
    if (entity.ai_suggest_only) {
      plan += `- **AI Rules:** Suggest only (requires human approval)\n`;
    }
    plan += '\n';
  }

  plan += `---

## API Actions

The following API endpoints will be generated:

| Action | Type | Entity | Auth Required |
|--------|------|--------|---------------|
`;

  for (const [name, action] of Object.entries(spec.actions)) {
    const authRequired = action.auth?.required !== false ? 'Yes' : 'No';
    plan += `| ${name} | ${action.type} | ${action.entity || '-'} | ${authRequired} |\n`;
  }

  plan += `\n---

## User Flows

The following user flows will be generated:

`;

  for (const [name, flow] of Object.entries(spec.flows)) {
    const stepCount = Object.keys(flow.steps).length;
    plan += `### ${flow.name}\n\n`;
    plan += `${flow.description || 'No description'}\n\n`;
    plan += `- **Entry Point:** ${flow.entry_point ? 'Yes' : 'No'}\n`;
    plan += `- **Steps:** ${stepCount}\n\n`;

    plan += `Flow diagram:\n\`\`\`\n`;
    for (const [stepName, step] of Object.entries(flow.steps)) {
      plan += `[${stepName}] -> ${step.screen}\n`;
      for (const [transName, trans] of Object.entries(step.transitions || {})) {
        plan += `  --${transName}--> [${trans.target}]\n`;
      }
    }
    plan += `\`\`\`\n\n`;
  }

  if (jobCount > 0) {
    plan += `---

## Background Jobs

The following background jobs will be generated:

| Job | Queue | Retry Attempts | Cron |
|-----|-------|----------------|------|
`;

    for (const [name, job] of Object.entries(spec.jobs.jobs || {})) {
      plan += `| ${name} | ${job.queue || 'default'} | ${job.retry?.attempts || 3} | ${job.cron || '-'} |\n`;
    }
  }

  plan += `\n---

## Security & Policies

### Roles

`;

  for (const [name, role] of Object.entries(spec.policies.roles || {})) {
    plan += `- **${name}**: ${role.description || 'No description'}\n`;
    if (role.inherits) {
      plan += `  - Inherits: ${role.inherits.join(', ')}\n`;
    }
    if (role.can) {
      plan += `  - Actions: ${role.can.length} allowed\n`;
    }
  }

  if (spec.policies.ai_rules) {
    plan += `\n### AI Safety Rules\n\n`;
    if (spec.policies.ai_rules.global?.blocked_actions) {
      plan += `- **Blocked Actions:** ${spec.policies.ai_rules.global.blocked_actions.join(', ')}\n`;
    }
    const suggestOnlyEntities = Object.entries(spec.policies.ai_rules.entities || {})
      .filter(([_, rules]) => rules.suggest_only)
      .map(([name]) => name);
    if (suggestOnlyEntities.length > 0) {
      plan += `- **Suggest-Only Entities:** ${suggestOnlyEntities.join(', ')}\n`;
    }
  }

  plan += `\n---

## Next Steps

1. Run \`fd spec validate\` to verify spec files
2. Run \`fd generate\` to generate code
3. Review generated code in \`__generated__\` directories
4. Implement custom logic in \`extensions/\` directories
5. Run \`fd run\` to start the development environment
6. Test the application at http://localhost:3000

---

*This plan is auto-generated. Edit spec files and regenerate as needed.*
`;

  return plan;
}
