import { redirect } from "next/navigation";

// v2.10: the bourbon-cards gallery folded into the unified Bourbon
// Wiki at /wiki (tabs for Cards / Distilleries / Investments). Keep
// /mash-bills as a permanent redirect so any saved bookmarks land on
// the new home.
export default function MashBillsRedirect(): never {
  redirect("/wiki");
}
