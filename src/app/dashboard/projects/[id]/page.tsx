import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Breadcrumbs, btnClass } from "@/components/ui";
import { dashboardContext } from "@/lib/supply/account";
import { PageTitle } from "@/components/supply/bits";
import { ProjectForm } from "@/components/supply/project-form";
import { FeatureToggle } from "@/components/supply/feature-toggle";
import { formData, projectToDraft } from "@/lib/supply/projects";

export const metadata: Metadata = { title: "Edit project", robots: { index: false } };

export default async function EditProject({ params }: PageProps<"/dashboard/projects/[id]">) {
  const { id } = await params;
  const { subject, viewer } = await dashboardContext(`/dashboard/projects/${id}`);
  const draft = projectToDraft(Number(id));
  if (!draft || (draft._builder_id !== subject.id && viewer.role !== "admin")) notFound();
  const { _builder_id, _approved, _featured, _slug, _name, ...initial } = draft;
  void _builder_id;
  const { cities, localities } = formData();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Projects", href: "/dashboard/projects" }, { label: _name }]} />
      <div className="mt-3">
        <PageTitle
          title={_name}
          sub={<span className="inline-flex flex-wrap items-center gap-2">{_approved ? <Badge tone="trust">Approved</Badge> : <Badge tone="warn">Pending approval</Badge>}{_featured ? <Badge tone="accent">Featured</Badge> : null}</span>}
          action={
            <div className="flex flex-wrap gap-2">
              {_approved ? <Link href={`/projects/${_slug}`} className={btnClass("secondary", "md")}>View public page</Link> : null}
              <FeatureToggle id={Number(id)} featured={!!_featured} />
            </div>
          }
        />
      </div>
      <ProjectForm cities={cities} localities={localities} initial={initial} id={Number(id)} />
    </div>
  );
}
