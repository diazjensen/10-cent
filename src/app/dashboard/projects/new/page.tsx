import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { dashboardContext } from "@/lib/supply/account";
import { PageTitle } from "@/components/supply/bits";
import { ProjectForm } from "@/components/supply/project-form";
import { formData } from "@/lib/supply/projects";

export const metadata: Metadata = { title: "Add project", robots: { index: false } };

export default async function NewProject() {
  const { subject } = await dashboardContext("/dashboard/projects/new");
  if (subject.role !== "builder" && subject.role !== "admin") redirect("/dashboard");
  const { cities, localities } = formData();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Projects", href: "/dashboard/projects" }, { label: "New project" }]} />
      <div className="mt-3"><PageTitle title="Add a project" sub="Our team checks the RERA registration before a new project goes live, usually within 2 working days." /></div>
      <ProjectForm cities={cities} localities={localities} initial={null} id={null} />
    </div>
  );
}
