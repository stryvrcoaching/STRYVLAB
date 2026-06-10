import CoachShell from "@/components/layout/CoachShell";

export default function OutilsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CoachShell>{children}</CoachShell>;
}
