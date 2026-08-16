import { redirect } from "next/navigation";
import { PRODUCT } from "@/config/product";

export default function RootPage() {
  redirect(PRODUCT.defaultAuthenticatedRoute);
}
