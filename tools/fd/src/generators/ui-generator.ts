import { BaseGenerator, type GeneratorConfig } from './base-generator.js';
import type { GeneratedFile } from '../types/generator.js';
import type { ScreenSpec, FieldConfigSpec, FlowSpec } from '../types/spec.js';

export class UiGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    super(config);
  }

  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate screens
    for (const [name, screen] of Object.entries(this.spec.ui.screens || {})) {
      files.push(this.generateScreen(name, screen));
    }

    // Generate flow pages
    for (const [name, flow] of Object.entries(this.spec.flows)) {
      files.push(this.generateFlowPage(name, flow));
    }

    // Generate navigation
    files.push(this.generateNavigation());

    // Generate hooks
    files.push(this.generateHooks());

    // Generate layout wrapper
    files.push(this.generateLayout());

    return files;
  }

  private generateScreen(name: string, screen: ScreenSpec): GeneratedFile {
    const pascalName = this.helpers.toPascalCase(name);
    const kebabName = this.helpers.toKebabCase(name);

    let content = '';

    switch (screen.layout_type) {
      case 'form':
        content = this.generateFormScreen(name, screen);
        break;
      case 'list':
        content = this.generateListScreen(name, screen);
        break;
      case 'detail':
        content = this.generateDetailScreen(name, screen);
        break;
      case 'dashboard':
        content = this.generateDashboardScreen(name, screen);
        break;
      default:
        content = this.generateCustomScreen(name, screen);
    }

    return this.createFile(`apps/web/app/(generated)/${kebabName}/page.tsx`, content);
  }

  private generateFormScreen(name: string, screen: ScreenSpec): string {
    const pascalName = this.helpers.toPascalCase(name);
    const fields = screen.form?.fields || screen.sections?.[0]?.fields || [];

    const formFields = fields.map((field) => this.generateFormField(field)).join('\n');

    return `${this.generateHeader(`Form Screen: ${name}`)}
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAction } from '@/hooks/use-action';

const formSchema = z.object({
${fields.map((f) => `  ${this.helpers.toCamelCase(f.name)}: ${this.getZodType(f)},`).join('\n')}
});

type FormData = z.infer<typeof formSchema>;

export default function ${pascalName}Page() {
  const { execute, isLoading } = useAction('${screen.submit_action || 'submit'}');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const onSubmit = async (data: FormData) => {
    await execute(data);
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>${screen.title || pascalName}</CardTitle>
          ${screen.description ? `<p className="text-muted-foreground">${screen.description}</p>` : ''}
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
${this.indent(formFields, 12)}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline">
              ${screen.form?.cancel_label || 'Cancel'}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : '${screen.form?.submit_label || 'Submit'}'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
`;
  }

  private generateListScreen(name: string, screen: ScreenSpec): string {
    const pascalName = this.helpers.toPascalCase(name);
    const columns = screen.table?.columns || [];

    const columnDefs = columns.map((col) => `{
    accessorKey: '${col.field}',
    header: '${col.header || this.helpers.toPascalCase(col.field)}',
    ${col.type === 'badge' ? `cell: ({ row }) => <Badge variant={getBadgeVariant(row.getValue('${col.field}'))}>{row.getValue('${col.field}')}</Badge>,` : ''}
    ${col.type === 'date' || col.type === 'datetime' ? `cell: ({ row }) => formatDate(row.getValue('${col.field}')),` : ''}
    ${col.type === 'currency' ? `cell: ({ row }) => formatCurrency(row.getValue('${col.field}')),` : ''}
  }`).join(',\n  ');

    return `${this.generateHeader(`List Screen: ${name}`)}
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFoundation } from '@/hooks/use-foundation';
import { formatDate, formatCurrency } from '@/lib/format';

function getBadgeVariant(value: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    pending: 'secondary',
    draft: 'outline',
    cancelled: 'destructive',
    posted: 'default',
  };
  return variants[value?.toLowerCase()] || 'default';
}

export default function ${pascalName}Page() {
  const { sdk } = useFoundation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['${screen.load_action || name}'],
    queryFn: () => sdk.${this.helpers.toCamelCase(screen.load_action || 'list' + pascalName)}(),
  });

  const columns: ColumnDef<unknown>[] = [
  ${columnDefs}
  ];

  const table = useReactTable({
    data: data?.items || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">${screen.title || pascalName}</h1>
        <div className="flex items-center gap-4">
          ${screen.table?.searchable !== false ? `<Input
            placeholder="Search..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />` : ''}
          ${screen.actions?.find((a) => a.position === 'header')
            ? `<Button>${screen.actions.find((a) => a.position === 'header')?.label}</Button>`
            : ''}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  ${screen.table?.empty_state?.title || 'No results found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      ${screen.table?.paginated !== false ? `<div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {data?.total || 0} results
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>` : ''}
    </div>
  );
}
`;
  }

  private generateDetailScreen(name: string, screen: ScreenSpec): string {
    const pascalName = this.helpers.toPascalCase(name);
    const fields = screen.detail?.fields || [];

    return `${this.generateHeader(`Detail Screen: ${name}`)}
'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFoundation } from '@/hooks/use-foundation';
import { formatDate, formatCurrency } from '@/lib/format';

export default function ${pascalName}Page() {
  const params = useParams();
  const { sdk } = useFoundation();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['${screen.load_action || name}', id],
    queryFn: () => sdk.${this.helpers.toCamelCase(screen.load_action || 'get' + pascalName)}({ id }),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center h-64">Not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>${screen.title || pascalName}</CardTitle>
          <div className="flex gap-2">
            ${(screen.actions || []).map((action) =>
              `<Button variant="${action.variant || 'default'}">${action.label}</Button>`
            ).join('\n            ')}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            ${fields.map((field) => `<div>
              <dt className="text-sm font-medium text-muted-foreground">${field.label || this.helpers.toPascalCase(field.name)}</dt>
              <dd className="mt-1">{data.${this.helpers.toCamelCase(field.name)}}</dd>
            </div>`).join('\n            ')}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
`;
  }

  private generateDashboardScreen(name: string, screen: ScreenSpec): string {
    const pascalName = this.helpers.toPascalCase(name);

    return `${this.generateHeader(`Dashboard Screen: ${name}`)}
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useFoundation } from '@/hooks/use-foundation';

export default function ${pascalName}Page() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">${screen.title || 'Dashboard'}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stats cards */}
        ${(screen.sections || []).filter((s) => s.type === 'stats').map(() => `
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>`).join('')}
      </div>

      ${(screen.sections || []).filter((s) => s.type === 'table' || s.type === 'chart').map((section) => `
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>${section.title || 'Section'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Content placeholder</p>
        </CardContent>
      </Card>`).join('')}
    </div>
  );
}
`;
  }

  private generateCustomScreen(name: string, screen: ScreenSpec): string {
    const pascalName = this.helpers.toPascalCase(name);

    return `${this.generateHeader(`Custom Screen: ${name}`)}
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ${pascalName}Page() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>${screen.title || pascalName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Custom screen implementation needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
`;
  }

  private generateFlowPage(name: string, flow: FlowSpec): GeneratedFile {
    const kebabName = this.helpers.toKebabCase(name);
    const pascalName = this.helpers.toPascalCase(name);

    const stepImports = Object.keys(flow.steps).map((stepName) => {
      const screenName = flow.steps[stepName]?.screen;
      if (!screenName) return '';
      const screenKebab = this.helpers.toKebabCase(screenName);
      return `import ${this.helpers.toPascalCase(screenName)}Screen from '../${screenKebab}/page';`;
    }).filter(Boolean).join('\n');

    const content = `${this.generateHeader(`Flow: ${name}`)}
'use client';

import { useState } from 'react';
${stepImports}

type FlowStep = ${Object.keys(flow.steps).map((s) => `'${s}'`).join(' | ')};

export default function ${pascalName}FlowPage() {
  const [currentStep, setCurrentStep] = useState<FlowStep>('${flow.initial_step || Object.keys(flow.steps)[0]}');

  const renderStep = () => {
    switch (currentStep) {
${Object.entries(flow.steps).map(([stepName, step]) => {
  const screenPascal = this.helpers.toPascalCase(step.screen);
  return `      case '${stepName}':
        return <${screenPascal}Screen />;`;
}).join('\n')}
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderStep()}
    </div>
  );
}
`;

    return this.createFile(`apps/web/app/(generated)/flow/${kebabName}/page.tsx`, content);
  }

  private generateNavigation(): GeneratedFile {
    const entryFlows = Object.entries(this.spec.flows)
      .filter(([_, flow]) => flow.entry_point)
      .map(([name, flow]) => ({
        name,
        label: flow.name,
        icon: flow.icon || 'Home',
        href: `/flow/${this.helpers.toKebabCase(name)}`,
      }));

    const content = `${this.generateHeader('Navigation Configuration')}
import {
  Home,
  FileText,
  Users,
  Settings,
  BarChart,
  Upload,
  CheckCircle,
  BookOpen,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

const iconMap: Record<string, LucideIcon> = {
  Home,
  FileText,
  Users,
  Settings,
  BarChart,
  Upload,
  CheckCircle,
  BookOpen,
  CreditCard,
};

export const navigationItems: NavItem[] = [
${entryFlows.map((flow) => `  {
    label: '${flow.label}',
    href: '${flow.href}',
    icon: iconMap['${flow.icon}'] || Home,
  },`).join('\n')}
];

export const secondaryItems: NavItem[] = [
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];
`;

    return this.createFile('apps/web/app/(generated)/navigation.ts', content);
  }

  private generateHooks(): GeneratedFile {
    const content = `${this.generateHeader('Generated Hooks')}
'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFoundation } from '@/hooks/use-foundation';

export function useAction<TInput = void, TOutput = void>(actionName: string) {
  const { sdk } = useFoundation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: TInput) => {
      const action = (sdk as Record<string, unknown>)[actionName];
      if (typeof action !== 'function') {
        throw new Error(\`Action \${actionName} not found\`);
      }
      return action(input) as Promise<TOutput>;
    },
    onError: (err) => {
      setError(err as Error);
    },
    onSuccess: () => {
      setError(null);
      // Invalidate related queries
      queryClient.invalidateQueries();
    },
  });

  const execute = useCallback(
    async (input: TInput) => {
      return mutation.mutateAsync(input);
    },
    [mutation]
  );

  return {
    execute,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: error || mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
`;

    return this.createFile('apps/web/app/(generated)/hooks.ts', content);
  }

  private generateLayout(): GeneratedFile {
    const content = `${this.generateHeader('Generated Layout')}
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { navigationItems, secondaryItems } from './navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function GeneratedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold">${this.spec.product.name}</h1>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t space-y-1">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen">{children}</div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
`;

    return this.createFile('apps/web/app/(generated)/layout.tsx', content);
  }

  private generateFormField(field: FieldConfigSpec): string {
    const name = this.helpers.toCamelCase(field.name);
    const label = field.label || this.helpers.toPascalCase(field.name);

    switch (field.type) {
      case 'textarea':
        return `<div className="space-y-2">
  <Label htmlFor="${name}">${label}</Label>
  <textarea
    id="${name}"
    {...form.register('${name}')}
    placeholder="${field.placeholder || ''}"
    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
  />
  {form.formState.errors.${name} && (
    <p className="text-sm text-destructive">{form.formState.errors.${name}?.message}</p>
  )}
</div>`;

      case 'select':
        return `<div className="space-y-2">
  <Label htmlFor="${name}">${label}</Label>
  <select
    id="${name}"
    {...form.register('${name}')}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
  >
    <option value="">Select...</option>
    ${(field.options || []).map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('\n    ')}
  </select>
  {form.formState.errors.${name} && (
    <p className="text-sm text-destructive">{form.formState.errors.${name}?.message}</p>
  )}
</div>`;

      case 'checkbox':
      case 'switch':
        return `<div className="flex items-center space-x-2">
  <input
    type="checkbox"
    id="${name}"
    {...form.register('${name}')}
    className="h-4 w-4 rounded border-gray-300"
  />
  <Label htmlFor="${name}">${label}</Label>
</div>`;

      case 'file':
        return `<div className="space-y-2">
  <Label htmlFor="${name}">${label}</Label>
  <Input
    id="${name}"
    type="file"
    {...form.register('${name}')}
  />
  {form.formState.errors.${name} && (
    <p className="text-sm text-destructive">{form.formState.errors.${name}?.message}</p>
  )}
</div>`;

      default:
        const inputType = this.getInputType(field.type);
        return `<div className="space-y-2">
  <Label htmlFor="${name}">${label}</Label>
  <Input
    id="${name}"
    type="${inputType}"
    placeholder="${field.placeholder || ''}"
    {...form.register('${name}')}
  />
  ${field.help_text ? `<p className="text-sm text-muted-foreground">${field.help_text}</p>` : ''}
  {form.formState.errors.${name} && (
    <p className="text-sm text-destructive">{form.formState.errors.${name}?.message}</p>
  )}
</div>`;
    }
  }

  private getInputType(type?: string): string {
    const map: Record<string, string> = {
      email: 'email',
      password: 'password',
      number: 'number',
      decimal: 'number',
      currency: 'number',
      date: 'date',
      datetime: 'datetime-local',
      time: 'time',
      url: 'url',
      phone: 'tel',
    };
    return map[type || ''] || 'text';
  }

  private getZodType(field: FieldConfigSpec): string {
    const required = field.validation?.required;

    switch (field.type) {
      case 'number':
      case 'decimal':
      case 'currency':
        return required ? 'z.number()' : 'z.number().optional()';
      case 'checkbox':
      case 'switch':
        return 'z.boolean().default(false)';
      case 'date':
      case 'datetime':
        return required ? 'z.coerce.date()' : 'z.coerce.date().optional()';
      case 'email':
        return required ? 'z.string().email()' : 'z.string().email().optional()';
      default:
        return required ? 'z.string().min(1)' : 'z.string().optional()';
    }
  }
}
