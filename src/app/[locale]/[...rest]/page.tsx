import { notFound } from "next/navigation";

/** Any unknown localized path renders the localized 404. */
export default function CatchAllPage() {
  notFound();
}
