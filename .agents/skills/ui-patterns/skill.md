---
name: ui-patterns
description: Reusable UI patterns for STRYVR — layouts, tables, forms, empty states
---

## Layout patterns

### Page layout (coach dashboard)

```typescript
export default function PageName() {
  return (
    <div className="flex flex-col h-full">
      {/* Fixed header */}
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Page Title</h1>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* content */}
      </div>
    </div>
  )
}
```

### Two-column layout (list + detail)

```typescript
<div className="flex h-full">
  <div className="w-80 shrink-0 border-r overflow-y-auto">
    {/* List */}
  </div>
  <div className="flex-1 overflow-y-auto">
    {/* Detail */}
  </div>
</div>
```

## Data table pattern

```typescript
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Exercise</TableHead>
      <TableHead className="font-mono">Sets</TableHead>
      <TableHead className="font-mono">Reps</TableHead>
      <TableHead className="font-mono">Load</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {sets.map(set => (
      <TableRow key={set.id}>
        <TableCell>{set.exercise.name}</TableCell>
        <TableCell className="font-mono">{set.sets}</TableCell>
        <TableCell className="font-mono">{set.reps}</TableCell>
        <TableCell className="font-mono">{set.loadKg} kg</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Empty state pattern

```typescript
function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Usage
{clients.length === 0 && (
  <EmptyState
    message="No clients yet."
    action={<Button>Add your first client</Button>}
  />
)}
```

## Loading state pattern

```typescript
import { Skeleton } from "@/components/ui/skeleton"

// Card skeleton
function ClientCardSkeleton() {
  return (
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// Usage with Suspense
{isLoading ? <ClientCardSkeleton /> : <ClientCard client={client} />}
```

## Form pattern

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  weightKg: z.number().positive("Weight must be positive")
})

function MyForm() {
  const form = useForm({ resolver: zodResolver(schema) })

  const onSubmit = form.handleSubmit(async (data) => {
    // submit
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField name="name" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <Input {...field} />
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  )
}
```

## Dialog / Sheet pattern

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button>Add Exercise</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Exercise</DialogTitle>
    </DialogHeader>
    {/* form or content */}
  </DialogContent>
</Dialog>
```

Always use Radix Dialog/Sheet — never custom modal without focus trap.
