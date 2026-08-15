import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChecklistMasterPage } from "@/src/components/checklist-master-page";
import { getSession } from "@/src/lib/auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Master Checklist"};

export default async function MasterChecklistRoute(){const session=await getSession();if(!session)redirect("/");return <ChecklistMasterPage demo={Boolean(session.isDemo)}/>}
