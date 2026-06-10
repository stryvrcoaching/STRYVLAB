import { redirect } from "next/navigation"

// Redirigé vers le Journal alimentaire unifié DA v3.0
export default function OldMealsJournalPage() {
  redirect("/client/nutrition")
}
