import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shell";
import { AreaConverter } from "@/components/tools/area-converter";

export const metadata: Metadata = {
  title: "Area converter: sq ft, sq m, gaj, acre, cent, bigha",
  description: "Convert land and flat areas between square feet, square metres, square yards, gaj, acres, hectares, cents and state-wise bigha.",
  alternates: { canonical: "/tools/area-converter" },
};

export default function Page() {
  return (
    <ToolShell slug="area-converter" title="Area converter" intro="Type in any box and the rest update. Bigha depends on the state, so pick one below.">
      <AreaConverter />
    </ToolShell>
  );
}
