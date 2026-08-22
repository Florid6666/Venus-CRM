import * as React from "react";
import { useSearchStore } from "@/stores/search-store";
import { DealFormDialog } from "@/components/deal-form-dialog";
import { ContactFormDialog } from "@/components/contact-form-dialog";
import { CompanyFormDialog } from "@/components/company-form-dialog";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { CandidateFormDialog } from "@/components/candidate-form-dialog";
import { JobPostingFormDialog } from "@/components/job-posting-form-dialog";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { DepartmentFormDialog } from "@/components/department-form-dialog";
import { LeaveRequestFormDialog } from "@/components/leave-request-form-dialog";

export function GlobalDialogs() {
  const activeDialog = useSearchStore((s) => s.activeDialog);
  const setActiveDialog = useSearchStore((s) => s.setActiveDialog);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setActiveDialog(null);
    }
  };

  return (
    <>
      <DealFormDialog open={activeDialog === "deal"} onOpenChange={handleOpenChange} />
      <ContactFormDialog open={activeDialog === "contact"} onOpenChange={handleOpenChange} />
      <CompanyFormDialog open={activeDialog === "company"} onOpenChange={handleOpenChange} />
      <ProjectFormDialog open={activeDialog === "project"} onOpenChange={handleOpenChange} />
      <TaskFormDialog open={activeDialog === "task"} onOpenChange={handleOpenChange} />
      <CandidateFormDialog open={activeDialog === "candidate"} onOpenChange={handleOpenChange} />
      <JobPostingFormDialog open={activeDialog === "job-posting"} onOpenChange={handleOpenChange} />
      <EmployeeFormDialog open={activeDialog === "employee"} onOpenChange={handleOpenChange} />
      <DepartmentFormDialog open={activeDialog === "department"} onOpenChange={handleOpenChange} />
      <LeaveRequestFormDialog open={activeDialog === "leave-request"} onOpenChange={handleOpenChange} />
    </>
  );
}
