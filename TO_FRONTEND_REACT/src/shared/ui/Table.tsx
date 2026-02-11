import type {
  TableHTMLAttributes,
  HTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from '../lib/utils';

type WithChildren = { children: ReactNode };

export function Table({
  children,
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & WithChildren) {
  return (
    <div className="relative w-full overflow-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      <table 
        className={cn("w-full caption-bottom text-sm text-left", className)} 
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement> & WithChildren) {
  return (
    <thead className={cn("[&_tr]:border-b bg-gray-50/50", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement> & WithChildren) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & WithChildren) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-gray-50/50 data-[state=selected]:bg-gray-100",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & WithChildren) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & WithChildren) {
  return (
    <td
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pr-0 text-gray-900",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}